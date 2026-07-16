import type { FeatureCollection, Point } from 'geojson';

import { toGeoJSONPosition, type Place, type PlaceKind } from '@/shared/types/domain';

export const KIND_EMOJI: Record<PlaceKind, string> = {
  restaurant: '🍜',
  hotel: '🏨',
  airbnb: '🏡',
  beach: '🏖️',
  attraction: '🎡',
  viewpoint: '🌄',
  bar: '🍸',
  cafe: '☕',
  trail: '🥾',
  other: '📍',
};

export function placesToGeoJSON(places: Place[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      id: p.id,
      geometry: {
        type: 'Point',
        // GeoJSON is [lng, lat] — always via the helper.
        coordinates: toGeoJSONPosition(p.coordinates),
      },
      properties: {
        id: p.id,
        name: p.name,
        kind: p.kind,
        status: p.status,
        emoji: KIND_EMOJI[p.kind] ?? '📍',
      },
    })),
  };
}
