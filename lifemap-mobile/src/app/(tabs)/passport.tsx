import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import {
  deleteFoodEntry,
  deleteStayEntry,
  useFoodEntries,
  useStayEntries,
} from '@/features/passport/usePassport';
import type { FoodEntry, StayEntry } from '@/shared/types/domain';
import { Button, Chip, EmptyState, Glass, Rating, Screen } from '@/shared/ui';

type Section = 'food' | 'stays';

const STAY_EMOJI: Record<string, string> = {
  hotel: '🏨',
  airbnb: '🏡',
  hostel: '🛏️',
  other: '🏨',
};

export default function PassportScreen() {
  const [section, setSection] = useState<Section>('food');

  return (
    <Screen>
      <View className="flex-row items-center justify-between pb-4 pt-2">
        <Text className="text-3xl font-bold text-white">Passports</Text>
        <Button
          title="＋ Add"
          variant="ghost"
          className="h-10 px-4 py-2"
          onPress={() =>
            router.push({
              pathname: '/establishment/new',
              params: { kind: section === 'food' ? 'food' : 'stay' },
            })
          }
        />
      </View>

      <View className="flex-row gap-2 pb-4">
        <Chip label="🍜 Food" selected={section === 'food'} onPress={() => setSection('food')} />
        <Chip label="🏨 Stays" selected={section === 'stays'} onPress={() => setSection('stays')} />
      </View>

      {section === 'food' ? <FoodPassport /> : <StayPassport />}
    </Screen>
  );
}

function confirmDelete(name: string, onConfirm: () => void) {
  Alert.alert('Remove', `Remove “${name}” from your passport?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onConfirm },
  ]);
}

// ─── Food ─────────────────────────────────────────────────────────────────────

function FoodPassport() {
  const { data: entries = [], isLoading } = useFoodEntries();

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerClassName="gap-3 pb-32"
      renderItem={({ item }) => <FoodCard entry={item} />}
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState
            emoji="🍜"
            title="Your food passport is empty"
            body="Tap “＋ Add”, search a restaurant, and log your rating, review and photos."
          />
        )
      }
    />
  );
}

function FoodCard({ entry }: { entry: FoodEntry }) {
  const cover = entry.photos[0] ?? entry.enrichment?.coverImageUrl ?? null;
  return (
    <Pressable onLongPress={() => confirmDelete(entry.restaurantName, () => deleteFoodEntry(entry.id))}>
      <Glass>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={{ width: '100%', height: 160 }}
            contentFit="cover"
            transition={200}
          />
        ) : null}
        <View className="gap-1 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
              🍜 {entry.restaurantName}
            </Text>
            <Rating value={entry.rating} size="sm" />
          </View>
          <Text className="text-xs text-white/45">
            {[entry.dish, entry.city, entry.country].filter(Boolean).join(' · ') || '—'}
          </Text>
          {entry.review ? (
            <Text className="pt-0.5 text-sm leading-5 text-white/65" numberOfLines={3}>
              {entry.review}
            </Text>
          ) : null}
          <PhotoStrip photos={entry.photos} />
        </View>
      </Glass>
    </Pressable>
  );
}

// ─── Stays ────────────────────────────────────────────────────────────────────

function StayPassport() {
  const { data: entries = [], isLoading } = useStayEntries();

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerClassName="gap-3 pb-32"
      renderItem={({ item }) => <StayCard entry={item} />}
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState
            emoji="🏨"
            title="No stays logged"
            body="Tap “＋ Add”, search a hotel or Airbnb, and keep your own review and photos."
          />
        )
      }
    />
  );
}

function StayCard({ entry }: { entry: StayEntry }) {
  const cover = entry.photos[0] ?? entry.enrichment?.coverImageUrl ?? null;
  return (
    <Pressable onLongPress={() => confirmDelete(entry.name, () => deleteStayEntry(entry.id))}>
      <Glass>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={{ width: '100%', height: 160 }}
            contentFit="cover"
            transition={200}
          />
        ) : null}
        <View className="gap-1 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
              {STAY_EMOJI[entry.kind] ?? '🏨'} {entry.name}
            </Text>
            <Rating value={entry.rating} size="sm" />
          </View>
          <Text className="text-xs text-white/45">
            {[entry.city, entry.country].filter(Boolean).join(' · ') || '—'}
          </Text>
          {entry.review ? (
            <Text className="pt-0.5 text-sm leading-5 text-white/65" numberOfLines={3}>
              {entry.review}
            </Text>
          ) : null}
          <PhotoStrip photos={entry.photos} />
        </View>
      </Glass>
    </Pressable>
  );
}

/** Extra user photos beyond the cover, in a small horizontal row. */
function PhotoStrip({ photos }: { photos: string[] }) {
  if (photos.length <= 1) return null;
  return (
    <View className="flex-row gap-2 pt-1">
      {photos.slice(1).map((uri) => (
        <Image
          key={uri}
          source={{ uri }}
          style={{ width: 56, height: 56, borderRadius: 10 }}
          contentFit="cover"
        />
      ))}
    </View>
  );
}
