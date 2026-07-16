import { geocodeViaGoogle } from '@/features/passport/googlePlaces';
import { geocodeViaNominatim } from '@/features/places/searchPlaces';
import { env } from '@/shared/lib/env';
import {
  PLACE_KINDS,
  type Coordinates,
  type PlaceKind,
} from '@/shared/types/domain';

/**
 * Reel → places, entirely client-side.
 *
 * The original design ran this in a Cloud Function, which needs the Blaze
 * plan. This port keeps it on the free tier: a free Gemini key
 * (aistudio.google.com) extracts place *names* from the caption/title, then we
 * geocode each name against Google Places (or free Nominatim) — the model is
 * never trusted with coordinates.
 */

export type ReelPlatform = 'instagram' | 'tiktok' | 'youtube' | 'unknown';

export function detectPlatform(rawUrl: string): ReelPlatform {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
  const is = (...hosts: string[]) =>
    hosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (is('instagram.com', 'instagr.am')) return 'instagram';
  if (is('tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com')) return 'tiktok';
  if (is('youtube.com', 'youtu.be', 'm.youtube.com')) return 'youtube';
  return 'unknown';
}

export type ResolvedCaption = {
  platform: ReelPlatform;
  caption: string;
  author: string | null;
  thumbnailUrl: string | null;
};

/**
 * Pull the caption/title from a link via public oEmbed (keyless for TikTok and
 * YouTube; Instagram has no public endpoint, so the user pastes the caption).
 */
export async function resolveCaption(url: string): Promise<ResolvedCaption> {
  const platform = detectPlatform(url);
  const endpoint =
    platform === 'tiktok'
      ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
      : platform === 'youtube'
        ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        : null;

  if (!endpoint) {
    return { platform, caption: '', author: null, thumbnailUrl: null };
  }

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { platform, caption: '', author: null, thumbnailUrl: null };
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      platform,
      caption: data.title ?? '',
      author: data.author_name ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
    };
  } catch {
    return { platform, caption: '', author: null, thumbnailUrl: null };
  }
}

export type ExtractedPlace = {
  name: string;
  kind: PlaceKind;
  country: string | null;
  city: string | null;
  confidence: number;
  coordinates: Coordinates | null;
};

const SYSTEM = `You extract real, visitable places from travel social-media captions.
Rules:
- Only list places you can actually identify from the text. "a beach in Thailand" with no name is NOT a place — skip it.
- Never output coordinates.
- Use each place's full searchable name including its city when known.
- confidence 0-1, honest: 0.9+ only when the place is named explicitly.
- Return an empty places array rather than inventing anything.`;

// Shape instruction for JSON-mode models (Mistral) that take no schema object.
const JSON_SHAPE = `Respond with ONLY a JSON object of this exact shape:
{"places":[{"name":"string","kind":"one of ${PLACE_KINDS.join('|')}","country":"ISO 3166-1 alpha-2 or null","city":"string or null","confidence":0.0}]}`;

const geminiSchema = {
  type: 'OBJECT',
  properties: {
    places: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          kind: { type: 'STRING', enum: [...PLACE_KINDS] },
          country: { type: 'STRING', nullable: true },
          city: { type: 'STRING', nullable: true },
          confidence: { type: 'NUMBER' },
        },
        required: ['name', 'kind', 'confidence'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['places'],
};

type RawPlace = {
  name: string;
  kind: string;
  country?: string | null;
  city?: string | null;
  confidence: number;
};

const userPrompt = (caption: string) =>
  `Extract every identifiable place:\n\n${caption}`;

/** Mistral (La Plateforme) chat completions in JSON mode — the user's provider. */
async function extractViaMistral(caption: string): Promise<RawPlace[]> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.mistralApiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM}\n\n${JSON_SHAPE}` },
        { role: 'user', content: userPrompt(caption) },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      res.status === 401
        ? 'Mistral rejected the key. Check it in console.mistral.ai.'
        : `Extraction failed (${res.status}). ${body.slice(0, 120)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) return [];
  const parsed = JSON.parse(text) as { places?: RawPlace[] };
  return parsed.places ?? [];
}

/** Gemini generateContent with a response schema. */
async function extractViaGemini(caption: string): Promise<RawPlace[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt(caption) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiSchema,
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      res.status === 400 || res.status === 403
        ? 'Gemini rejected the key. Check it in aistudio.google.com.'
        : `Extraction failed (${res.status}). ${body.slice(0, 120)}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  const parsed = JSON.parse(text) as { places?: RawPlace[] };
  return parsed.places ?? [];
}

/** Pick a provider by which key is set — Mistral wins when both are. */
async function extractNames(caption: string): Promise<RawPlace[]> {
  if (env.mistralApiKey) return extractViaMistral(caption);
  if (env.geminiApiKey) return extractViaGemini(caption);
  throw new Error('Add a Mistral or Gemini key to enable reel extraction.');
}

const KIND_SET = new Set<string>(PLACE_KINDS);

/**
 * Full pipeline: caption → named places → geocoded places. Geocoding is
 * sequential (Nominatim's free tier is 1 req/s; the throttle lives in
 * geocode fetches). Places that can't be located keep null coordinates and are
 * flagged low-confidence for the review screen.
 */
export async function extractPlacesFromCaption(
  caption: string,
): Promise<ExtractedPlace[]> {
  const names = await extractNames(caption);
  const out: ExtractedPlace[] = [];

  for (const raw of names) {
    const kind: PlaceKind = KIND_SET.has(raw.kind)
      ? (raw.kind as PlaceKind)
      : 'other';
    const query = [raw.name, raw.city, raw.country].filter(Boolean).join(', ');

    let coordinates: Coordinates | null = null;
    let country = raw.country ?? null;
    let city = raw.city ?? null;

    const google = await geocodeViaGoogle(query);
    if (google) {
      coordinates = { lat: google.lat, lng: google.lng };
      country = google.country ?? country;
      city = google.city ?? city;
    } else {
      const osm = await geocodeViaNominatim(query);
      if (osm) {
        coordinates = { lat: osm.lat, lng: osm.lng };
        country = osm.country ?? country;
        city = osm.city ?? city;
      }
    }

    out.push({
      name: raw.name,
      kind,
      country,
      city,
      confidence: coordinates ? raw.confidence : Math.min(raw.confidence, 0.4),
      coordinates,
    });
  }

  return out;
}

export function hasExtractor(): boolean {
  return !!env.mistralApiKey || !!env.geminiApiKey;
}
