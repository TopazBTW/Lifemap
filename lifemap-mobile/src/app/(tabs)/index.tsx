import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  clusterPoints,
  zoomLevelFor,
  type MapPoint,
} from '@/features/map/cluster';
import { countryFills, COUNTRY_COLORS } from '@/features/map/countryPaint';
import { countryAt, countryName, flagEmoji } from '@/features/map/geo';
import { LocationSheet } from '@/features/map/LocationSheet';
import { PlaceSheet } from '@/features/map/PlaceSheet';
import { useCityMarks } from '@/features/map/useCityMarks';
import { useCountryRollup } from '@/features/map/useCountryRollup';
import { useMapFocus } from '@/features/map/useMapFocus';
import { useMemories } from '@/features/memories/useMemories';
import { KIND_EMOJI } from '@/features/places/kinds';
import { usePlaces } from '@/features/places/usePlaces';
import { MOODS, type Coordinates, type Place } from '@/shared/types/domain';
import { Glass } from '@/shared/ui';

type TappedLocation = {
  iso: string | null;
  coordinate: Coordinates;
  preset?: { city: string; country: string | null };
};

/**
 * World Life Map on react-native-maps (Apple Maps on iOS) — runs in Expo Go
 * with no API keys. Country fills derive on-device from the user's data
 * (see useCountryRollup); tapping a country opens its status sheet, tapping
 * a pin opens the place sheet.
 */
