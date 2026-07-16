import { hasGooglePlaces, useGooglePlaceSearch } from '@/features/passport/googlePlaces';
import { usePlaceSearch } from '@/features/places/searchPlaces';

export type LocationResult = {
  key: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  country: string | null;
  city: string | null;
};

/**
 * One place-search interface over both backends: Google Places when a key is
 * configured, else free Nominatim. Both hooks are always called (rules of
 * hooks); the inactive one is disabled with an empty query.
 */
export function useLocationSearch(query: string): {
  results: LocationResult[];
  isFetching: boolean;
} {
  const google = hasGooglePlaces();
  const g = useGooglePlaceSearch(google ? query : '');
  const n = usePlaceSearch(google ? '' : query);

  const results: LocationResult[] = google
    ? (g.data ?? []).map((h) => ({
        key: h.placeId,
        name: h.name,
        address: h.address,
        lat: h.lat,
        lng: h.lng,
        country: h.country,
        city: h.city,
      }))
    : (n.data ?? []).map((h) => ({
        key: h.id,
        name: h.name,
        address: h.displayName,
        lat: h.lat,
        lng: h.lng,
        country: h.country,
        city: h.city,
      }));

  return { results, isFetching: google ? g.isFetching : n.isFetching };
}
