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
import { useMySpace } from '@/features/couple/useSharedSpace';
import { useSpaceMemories, useSpacePlaces } from '@/features/couple/useSpaceItems';
import { countryFills, COUNTRY_COLORS } from '@/features/map/countryPaint';
import { countryAt, countryName, flagEmoji } from '@/features/map/geo';
import { LocationSheet } from '@/features/map/LocationSheet';
import { MemorySheet } from '@/features/map/MemorySheet';
import { useMarks } from '@/features/map/useMarks';
import { PlaceSheet } from '@/features/map/PlaceSheet';
import { useCountryRollup } from '@/features/map/useCountryRollup';
import { useMapFocus } from '@/features/map/useMapFocus';
import { useMemories } from '@/features/memories/useMemories';
import { useFoodEntries, useStayEntries } from '@/features/passport/usePassport';
import { KIND_EMOJI } from '@/features/places/kinds';
import { usePlaces } from '@/features/places/usePlaces';
import { auth } from '@/shared/lib/firebase';
import { MOODS, type Coordinates, type Place } from '@/shared/types/domain';
import { Glass, Icon } from '@/shared/ui';

/** Colour ring behind a partner's pins so you can tell whose is whose. */
const PARTNER_COLOR = '#E86FB0';

type TappedLocation = {
  iso: string | null;
  coordinate: Coordinates;
  preset?: { city: string; country: string | null };
};

type Layers = {
  places: boolean;
  memories: boolean;
  food: boolean;
  cities: boolean;
};

const STAY_EMOJI: Record<string, string> = {
  hotel: '🏨',
  airbnb: '🏡',
  hostel: '🛏️',
  other: '🏨',
};

/**
 * World Life Map on react-native-maps (Apple Maps on iOS). Country fills derive
 * on-device from the user's data. Layers can be toggled so the map doesn't
 * saturate; clustering collapses pins into city/country bubbles when zoomed out.
 */
