import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { flagEmoji } from '@/features/map/geo';
import { KIND_EMOJI } from '@/features/places/kinds';
import { usePlaceSearch, type PlaceHit } from '@/features/places/searchPlaces';
import { addPlace } from '@/features/places/usePlaces';
import { PLACE_KINDS, type PlaceKind, type PlaceStatus } from '@/shared/types/domain';
import { Button, Chip, EmptyState, Glass, Input, Screen } from '@/shared/ui';

const STATUSES: { value: PlaceStatus; label: string }[] = [
  { value: 'saved', label: '🔖 Saved' },
  { value: 'planned', label: '✈ Planned' },
  { value: 'visited', label: '✓ Visited' },
];

/** Search anywhere on Earth (Nominatim, free) and pin it to the map. */
export default function NewPlaceScreen() {
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<PlaceHit | null>(null);
  const [kind, setKind] = useState<PlaceKind>('attraction');
  const [status, setStatus] = useState<PlaceStatus>('saved');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 500);
    return () => clearTimeout(t);
  }, [input]);

  const search = usePlaceSearch(debounced);

  const save = async () => {
    if (!picked?.country) return;
    setSaving(true);
    setError(null);
    try {
      await addPlace({
        name: picked.name,
        kind,
        status,
        coordinates: { lat: picked.lat, lng: picked.lng },
        country: picked.country,
        city: picked.city,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save place.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View className="gap-4 pb-4 pt-4">
        <Text className="text-2xl font-bold text-white">Add a place</Text>
        <Input
          placeholder="Search a restaurant, beach, city…"
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setPicked(null);
          }}
          autoFocus
          autoCorrect={false}
        />
      </View>

      {picked ? (
        <View className="gap-5">
          <Glass>
            <View className="gap-1 p-4">
              <Text className="text-base font-semibold text-white">
                {picked.country ? `${flagEmoji(picked.country)} ` : ''}
                {picked.name}
              </Text>
              <Text className="text-xs text-white/45" numberOfLines={2}>
                {picked.displayName}
              </Text>
            </View>
          </Glass>

          <View className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
              What is it?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {PLACE_KINDS.map((k) => (
                <Chip
                  key={k}
                  label={`${KIND_EMOJI[k]} ${k}`}
                  selected={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
              Status
            </Text>
            <View className="flex-row gap-2">
              {STATUSES.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={status === s.value}
                  onPress={() => setStatus(s.value)}
                />
              ))}
            </View>
          </View>

          {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

          <Button title="Pin to my map" onPress={save} loading={saving} />
        </View>
      ) : (
        <FlatList
          data={search.data ?? []}
          keyExtractor={(hit) => hit.id}
          contentContainerClassName="gap-2 pb-10"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => setPicked(item)}>
              <Glass>
                <View className="gap-0.5 p-4">
                  <Text className="text-sm font-semibold text-white">
                    {item.country ? `${flagEmoji(item.country)} ` : ''}
                    {item.name}
                  </Text>
                  <Text className="text-xs text-white/45" numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </View>
              </Glass>
            </Pressable>
          )}
          ListEmptyComponent={
            search.isFetching ? (
              <View className="items-center py-10">
                <ActivityIndicator color="white" />
              </View>
            ) : search.isError ? (
              <EmptyState
                emoji="📡"
                title="Search failed"
                body="Couldn't reach the place search. Check your connection and try again."
              />
            ) : debounced.trim().length >= 3 ? (
              <EmptyState
                emoji="🧐"
                title="No matches"
                body="Try adding the city — e.g. “Sirocco Rooftop Bangkok”."
              />
            ) : (
              <EmptyState
                emoji="🌍"
                title="Search anywhere on Earth"
                body="Restaurants, beaches, viewpoints, whole cities — type at least 3 letters."
              />
            )
          }
        />
      )}
    </Screen>
  );
}
