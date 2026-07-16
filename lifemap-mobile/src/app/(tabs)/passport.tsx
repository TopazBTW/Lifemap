import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { useEnrichment } from '@/features/passport/enrich';
import { useGooglePlaceDetails } from '@/features/passport/googlePlaces';
import {
  deleteFoodEntry,
  deleteStayEntry,
  useFoodEntries,
  useStayEntries,
} from '@/features/passport/usePassport';
import type { FoodEntry, StayEntry } from '@/shared/types/domain';
import { Button, Chip, EmptyState, Glass, Rating, Screen } from '@/shared/ui';

/**
 * The establishment's official photo, fetched **live** (Google by placeId,
 * else Wikipedia by name) — never read from Firestore. React Query caches it
 * per session so a scroll doesn't refetch.
 */
function useOfficialPhoto(googlePlaceId: string | null | undefined, name: string) {
  const google = useGooglePlaceDetails(googlePlaceId);
  const wiki = useEnrichment(googlePlaceId ? null : name);
  return google.data?.photoUrls[0] ?? wiki.data?.imageUrl ?? null;
}

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
          size="sm"
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
  const official = useOfficialPhoto(entry.googlePlaceId, entry.restaurantName);
  const banner = official ?? entry.photos[0] ?? null;
  const strip = official ? entry.photos : entry.photos.slice(1);
  return (
    <Pressable onLongPress={() => confirmDelete(entry.restaurantName, () => deleteFoodEntry(entry.id))}>
      <Glass>
        {banner ? (
          <Image
            source={{ uri: banner }}
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
          <PhotoStrip photos={strip} />
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
  const official = useOfficialPhoto(entry.googlePlaceId, entry.name);
  const banner = official ?? entry.photos[0] ?? null;
  const strip = official ? entry.photos : entry.photos.slice(1);
  return (
    <Pressable onLongPress={() => confirmDelete(entry.name, () => deleteStayEntry(entry.id))}>
      <Glass>
        {banner ? (
          <Image
            source={{ uri: banner }}
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
          <PhotoStrip photos={strip} />
        </View>
      </Glass>
    </Pressable>
  );
}

/** The user's own photos, in a small horizontal row below the banner. */
function PhotoStrip({ photos }: { photos: string[] }) {
  if (!photos.length) return null;
  return (
    <View className="flex-row gap-2 pt-1">
      {photos.map((uri) => (
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