export default function WorldMapScreen() {
  const insets = useSafeAreaInsets();
  const { data: places = [] } = usePlaces();
  const { data: memories = [] } = useMemories();
  const { data: rollup } = useCountryRollup();
  const { data: cityMarks } = useCityMarks();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [tapped, setTapped] = useState<TappedLocation | null>(null);

  const mapRef = useRef<MapView>(null);
  const focusTarget = useMapFocus((s) => s.target);
  const clearFocus = useMapFocus((s) => s.clear);

  // "Show on map" from a memory: fly to the target once, then clear it.
  useEffect(() => {
    if (!focusTarget) return;
    mapRef.current?.animateToRegion(
      {
        latitude: focusTarget.lat,
        longitude: focusTarget.lng,
        latitudeDelta: 4,
        longitudeDelta: 4,
      },
      800,
    );
    clearFocus();
  }, [focusTarget, clearFocus]);

  const mappedMemories = useMemo(
    () => memories.filter((m) => m.coordinates),
    [memories],
  );

  const markedCities = useMemo(
    () => Object.entries(cityMarks?.cities ?? {}),
    [cityMarks],
  );

  // Zoom-aware detail: countries → cities → individual pins as you zoom in.
  const [latDelta, setLatDelta] = useState(100);
  const level = zoomLevelFor(latDelta);

  const points = useMemo<MapPoint[]>(
    () => [
      ...places.map((p) => ({
        id: `p-${p.id}`,
        lat: p.coordinates.lat,
        lng: p.coordinates.lng,
        city: p.city,
        country: p.country,
      })),
      ...mappedMemories.map((m) => ({
        id: `m-${m.id}`,
        lat: m.coordinates!.lat,
        lng: m.coordinates!.lng,
        city: m.city ?? null,
        country: m.country ?? null,
      })),
    ],
    [places, mappedMemories],
  );

  const clusters = useMemo(
    () => (level === 'individual' ? [] : clusterPoints(points, level)),
    [points, level],
  );

  const zoomToCluster = (lat: number, lng: number) => {
    const delta = level === 'country' ? 7 : 1.5;
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
      600,
    );
  };

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
        ref={mapRef}
        style={{ flex: 1 }}
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: 25,
          longitude: 10,
          latitudeDelta: 100,
          longitudeDelta: 120,
        }}
        onRegionChangeComplete={(r) => setLatDelta(r.latitudeDelta)}
        onPress={(e) => {
          // A pin tap also fires the map press on iOS; the marker handler
          // runs first and sets selectedPlace — don't fight it.
          if (selectedPlace) {
            setSelectedPlace(null);
            return;
          }
          if (tapped) {
            setTapped(null);
            return;
          }
          const { latitude, longitude } = e.nativeEvent.coordinate;
          setTapped({
            iso: countryAt(latitude, longitude),
            coordinate: { lat: latitude, lng: longitude },
          });
        }}
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
            tappable={false}
          />
        ))}

        {/* Individual pins only when zoomed in; otherwise city/country bubbles. */}
        {level === 'individual' &&
          places.map((place) => (
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
                setTapped(null);
                setSelectedPlace(place);
              }}
            >
              <Text style={{ fontSize: 26 }}>{KIND_EMOJI[place.kind] ?? '📍'}</Text>
            </Marker>
          ))}

        {/* Marked cities: coloured pills, shown when not at country zoom. */}
        {level !== 'country' &&
          markedCities.map(([key, c]) => (
            <Marker
              key={`city-${key}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedPlace(null);
                setTapped({
                  iso: c.country,
                  coordinate: { lat: c.lat, lng: c.lng },
                  preset: { city: c.name, country: c.country },
                });
              }}
            >
              <View
                className="rounded-pill border border-white/25 px-2.5 py-1"
                style={{
                  backgroundColor:
                    c.status === 'visited'
                      ? COUNTRY_COLORS.visited
                      : COUNTRY_COLORS.planned,
                }}
              >
                <Text className="text-xs font-semibold text-white">
                  {c.status === 'visited' ? '✓' : '✈'} {c.name}
                </Text>
              </View>
            </Marker>
          ))}

        {level === 'individual' &&
          mappedMemories.map((memory) => (
            <Marker
              key={`mem-${memory.id}`}
              coordinate={{
                latitude: memory.coordinates!.lat,
                longitude: memory.coordinates!.lng,
              }}
              tracksViewChanges={false}
              onPress={(e) => {
                e.stopPropagation();
                router.push({ pathname: '/memory/[id]', params: { id: memory.id } });
              }}
            >
              <Text style={{ fontSize: 24 }}>
                {MOODS.find((x) => x.value === memory.mood)?.emoji ?? '📸'}
              </Text>
            </Marker>
          ))}

        {clusters.map((c) => (
          <Marker
            key={`${level}-${c.key}`}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            onPress={(e) => {
              e.stopPropagation();
              zoomToCluster(c.lat, c.lng);
            }}
          >
            <View className="flex-row items-center gap-1.5 rounded-pill border border-white/25 bg-ink-800/95 px-2.5 py-1">
              <Text className="text-xs font-semibold text-white">
                {level === 'country'
                  ? c.country
                    ? `${flagEmoji(c.country)} ${countryName(c.country)}`
                    : 'Somewhere'
                  : (c.city ?? (c.country ? countryName(c.country) : 'Somewhere'))}
              </Text>
              <View className="rounded-full bg-horizon-500 px-1.5">
                <Text className="text-[11px] font-bold text-white">{c.count}</Text>
              </View>
            </View>
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
        <Text className="pt-2 text-center text-xs text-white/40">
          {level === 'individual'
            ? 'Tap the map to mark a city or country · tap a pin for details'
            : 'Tap a bubble to zoom in · pinch to see cities & pins'}
        </Text>
      </View>

      {/* Legend */}
      <View
        pointerEvents="none"
        className="absolute left-4"
        style={{ bottom: insets.bottom + 92 }}
      >
        <Glass>
          <View className="gap-1.5 px-3 py-2.5">
            <LegendRow emoji="📍" label="Saved places" />
            <LegendRow emoji="📸" label="Memories" />
          </View>
        </Glass>
      </View>

      {/* Add place FAB */}
      <Pressable
        onPress={() => router.push('/place/new')}
        className="absolute bottom-28 right-5 h-14 w-14 items-center justify-center rounded-full bg-horizon-500 shadow-lg"
        accessibilityLabel="Add a place"
      >
        <Text className="text-2xl text-white">＋</Text>
      </Pressable>

      {selectedPlace ? (
        <PlaceSheet place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      ) : tapped ? (
        <LocationSheet
          iso={tapped.iso}
          coordinate={tapped.coordinate}
          preset={tapped.preset}
          onClose={() => setTapped(null)}
        />
      ) : null}
    </View>
  );
}

function LegendRow({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-sm">{emoji}</Text>
      <Text className="text-xs text-white/60">{label}</Text>
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
