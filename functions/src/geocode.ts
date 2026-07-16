import { logger } from 'firebase-functions';

export type GeocodeResult = {
  lat: number;
  lng: number;
  country: string | null;
  city: string | null;
};

/**
 * Resolve a place name to real coordinates via Mapbox.
 *
 * This exists because the model is not allowed to emit coordinates (see
 * gemini.ts). Mapbox is the authority; if it can't find the place, we return
 * null and the place is surfaced to the user as "location unresolved" rather
 * than pinned somewhere invented.
 */
export async function geocode(
  query: string,
  opts?: { country?: string | null; proximity?: { lat: number; lng: number } },
): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_GEOCODING_TOKEN;
  if (!token) throw new Error('MAPBOX_GEOCODING_TOKEN is not configured.');

  const params = new URLSearchParams({
    access_token: token,
    limit: '1',
    // POIs and addresses; excludes e.g. whole countries matching loosely.
    types: 'poi,address,place,locality,neighborhood',
  });
  if (opts?.country) params.set('country', opts.country.toLowerCase());
  if (opts?.proximity) {
    params.set('proximity', `${opts.proximity.lng},${opts.proximity.lat}`);
  }

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logger.warn('mapbox geocode non-200', { status: res.status, query });
      return null;
    }

    const data = (await res.json()) as {
      features?: {
        center?: [number, number];
        context?: { id: string; short_code?: string; text?: string }[];
      }[];
    };

    const feature = data.features?.[0];
    const center = feature?.center;
    if (!center) return null;

    // Mapbox returns [lng, lat] — do not swap these.
    const [lng, lat] = center;

    const countryCtx = feature.context?.find((c) => c.id.startsWith('country'));
    const placeCtx = feature.context?.find((c) => c.id.startsWith('place'));

    return {
      lat,
      lng,
      country: countryCtx?.short_code?.toUpperCase() ?? null,
      city: placeCtx?.text ?? null,
    };
  } catch (err) {
    logger.warn('mapbox geocode failed', { query, err });
    return null;
  }
}
