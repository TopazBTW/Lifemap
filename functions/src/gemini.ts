import { GoogleGenAI, Type } from '@google/genai';
import { logger } from 'firebase-functions';
import { z } from 'zod';

// NodeNext ESM: relative imports need the emitted .js extension, even from .ts.
import type { ResolvedReel } from './resolve.js';

/**
 * Model choice: flash is the right tier here. Extraction is a short,
 * well-specified task, video tokens are expensive, and this runs on every
 * import — latency and cost matter more than reasoning depth.
 */
const MODEL = 'gemini-2.5-flash';

const PLACE_KINDS = [
  'restaurant', 'hotel', 'airbnb', 'beach', 'attraction',
  'viewpoint', 'bar', 'cafe', 'trail', 'other',
] as const;

/** Mirrors the client's `extractedPlaceSchema`. Server-side is authoritative. */
const extractedPlaceSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(PLACE_KINDS),
  country: z.string().length(2).nullable(),
  city: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

const extractionSchema = z.object({
  places: z.array(extractedPlaceSchema).max(20),
  summary: z.string().optional(),
});

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * Note there is deliberately **no `coordinates` field**.
 *
 * LLMs recall place *names* well and lat/lng badly — they'll emit confident,
 * plausible, wrong coordinates. We ask only for names and geocode separately
 * against Mapbox, which is authoritative. See geocode.ts.
 */
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    places: {
      type: Type.ARRAY,
      maxItems: 20,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description:
              'Specific, searchable name of the place, e.g. "Sirocco Rooftop Bar, Bangkok". Not a generic description.',
          },
          kind: { type: Type.STRING, enum: [...PLACE_KINDS] },
          country: {
            type: Type.STRING,
            description: 'ISO 3166-1 alpha-2, uppercase. Null if unsure.',
            nullable: true,
          },
          city: { type: Type.STRING, nullable: true },
          confidence: {
            type: Type.NUMBER,
            description:
              '0-1. How certain you are this is a real, identifiable place named in the content. Be strict.',
          },
          reasoning: {
            type: Type.STRING,
            description: 'Brief: what in the content identified this place.',
          },
        },
        required: ['name', 'kind', 'country', 'city', 'confidence'],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ['places'],
};

const SYSTEM_INSTRUCTION = `
You extract real, visitable places from travel social media content.

Rules:
- Only list places you can actually identify from the content. A video showing
  "a beach in Thailand" with no name is NOT a place — skip it.
- Never guess coordinates. You are not asked for them.
- If the content names a place, use its full searchable name including the city.
- confidence must be honest: 0.9+ only when the place is named explicitly
  (on-screen text, caption, or clearly spoken). Use <0.5 when inferring from
  visuals alone.
- Return an empty places array rather than inventing anything.
`.trim();

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fail loudly at call time — a missing key must not look like "no places found".
    throw new Error('GEMINI_API_KEY is not configured on the function.');
  }
  return new GoogleGenAI({ apiKey });
}

export async function extractPlaces(resolved: ResolvedReel): Promise<Extraction> {
  const ai = client();

  const contents = buildContents(resolved);
  if (!contents) {
    return { places: [], summary: 'Nothing to analyse.' };
  }

  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema,
      // Extraction should be reproducible, not creative.
      temperature: 0.1,
    },
  });

  const text = res.text;
  if (!text) throw new Error('Gemini returned an empty response.');

  // responseSchema constrains shape but not semantics (e.g. a 3-letter country
  // code). Validate before it can reach Firestore.
  const parsed = extractionSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    logger.error('gemini returned unparseable extraction', {
      issues: parsed.error.issues,
      text: text.slice(0, 1000),
    });
    throw new Error('Gemini returned an unexpected shape.');
  }

  // Normalise: uppercase ISO codes, drop anything that isn't 2 letters.
  const places = parsed.data.places.map((p) => ({
    ...p,
    country: /^[A-Za-z]{2}$/.test(p.country ?? '')
      ? p.country!.toUpperCase()
      : null,
  }));

  return { places, summary: parsed.data.summary };
}

function buildContents(resolved: ResolvedReel) {
  if (resolved.kind === 'video') {
    return [
      {
        role: 'user' as const,
        parts: [
          { text: 'Extract every identifiable place from this video.' },
          // fileData with a YouTube URI — the one URL form Gemini accepts.
          { fileData: { fileUri: resolved.fileUri, mimeType: 'video/*' } },
        ],
      },
    ];
  }

  if (resolved.kind === 'text') {
    const blob = [
      resolved.title ? `Title: ${resolved.title}` : null,
      resolved.caption && resolved.caption !== resolved.title
        ? `Caption: ${resolved.caption}`
        : null,
      resolved.author ? `Author: ${resolved.author}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (!blob.trim()) return null;

    return [
      {
        role: 'user' as const,
        parts: [
          {
            text:
              `Extract every identifiable place from this ${resolved.platform} post's metadata. ` +
              `You cannot see the video, only this text — lower your confidence accordingly.\n\n${blob}`,
          },
        ],
      },
    ];
  }

  return null;
}
