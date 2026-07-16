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

const EMPTY = (platform: ReelPlatform): ResolvedCaption => ({
  platform,
  caption: '',
  author: null,
  thumbnailUrl: null,
});

function decodeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/**
 * Read a post's caption without any API.
 *  - TikTok / YouTube: public oEmbed (keyless).
 *  - Instagram: no public endpoint, so we scrape the public page's
 *    `og:description` meta tag (served to link-preview bots). Best-effort —
 *    private posts or a login wall yield nothing, and the user can still paste.
 */
export async function resolveCaption(url: string): Promise<ResolvedCaption> {
  const platform = detectPlatform(url);

  if (platform === 'instagram') {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'facebookexternalhit/1.1' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return EMPTY(platform);
      const html = await res.text();
      const m =
        html.match(/property="og:description"\s+content="([^"]*)"/i) ??
        html.match(/content="([^"]*)"\s+property="og:description"/i);
      const img = html.match(/property="og:image"\s+content="([^"]*)"/i);
      return {
        platform,
        caption: m ? decodeHtml(m[1]) : '',
        author: null,
        thumbnailUrl: img ? decodeHtml(img[1]) : null,
      };
    } catch {
      return EMPTY(platform);
    }
  }

  const endpoint =
    platform === 'tiktok'
      ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
      : platform === 'youtube'
        ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        : null;

  if (!endpoint) return EMPTY(platform);

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return EMPTY(platform);
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
    return EMPTY(platform);
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

const userPrompt = (caption: string, hasImage: boolean) =>
  hasImage
    ? `Analyse this reel's cover frame AND caption, and extract every identifiable place shown or named.${
        caption ? `\n\nCaption:\n${caption}` : '\n\n(No caption — go by the image.)'
      }`
    : `Extract every identifiable place:\n\n${caption}`;

/**
 * Mistral (La Plateforme) in JSON mode. When a cover image is available it
 * goes to the multimodal model so the model reads the *visuals* — landmarks,
 * signage, scenery — not just the caption. This is as close to "analyse the
 * reel" as a free client-only app gets (no way to pull the full video frames
 * from IG/TikTok in Expo Go).
 */
async function extractViaMistral(
  caption: string,
  imageUrl?: string | null,
): Promise<RawPlace[]> {
  const userContent = imageUrl
    ? [
        { type: 'text', text: userPrompt(caption, true) },
        { type: 'image_url', image_url: imageUrl },
      ]
    : userPrompt(caption, false);

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.mistralApiKey}`,
    },
    body: JSON.stringify({
      // mistral-small is multimodal — handles both the image and JSON mode.
      model: 'mistral-small-latest',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM}\n\n${JSON_SHAPE}` },
        { role: 'user', content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(40000),
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

/**
 * Gemini generateContent with a response schema. For a YouTube URL, Gemini can
 * watch the **actual video** (fileData) — true full-video analysis, the one
 * case where that's possible for free.
 */
async function extractViaGemini(
  caption: string,
  videoUrl?: string | null,
): Promise<RawPlace[]> {
  const parts: Record<string, unknown>[] = [
    {
      text: videoUrl
        ? 'Watch this video and extract every identifiable place shown or named.'
        : userPrompt(caption, false),
    },
  ];
  if (videoUrl) parts.push({ fileData: { fileUri: videoUrl, mimeType: 'video/*' } });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiSchema,
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(60000),
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

/**
 * Pick a provider by which key is set — Mistral wins when both are.
 * `imageUrl` = cover frame (Mistral vision); `youtubeUrl` = full-video analysis
 * when Gemini handles a YouTube link.
 */
async function extractNames(
  caption: string,
  imageUrl?: string | null,
  youtubeUrl?: string | null,
): Promise<RawPlace[]> {
  if (env.mistralApiKey) return extractViaMistral(caption, imageUrl);
  if (env.geminiApiKey) return extractViaGemini(caption, youtubeUrl);
  throw new Error('Add a Mistral or Gemini key to enable reel extraction.');
}

/**
 * Fetch a thumbnail and inline it as a base64 data URI.
 *
 * We can't just hand Mistral the remote URL: Instagram/TikTok cover images are
 * hotlink-protected and Mistral's server-side fetch fails on them. Downloading
 * in-app (which carries our headers) and sending base64 is reliable.
 */
async function imageUrlToDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const KIND_SET = new Set<string>(PLACE_KINDS);

/**
 * Full pipeline: caption → named places → geocoded places. Geocoding is
 * sequential (Nominatim's free tier is 1 req/s; the throttle lives in
 * geocode fetches). Places that can't be located keep null coordinates and are
 * flagged low-confidence for the review screen.
 */
export async function extractPlacesFromReel(input: {
  caption: string;
  /** Cover frame — analysed by the vision model. */
  imageUrl?: string | null;
  /** YouTube URL — analysed as full video when Gemini is the provider. */
  youtubeUrl?: string | null;
}): Promise<ExtractedPlace[]> {
  // Inline the cover frame as base64 for the vision model (see helper).
  const imageData = input.imageUrl
    ? await imageUrlToDataUri(input.imageUrl)
    : null;

  const names = await extractNames(input.caption, imageData, input.youtubeUrl);
  const out: ExtractedPlace[] = [];

  for (const raw of names) {
    const kind: PlaceKind = KIND_SET.has(raw.kind)
      ? (raw.kind as PlaceKind)
      : 'other';
    const query = [raw.name, raw.city, raw.country].filter(Boolean).join(', ');

    let coordinates: Coordinates | null = null;
    // Country comes only from the geocoder (authoritative ISO code); the
    // model's country is a full name like "Thailand" and is used only as a
    // search hint, never stored.
    let country: string | null = null;
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
