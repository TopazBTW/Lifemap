import { logger } from 'firebase-functions';

export type GeocodeResult = {
  lat: number;
  lng: number;
  country: string | null;
  city: string | null;
};

/**
 * Nominatim (OpenStreetMap) usage policy: max 1 request/second and a
 * meaningful User-Agent. This module-level throttle covers the sequential
 * loops in index.ts; if geocoding ever goes parallel, this must become a
 * proper queue.
 */
const MIN_INTERVAL_MS = 1100;
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

/**
 * Resolve a place name to real coordinates via Nominatim (OpenStreetMap).
 *
 * This exists because the model is not allowed to emit coordinates (see
 * gemini.ts). The geocoder is the authority; if it can't find the place, we
 * return null and the place is surfaced to the user as "location unresolved"
 * rather than pinned somewhere invented.
 *
 * Nominatim over a commercial geocoder deliberately: no API key, no billing
 * account. The 1 req/s cap is fine at reel-import volumes; revisit if this
 * ever becomes a hot path.
 */
export async function geocode(
  query: string,
  opts?: { country?: string | null },
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
  });
  if (opts?.country) params.set('countrycodes', opts.country.toLowerCase());

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  try {
    await throttle();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        // Nominatim blocks anonymous/default agents.
        'User-Agent': 'LifeMapAI/1.0 (travel journal app; contact via repo)',
      },
    });
    if (!res.ok) {
      logger.warn('nominatim geocode non-200', { status: res.status, query });
      return null;
    }

    const data = (await res.json()) as {
      lat?: string;
      lon?: string;
      address?: Record<string, string | undefined>;
    }[];

    const hit = data[0];
    if (!hit?.lat || !hit.lon) return null;

    const addr = hit.address ?? {};

    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      country: addr.country_code ? addr.country_code.toUpperCase() : null,
      // Nominatim scatters the locality across keys by place type.
      city: addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null,
    };
  } catch (err) {
    logger.warn('nominatim geocode failed', { query, err });
    return null;
  }
}
