import { useQuery } from '@tanstack/react-query';

import { env } from '@/shared/lib/env';

/**
 * Google Places API (New) client.
 *
 * Deliberately stores nothing Google returns except the `placeId` — Google's
 * terms forbid caching their photos/details, and photo URLs expire. Callers
 * persist only the placeId and re-fetch photos/summary **live** each view
 * (React Query caches within a session). This is exactly the "look it up and
 * pull it out, don't save it" model.
 */
const BASE = 'https://places.googleapis.com/v1';

export function hasGooglePlaces(): boolean {
  return !!env.googleMapsApiKey;
}

export type GooglePlaceHit = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  country: string | null;
  city: string | null;
};

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

async function searchText(query: string): Promise<GooglePlaceHit[]> {
  const key = env.googleMapsApiKey;
  if (!key) return [];

  const res = await fetch(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      // FieldMask is required; request only what we use to keep cost in the
      // cheapest tier.
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 6 }),
  });
  if (!res.ok) throw new Error(`Google search failed (${res.status}).`);

  const data = (await res.json()) as {
    places?: {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      addressComponents?: AddressComponent[];
    }[];
  };

  return (data.places ?? []).map((p) => {
    const comps = p.addressComponents ?? [];
    const country = comps.find((c) => c.types?.includes('country'));
    const city = comps.find(
      (c) => c.types?.includes('locality') || c.types?.includes('postal_town'),
    );
    return {
      placeId: p.id,
      name: p.displayName?.text ?? query,
      address: p.formattedAddress ?? '',
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      country: country?.shortText?.toUpperCase() ?? null,
      city: city?.longText ?? null,
    };
  });
}

export function useGooglePlaceSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['gplace-search', q],
    queryFn: () => searchText(q),
    enabled: q.length >= 3 && hasGooglePlaces(),
    staleTime: 5 * 60_000,
  });
}

export type GooglePlaceDetails = {
  /** Live photo URLs — valid only briefly, never persist these. */
  photoUrls: string[];
  rating: number | null;
  summary: string | null;
};

async function placeDetails(placeId: string): Promise<GooglePlaceDetails> {
  const key = env.googleMapsApiKey;
  if (!key) return { photoUrls: [], rating: null, summary: null };

  const res = await fetch(`${BASE}/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'photos,rating,editorialSummary',
    },
  });
  if (!res.ok) throw new Error(`Google details failed (${res.status}).`);

  const data = (await res.json()) as {
    photos?: { name: string }[];
    rating?: number;
    editorialSummary?: { text?: string };
  };

  const photoUrls = (data.photos ?? []).slice(0, 3).map(
    (ph) => `${BASE}/${ph.name}/media?maxWidthPx=800&key=${key}`,
  );

  return {
    photoUrls,
    rating: data.rating ?? null,
    summary: data.editorialSummary?.text ?? null,
  };
}

export function useGooglePlaceDetails(placeId: string | null | undefined) {
  return useQuery({
    queryKey: ['gplace-details', placeId],
    queryFn: () => placeDetails(placeId!),
    enabled: !!placeId && hasGooglePlaces(),
    staleTime: 60 * 60_000,
  });
}
