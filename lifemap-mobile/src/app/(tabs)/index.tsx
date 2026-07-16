import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countryFills, COUNTRY_COLORS } from '@/features/map/countryPaint';
import { PlaceSheet } from '@/features/map/PlaceSheet';
import { useCountryRollup } from '@/features/map/useCountryRollup';
import { KIND_EMOJI } from '@/features/places/kinds';
import { usePlaces } from '@/features/places/usePlaces';
import type { Place } from '@/shared/types/domain';
import { Glass } from '@/shared/ui';

/**
 * World Life Map on react-native-maps (Apple Maps on iOS) — runs in Expo Go
 * with no API keys. Country fills come from the server-maintained rollup,
 * rendered as native polygon overlays for just the countries the user has
 * touched (see countryPaint.ts).
 */
export default function WorldMapScreen() {
  const insets = useSafeAreaInsets();
  const { data: places = [] } = usePlaces();
  const { data: rollup } = useCountryRollup();
  const [selected, setSelected] = useState<Place | null>(null);

  const fills = useMemo(() => countryFills(rollup), [rollup]);

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
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: 25,
          longitude: 10,
          latitudeDelta: 100,
          longitudeDelta: 120,
        }}
        onPress={() => setSelected(null)}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {fills.map((fill) => (
          <Polygon
            key={fill.key}
            coordinates={fill.coordinates}
            holes={fill.holes.length ? fill.holes : undefined}
            fillColor={fill.color}
            strokeColor="rgba(255,255,255,0.18)"
            strokeWidth={1}
          />
        ))}

        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{
              latitude: place.coordinates.lat,
              longitude: place.coordinates.lng,
            }}
            // Emoji markers re-render once, then freeze — without this Android
            // re-rasterises every marker on every frame.
            tracksViewChanges={false}
            onPress={(e) => {
              e.stopPropagation();
              setSelected(place);
            }}
          >
            <Text style={{ fontSize: 26 }}>{KIND_EMOJI[place.kind] ?? '📍'}</Text>
          </Marker>
        ))}
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
