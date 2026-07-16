export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
};

export type Cluster = {
  key: string;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  count: number;
};

export type ZoomLevel = 'country' | 'city' | 'individual';

/**
 * Which detail level to show for a given map zoom (region latitudeDelta):
 * zoomed way out → group by country, mid → group by city, close → individual
 * pins. This is the "show cities more precisely as I zoom in" behaviour.
 */
export function zoomLevelFor(latitudeDelta: number): ZoomLevel {
  if (latitudeDelta > 25) return 'country';
  if (latitudeDelta > 6) return 'city';
  return 'individual';
}

/** Group points by country or city and return one centroid bubble per group. */
export function clusterPoints(
  points: MapPoint[],
  level: 'country' | 'city',
): Cluster[] {
  const groups = new Map<string, MapPoint[]>();
  for (const p of points) {
    const key =
      level === 'country'
        ? (p.country ?? '??')
        : p.city
          ? `${p.city}|${p.country ?? ''}`
          : (p.country ?? '??');
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  return Array.from(groups, ([key, pts]) => {
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return {
      key,
      city: level === 'city' ? pts[0].city : null,
      country: pts[0].country,
      lat,
      lng,
      count: pts.length,
    };
  });
}
