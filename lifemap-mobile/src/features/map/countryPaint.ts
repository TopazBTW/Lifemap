import type { LatLng } from 'react-native-maps';

import type { CountryRollup, CountryStatus } from '@/shared/types/domain';

import worldCountries from './world-countries.json';

/**
 * Country fill colours, keyed by rollup status. Mirrors tailwind.config.js
 * (visited/planned/saved) — change both together.
 */
export const COUNTRY_COLORS: Record<Exclude<CountryStatus, 'none'>, string> = {
  visited: '#34C77B',
  planned: '#F2B33D',
  saved: '#2E88E4',
};

/** 40% alpha fills so the basemap labels stay legible underneath. */
const FILL_ALPHA = '66';

type CountryFeature = {
  properties: { iso: string };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
};

export type CountryFill = {
  key: string;
  iso: string;
  color: string;
  /** Outer ring in react-native-maps LatLng order. */
  coordinates: LatLng[];
  /** Inner rings (e.g. Lesotho inside South Africa). */
  holes: LatLng[][];
};

const FEATURES = (worldCountries as { features: CountryFeature[] }).features;

// GeoJSON rings are [lng, lat]; react-native-maps wants {latitude, longitude}.
function ringToLatLng(ring: number[][]): LatLng[] {
  return ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

/**
 * Build the <Polygon> fills for the world map.
 *
 * Unlike the Mapbox build (one GPU `match` expression over a vector tileset),
 * Apple Maps gets native polygon overlays — so we only materialise countries
 * that actually appear in the rollup. A typical user paints 5–40 countries,
 * not 175, which keeps the overlay count trivial.
 */
export function countryFills(rollup: CountryRollup | null | undefined): CountryFill[] {
  if (!rollup) return [];

  const fills: CountryFill[] = [];

  for (const feature of FEATURES) {
    const entry = rollup.countries[feature.properties.iso];
    if (!entry || entry.status === 'none') continue;

    const color = COUNTRY_COLORS[entry.status] + FILL_ALPHA;
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

    for (const [i, rings] of polygons.entries()) {
      fills.push({
        key: `${feature.properties.iso}-${i}`,
        iso: feature.properties.iso,
        color,
        coordinates: ringToLatLng(rings[0]),
        holes: rings.slice(1).map(ringToLatLng),
      });
    }
  }

  return fills;
}
