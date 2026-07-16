import { useQuery } from '@tanstack/react-query';

export type PlaceHit = {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  country: string | null;
  city: string | null;
};

/**
 * Client-side Nominatim (OpenStreetMap) place search — free, no key. The
 * usage policy wants a real User-Agent and gentle traffic; the query hook
 * below only fires on a debounced, ≥3-char query, which keeps a human's
 * typing well under the 1 req/s cap.
 */
async function searchNominatim(query: string): Promise<PlaceHit[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '6',
    addressdetails: '1',
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { 'User-Agent': 'LifeMapAI/1.0 (personal travel journal)' } },
  );
  if (!res.ok) throw new Error(`Search failed (${res.status}). Try again.`);

  const data = (await res.json()) as {
    place_id: number;
    name?: string;
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string | undefined>;
  }[];

  return data.map((hit) => ({
    id: String(hit.place_id),
    name: hit.name || hit.display_name.split(',')[0],
    displayName: hit.display_name,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    country: hit.address?.country_code?.toUpperCase() ?? null,
    city:
      hit.address?.city ??
      hit.address?.town ??
      hit.address?.village ??
      hit.address?.municipality ??
      null,
  }));
}

export function usePlaceSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['placeSearch', trimmed],
    queryFn: () => searchNominatim(trimmed),
    enabled: trimmed.length >= 3,
    staleTime: 5 * 60_000,
  });
}

/**
 * Coordinates → country/city, via Nominatim reverse geocoding (free, keyless).
 * Used so a memory tagged with the phone's GPS still colours its country on
 * the map — raw coordinates alone can't do that.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ country: string | null; city: string | null }> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
  });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      { headers: { 'User-Agent': 'LifeMapAI/1.0 (personal travel journal)' } },
    );
    if (!res.ok) return { country: null, city: null };
    const data = (await res.json()) as {
      address?: Record<string, string | undefined>;
    };
    const a = data.address ?? {};
    return {
      country: a.country_code?.toUpperCase() ?? null,
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
    };
  } catch {
    return { country: null, city: null };
  }
}
