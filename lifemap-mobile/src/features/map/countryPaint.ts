import type { CountryRollup, CountryStatus } from '@/shared/types/domain';

/**
 * Country fill colours, keyed by rollup status. Mirrors tailwind.config.js
 * (visited/planned/saved) — change both together.
 */
export const COUNTRY_COLORS: Record<Exclude<CountryStatus, 'none'>, string> = {
  visited: '#34C77B',
  planned: '#F2B33D',
  saved: '#2E88E4',
};

const TRANSPARENT = 'rgba(0,0,0,0)';

/**
 * Build the fill-color expression for the world map's country layer.
 *
 * One data-driven `match` over `iso_3166_1`, **not** a layer per country:
 * Mapbox evaluates a match in the GPU style pass, whereas 50 filtered layers
 * mean 50 style-layer traversals per frame and a visible hitch on mid-range
 * Android as soon as a user has real travel history. This also lets a rollup
 * update repaint the whole world with a single setStyle diff.
 */
export function countryFillExpression(rollup: CountryRollup | null | undefined) {
  const pairs: (string | string[])[] = [];

  if (rollup) {
    for (const [iso, entry] of Object.entries(rollup.countries)) {
      if (entry.status === 'none') continue;
      pairs.push(iso, COUNTRY_COLORS[entry.status]);
    }
  }

  // `match` needs at least one branch; degenerate rollups fall back to a
  // constant so we never hand Mapbox an invalid expression.
  if (pairs.length === 0) return TRANSPARENT;

  return ['match', ['get', 'iso_3166_1'], ...pairs, TRANSPARENT];
}

/** Worldview filter: render each country once, using the US worldview. */
export const WORLDVIEW_FILTER = [
  'all',
  ['==', ['get', 'disputed'], 'false'],
  ['any', ['==', 'all', ['get', 'worldview']], ['in', 'US', ['get', 'worldview']]],
];
