import worldCountries from './world-countries.json';

type CountryFeature = {
  properties: { iso: string };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
};

const FEATURES = (worldCountries as { features: CountryFeature[] }).features;

/** Ray-casting point-in-ring test. Ring is GeoJSON [lng, lat] pairs. */
function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(lng: number, lat: number, rings: number[][][]): boolean {
  if (!inRing(lng, lat, rings[0])) return false;
  // Inside the outer ring — but a hole (e.g. Lesotho) excludes the point.
  for (let i = 1; i < rings.length; i++) {
    if (inRing(lng, lat, rings[i])) return false;
  }
  return true;
}

/**
 * Which country was tapped? Linear scan of the bundled 110m polygons —
 * 175 features at tap frequency is well under a millisecond.
 */
export function countryAt(lat: number, lng: number): string | null {
  for (const f of FEATURES) {
    const polys =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;
    for (const rings of polys) {
      if (inPolygon(lng, lat, rings)) return f.properties.iso;
    }
  }
  return null;
}

/** 🇲🇦-style flag from an ISO code via regional indicator symbols. */
export function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0)));
}

/** Country display name; falls back to the ISO code on old runtimes. */
export function countryName(iso: string): string {
  try {
    const names = new Intl.DisplayNames(undefined, { type: 'region' });
    return names.of(iso.toUpperCase()) ?? iso;
  } catch {
    return iso;
  }
}
