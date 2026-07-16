import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { KIND_EMOJI } from '@/features/map/placesToGeoJSON';
import { deleteReel, useCommitReelPlaces, useReel } from '@/features/reels/useReels';
import type { ExtractedPlace } from '@/shared/types/domain';
import { Button, Glass, Screen } from '@/shared/ui';

/**
 * Review screen: the human check between AI extraction and the map.
 * Everything starts selected except low-confidence or un-geocoded places —
 * the user opts *in* to uncertain data rather than having to spot it.
 */
export default function ReelReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: reel } = useReel(id);
  const commit = useCommitReelPlaces();
  const [selected, setSelected] = useState<Set<number> | null>(null);

  const places = reel?.extraction?.places ?? [];

  useEffect(() => {
    if (selected === null && places.length) {
      setSelected(
        new Set(
          places
            .map((p, i) => (p.confidence >= 0.5 && p.coordinates ? i : -1))
            .filter((i) => i >= 0),
        ),
      );
    }
  }, [places.length, selected]);

  if (!reel) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="white" />
        </View>
      </Screen>
    );
  }

  if (reel.status === 'failed') {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-6">
          <Text className="text-center text-5xl">😕</Text>
          <Text className="text-center text-lg font-semibold text-white">
            Couldn't extract places
          </Text>
          <Text className="text-center text-sm leading-5 text-white/50">
            {reel.errorMessage ?? 'Something went wrong with this link.'}
          </Text>
          <Button
            title="Remove this reel"
            variant="danger"
            onPress={async () => {
              await deleteReel(reel.id);
              router.back();
            }}
          />
        </View>
      </Screen>
    );
  }

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const chosen = places.filter((_, i) => selected?.has(i));

  return (
    <Screen>
      <View className="gap-1 pb-4 pt-4">
        <Text className="text-2xl font-bold text-white">Found {places.length} places</Text>
        {reel.extraction?.summary ? (
          <Text className="text-sm leading-5 text-white/50">
            {reel.extraction.summary}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={places}
        keyExtractor={(_, i) => String(i)}
        contentContainerClassName="gap-3 pb-4"
        renderItem={({ item, index }) => (
          <ExtractedPlaceCard
            place={item}
            selected={selected?.has(index) ?? false}
            onToggle={() => toggle(index)}
          />
        )}
      />

      <View className="pb-8 pt-2">
        <Button
          title={
            chosen.length
              ? `Add ${chosen.length} ${chosen.length === 1 ? 'place' : 'places'} to my map`
              : 'Select places to add'
          }
          disabled={!chosen.length}
          loading={commit.isPending}
          onPress={() =>
            commit.mutate(
              { reelId: reel.id, places: chosen },
              { onSuccess: () => router.back() },
            )
          }
        />
      </View>
    </Screen>
  );
}

function ExtractedPlaceCard({
  place,
  selected,
  onToggle,
}: {
  place: ExtractedPlace;
  selected: boolean;
  onToggle: () => void;
}) {
  const unlocated = !place.coordinates;
  const pct = Math.round(place.confidence * 100);

  return (
    <Pressable onPress={onToggle}>
      <Glass>
        <View
          className={`flex-row items-center gap-3 rounded-card border p-4 ${
            selected ? 'border-horizon-400/70' : 'border-transparent'
          }`}
        >
          <Text className="text-2xl">{KIND_EMOJI[place.kind] ?? '📍'}</Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold text-white">{place.name}</Text>
            <Text className="text-xs text-white/45">
              {[place.city, place.country].filter(Boolean).join(', ') || 'Location unknown'}
              {' · '}
              {pct}% sure
            </Text>
            {unlocated ? (
              <Text className="text-xs text-planned">
                ⚠ Couldn't pin this — it will be re-checked when added
              </Text>
            ) : null}
            {place.reasoning ? (
              <Text className="text-xs italic text-white/35" numberOfLines={2}>
                {place.reasoning}
              </Text>
            ) : null}
          </View>
          <View
            className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
              selected ? 'border-horizon-400 bg-horizon-500' : 'border-white/25'
            }`}
          >
            {selected ? <Text className="text-xs text-white">✓</Text> : null}
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}