export default function WorldMapScreen() {
  const insets = useSafeAreaInsets();
  const { data: places = [] } = usePlaces();
  const { data: memories = [] } = useMemories();
  const { data: food = [] } = useFoodEntries();
  const { data: stays = [] } = useStayEntries();
  const { data: rollup } = useCountryRollup();
  const { cities: cityMarksMap } = useMarks();

  // Couple mode: merge the partner's shared places/memories in, flagged so we
  // can colour them differently.
  const myUid = auth.currentUser?.uid;
  const { space } = useMySpace();
  const { data: spacePlaces = [] } = useSpacePlaces(space?.id);
  const { data: spaceMemories = [] } = useSpaceMemories(space?.id);
  const partnerName = space?.memberIds.find((u) => u !== myUid)
    ? (space?.memberNames?.[space.memberIds.find((u) => u !== myUid)!] ?? 'Partner')
    : null;

  const allPlaces = useMemo(() => {
    const byId = new Map<string, Place>();
    for (const p of places) byId.set(p.id, p);
    for (const p of spacePlaces) byId.set(p.id, p);
    return Array.from(byId.values(), (p) => ({ ...p, isPartner: p.ownerId !== myUid }));
  }, [places, spacePlaces, myUid]);

  const allMemories = useMemo(() => {
    const byId = new Map<string, (typeof memories)[number]>();
    for (const m of memories) byId.set(m.id, m);
    for (const m of spaceMemories) byId.set(m.id, m);
    return Array.from(byId.values(), (m) => ({ ...m, isPartner: m.ownerId !== myUid }));
  }, [memories, spaceMemories, myUid]);

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [tapped, setTapped] = useState<TappedLocation | null>(null);
  const [layers, setLayers] = useState<Layers>({
    places: true,
    memories: true,
    food: true,
    cities: true,
  });
  const toggle = (k: keyof Layers) =>
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  const mapRef = useRef<MapView>(null);
  const focusTarget = useMapFocus((s) => s.target);
  const clearTarget = useMapFocus((s) => s.clearTarget);
  const highlightId = useMapFocus((s) => s.highlightId);
  const clearHighlight = useMapFocus((s) => s.clearHighlight);

  // "Show on map" from a memory: turn memories on, fly in close enough that
  // individual pins (not clusters) render, and open that memory's card — the
  // same state as if the user had tapped its pin.
  useEffect(() => {
    if (!focusTarget) return;
    setLayers((prev) => ({ ...prev, memories: true }));
    mapRef.current?.animateToRegion(
      {
        latitude: focusTarget.lat,
        longitude: focusTarget.lng,
        latitudeDelta: 0.6,
        longitudeDelta: 0.6,
      },
      800,
    );
    if (highlightId?.startsWith('mem-')) {
      setSelectedPlace(null);
      setTapped(null);
      setSelectedMemoryId(highlightId.slice(4));
    }
    clearTarget();
  }, [focusTarget, clearTarget, highlightId]);

  const mappedMemories = useMemo(
    () => (layers.memories ? allMemories.filter((m) => m.coordinates) : []),
    [allMemories, layers.memories],
  );

  // Derived (not stored) so the open card reflects live edits/deletes.
  const selectedMemory = useMemo(
    () => allMemories.find((m) => m.id === selectedMemoryId) ?? null,
    [allMemories, selectedMemoryId],
  );
  const mappedFood = useMemo(
    () => (layers.food ? food.filter((f) => f.coordinates) : []),
    [food, layers.food],
  );
  const mappedStays = useMemo(
    () => (layers.food ? stays.filter((s) => s.coordinates) : []),
    [stays, layers.food],
  );
  const markedCities = useMemo(
    () => (layers.cities ? Object.entries(cityMarksMap) : []),
    [cityMarksMap, layers.cities],
  );

  // Zoom-aware detail: countries → cities → individual pins as you zoom in.
  const [latDelta, setLatDelta] = useState(100);
  const level = zoomLevelFor(latDelta);

  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = [];
    if (layers.places)
      for (const p of allPlaces)
        pts.push({ id: `p-${p.id}`, lat: p.coordinates.lat, lng: p.coordinates.lng, city: p.city, country: p.country });
    for (const m of mappedMemories)
      pts.push({ id: `m-${m.id}`, lat: m.coordinates!.lat, lng: m.coordinates!.lng, city: m.city ?? null, country: m.country ?? null });
    for (const f of mappedFood)
      pts.push({ id: `f-${f.id}`, lat: f.coordinates!.lat, lng: f.coordinates!.lng, city: f.city ?? null, country: f.country ?? null });
    for (const s of mappedStays)
      pts.push({ id: `s-${s.id}`, lat: s.coordinates!.lat, lng: s.coordinates!.lng, city: s.city ?? null, country: s.country ?? null });
    return pts;
  }, [allPlaces, mappedMemories, mappedFood, mappedStays, layers.places]);

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
          if (highlightId) clearHighlight();
          if (selectedMemoryId) {
            setSelectedMemoryId(null);
            return;
          }
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

        {/* Marked cities: coloured pills, shown when not at country zoom. */}
        {level !== 'country' &&
          markedCities.map(([key, c]) => (
            <Marker
              // key encodes status so tracksViewChanges={false} still refreshes
              // the pill when it changes (see the comment on the cluster marker).
              key={`city-${key}-${c.status}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={false}
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
                    c.status === 'visited' ? COUNTRY_COLORS.visited : COUNTRY_COLORS.planned,
                }}
              >
                <Text className="text-xs font-semibold text-white">
                  {c.status === 'visited' ? '✓' : '✈'} {c.name}
                </Text>
              </View>
            </Marker>
          ))}

        {/* Individual pins only when zoomed in; otherwise cluster bubbles. */}
        {level === 'individual' && layers.places &&
          allPlaces.map((place) => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.coordinates.lat, longitude: place.coordinates.lng }}
              tracksViewChanges={false}
              onPress={(e) => {
                e.stopPropagation();
                setTapped(null);
                setSelectedPlace(place);
              }}
            >
              <PinBadge emoji={KIND_EMOJI[place.kind] ?? '📍'} partner={place.isPartner} />
            </Marker>
          ))}

        {level === 'individual' &&
          mappedMemories.map((memory) => {
            const highlighted =
              highlightId === `mem-${memory.id}` || selectedMemoryId === memory.id;
            return (
              <Marker
                // Remount on highlight change: tracksViewChanges={false} freezes
                // the rendered marker, so it wouldn't pick up the callout.
                key={`mem-${memory.id}-${highlighted}`}
                coordinate={{ latitude: memory.coordinates!.lat, longitude: memory.coordinates!.lng }}
                tracksViewChanges={false}
                zIndex={highlighted ? 10 : undefined}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedPlace(null);
                  setTapped(null);
                  setSelectedMemoryId(memory.id);
                }}
              >
                <View className="items-center">
                  {highlighted ? (
                    <View className="mb-0.5 max-w-40 rounded-pill border border-white/25 bg-horizon-500 px-2.5 py-1">
                      <Text
                        className="text-[11px] font-semibold text-white"
                        numberOfLines={1}
                      >
                        {memory.title}
                      </Text>
                    </View>
                  ) : null}
                  <PinBadge
                    emoji={MOODS.find((x) => x.value === memory.mood)?.emoji ?? '📸'}
                    partner={memory.isPartner}
                    highlighted={highlighted}
                  />
                </View>
              </Marker>
            );
          })}

        {level === 'individual' &&
          mappedFood.map((f) => (
            <Marker
              key={`food-${f.id}`}
              coordinate={{ latitude: f.coordinates!.lat, longitude: f.coordinates!.lng }}
              tracksViewChanges={false}
              title={f.restaurantName}
              description={`${'⭐'.repeat(f.rating)}${f.dish ? ` · ${f.dish}` : ''}`}
            >
              <Text style={{ fontSize: 22 }}>🍜</Text>
            </Marker>
          ))}

        {level === 'individual' &&
          mappedStays.map((s) => (
            <Marker
              key={`stay-${s.id}`}
              coordinate={{ latitude: s.coordinates!.lat, longitude: s.coordinates!.lng }}
              tracksViewChanges={false}
              title={s.name}
              description={'⭐'.repeat(s.rating)}
            >
              <Text style={{ fontSize: 22 }}>{STAY_EMOJI[s.kind] ?? '🏨'}</Text>
            </Marker>
          ))}

        {clusters.map((c) => (
          <Marker
            // tracksViewChanges={false} stops iOS re-snapshotting the bubble
            // every frame (a native memory leak that crashes the map). The
            // count is in the key so the bubble remounts when it changes.
            key={`${level}-${c.key}-${c.count}`}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            tracksViewChanges={false}
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
      <View pointerEvents="box-none" className="absolute inset-x-4" style={{ top: insets.top + 8 }}>
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

      {/* Layer toggles */}
      <View pointerEvents="box-none" className="absolute left-4" style={{ bottom: insets.bottom + 92 }}>
        <Glass>
          <View className="gap-1 p-2">
            <LayerToggle emoji="📍" label="Places" on={layers.places} onPress={() => toggle('places')} />
            <LayerToggle emoji="📸" label="Memories" on={layers.memories} onPress={() => toggle('memories')} />
            <LayerToggle emoji="🍽️" label="Food & stays" on={layers.food} onPress={() => toggle('food')} />
            <LayerToggle emoji="🏙️" label="Cities" on={layers.cities} onPress={() => toggle('cities')} />
            {partnerName ? (
              <View className="mt-1 flex-row items-center gap-2 border-t border-white/10 px-2 pt-2">
                <View
                  className="h-3 w-3 rounded-full border-2"
                  style={{ borderColor: PARTNER_COLOR }}
                />
                <Text className="text-[11px] text-white/60">{partnerName}’s pins</Text>
              </View>
            ) : null}
          </View>
        </Glass>
      </View>

      {/* Add place FAB */}
      <Pressable
        onPress={() => router.push('/place/new')}
        className="absolute bottom-28 right-5 h-14 w-14 items-center justify-center rounded-full bg-horizon-500 shadow-lg"
        accessibilityLabel="Add a place"
      >
        <Icon name="plus" size={26} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      {selectedMemory ? (
        <MemorySheet
          memory={selectedMemory}
          partnerName={partnerName}
          onClose={() => {
            setSelectedMemoryId(null);
            clearHighlight();
          }}
        />
      ) : selectedPlace ? (
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

/**
 * A map pin's emoji. Ringed pink when it's the partner's, and ringed + enlarged
 * when it's the pin the user asked to be shown ("Show on map").
 */
function PinBadge({
  emoji,
  partner,
  highlighted = false,
}: {
  emoji: string;
  partner: boolean;
  highlighted?: boolean;
}) {
  if (!partner && !highlighted) return <Text style={{ fontSize: 26 }}>{emoji}</Text>;
  const ring = partner ? PARTNER_COLOR : '#2E88E4';
  return (
    <View
      style={{
        padding: highlighted ? 4 : 2,
        borderRadius: 999,
        borderWidth: highlighted ? 3 : 2,
        borderColor: ring,
        backgroundColor: partner ? 'rgba(232,111,176,0.22)' : 'rgba(46,136,228,0.28)',
      }}
    >
      <Text style={{ fontSize: highlighted ? 26 : 22 }}>{emoji}</Text>
    </View>
  );
}

function LayerToggle({
  emoji,
  label,
  on,
  onPress,
}: {
  emoji: string;
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-xl px-2 py-1.5 ${on ? 'bg-white/10' : ''}`}
    >
      <Text className="text-sm" style={{ opacity: on ? 1 : 0.35 }}>{emoji}</Text>
      <Text className={`text-xs ${on ? 'text-white' : 'text-white/35'}`}>{label}</Text>
    </Pressable>
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
