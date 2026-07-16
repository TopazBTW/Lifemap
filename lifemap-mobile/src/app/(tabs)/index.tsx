import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
  VectorSource,
} from '@rnmapbox/maps';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  countryFillExpression,
  COUNTRY_COLORS,
  WORLDVIEW_FILTER,
} from '@/features/map/countryPaint';
import { PlaceSheet } from '@/features/map/PlaceSheet';
import { placesToGeoJSON } from '@/features/map/placesToGeoJSON';
import { useCountryRollup } from '@/features/map/useCountryRollup';
import { usePlaces } from '@/features/places/usePlaces';
import { env } from '@/shared/lib/env';
import type { Place } from '@/shared/types/domain';
import { Glass } from '@/shared/ui';

Mapbox.setAccessToken(env.mapboxPublicToken);

export default function WorldMapScreen() {
  const insets = useSafeAreaInsets();
  const { data: places = [] } = usePlaces();
  const { data: rollup } = useCountryRollup();
  const [selected, setSelected] = useState<Place | null>(null);

  const pinsGeoJSON = useMemo(() => placesToGeoJSON(places), [places]);
  const fillColor = useMemo(() => countryFillExpression(rollup), [rollup]);

  const stats = useMemo(() => {
    const counts = { visited: 0, planned: 0, saved: 0 };
    for (const entry of Object.values(rollup?.countries ?? {})) {
      if (entry.status !== 'none') counts[entry.status] += 1;
    }
    return counts;
  }, [rollup]);

  return (
    <View className="flex-1 bg-ink-950">
      <MapView
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Dark}
        logoEnabled={false}
        attributionPosition={{ bottom: 8, left: 8 }}
        scaleBarEnabled={false}
      >
        <Camera
          defaultSettings={{ centerCoordinate: [10, 25], zoomLevel: 1.2 }}
          animationMode="none"
        />

        {/* Country fills from the server-maintained rollup. */}
        <VectorSource id="countries" url="mapbox://mapbox.country-boundaries-v1">
          <FillLayer
            id="country-fills"
            sourceLayerID="country_boundaries"
            filter={WORLDVIEW_FILTER as never}
            style={{
              fillColor: fillColor as never,
              fillOpacity: 0.32,
            }}
          />
        </VectorSource>

        {/* Saved-place pins, clustered so dense cities stay readable. */}
        <ShapeSource
          id="places"
          shape={pinsGeoJSON}
          cluster
          clusterRadius={44}
          onPress={(e) => {
            const feature = e.features[0];
            const id = feature?.properties?.id as string | undefined;
            if (!id) return; // cluster tap — let the camera handle it
            const place = places.find((p) => p.id === id);
            if (place) setSelected(place);
          }}
        >
          <CircleLayer
            id="place-clusters"
            filter={['has', 'point_count']}
            style={{
              circleColor: COUNTRY_COLORS.saved,
              circleOpacity: 0.85,
              circleRadius: ['step', ['get', 'point_count'], 14, 10, 18, 25, 24] as never,
            }}
          />
          <SymbolLayer
            id="place-cluster-count"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'] as never,
              textSize: 12,
              textColor: '#FFFFFF',
            }}
          />
          <SymbolLayer
            id="place-pins"
            filter={['!', ['has', 'point_count']]}
            style={{
              textField: ['get', 'emoji'] as never,
              textSize: 22,
              textAllowOverlap: true,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Stats header */}
      <View
        pointerEvents="box-none"
        className="absolute inset-x-4"
        style={{ top: insets.top + 8 }}
      >
        <Glass intensity={50}>
          <View className="flex-row items-center justify-between px-5 py-3.5">
            <Text className="text-base font-bold text-white">My World</Text>
            <View className="flex-row gap-4">
              <Stat color={COUNTRY_COLORS.visited} label="Visited" value={stats.visited} />
              <Stat color={COUNTRY_COLORS.planned} label="Planned" value={stats.planned} />
              <Stat color={COUNTRY_COLORS.saved} label="Saved" value={stats.saved} />
            </View>
          </View>
        </Glass>
      </View>

      {selected ? (
        <PlaceSheet place={selected} onClose={() => setSelected(null)} />
      ) : null}
    </View>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-sm font-semibold text-white">{value}</Text>
      <Text className="text-xs text-white/45">{label}</Text>
    </View>
  );
}
