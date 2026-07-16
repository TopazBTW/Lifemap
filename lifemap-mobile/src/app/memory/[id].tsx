import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { countryName, flagEmoji } from '@/features/map/geo';
import { useMapFocus } from '@/features/map/useMapFocus';
import {
  deleteMemory,
  updateMemoryLocation,
  useMemory,
} from '@/features/memories/useMemories';
import { LocationPicker } from '@/features/places/LocationPicker';
import { MOODS } from '@/shared/types/domain';
import { Button, Glass, Rating, Screen } from '@/shared/ui';

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: memory } = useMemory(id);
  const { width } = useWindowDimensions();
  const focusOn = useMapFocus((s) => s.focusOn);
  const [editingLocation, setEditingLocation] = useState(false);

  if (!memory) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="white" />
        </View>
      </Screen>
    );
  }

  const mood = MOODS.find((m) => m.value === memory.mood);
  const date = memory.occurredAt?.toDate?.();
  const photos = memory.media.filter((m) => m.type === 'photo');
  const galleryW = width - 40; // Screen has 20px horizontal padding

  const showOnMap = () => {
    if (!memory.coordinates) return;
    focusOn(memory.coordinates);
    router.dismissAll();
    router.navigate('/');
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 pb-12 pt-2">
        <Button title="✕ Close" variant="ghost" size="sm" onPress={() => router.back()} />

        {/* Gallery */}
        {photos.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            className="rounded-card"
          >
            {photos.map((p) => (
              <Image
                key={p.storagePath + p.downloadUrl.slice(-16)}
                source={{ uri: p.downloadUrl }}
                style={{ width: galleryW, height: galleryW, borderRadius: 20 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        ) : null}

        <View className="gap-1">
          <Text className="text-2xl font-bold text-white">
            {mood ? `${mood.emoji} ` : ''}
            {memory.title}
          </Text>
          <Text className="text-sm text-white/45">
            {[
              date?.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
              memory.city,
              memory.country ? countryName(memory.country) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {memory.rating ? <Rating value={memory.rating} size="md" /> : null}

        {memory.note ? (
          <Text className="text-base leading-6 text-white/80">{memory.note}</Text>
        ) : null}

        {/* Location */}
        <Glass>
          <View className="gap-3 p-4">
            <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
              Location
            </Text>
            {memory.coordinates ? (
              <Text className="text-sm text-white/80">
                {memory.country ? `${flagEmoji(memory.country)} ` : '📍 '}
                {[memory.city, memory.country ? countryName(memory.country) : null]
                  .filter(Boolean)
                  .join(', ') || 'Pinned'}
              </Text>
            ) : (
              <Text className="text-sm text-white/50">No location set yet.</Text>
            )}

            {editingLocation ? (
              <LocationPicker
                placeholder="Search where this happened…"
                onPick={async (r) => {
                  await updateMemoryLocation(memory.id, {
                    coordinates: { lat: r.lat, lng: r.lng },
                    country: r.country,
                    city: r.city,
                  });
                  setEditingLocation(false);
                }}
              />
            ) : (
              <View className="flex-row gap-2">
                {memory.coordinates ? (
                  <Button title="📍 Show on map" variant="ghost" size="sm" onPress={showOnMap} />
                ) : null}
                <Button
                  title={memory.coordinates ? 'Change location' : 'Set location'}
                  variant="ghost"
                  size="sm"
                  onPress={() => setEditingLocation(true)}
                />
              </View>
            )}
          </View>
        </Glass>

        <Button
          title="Delete memory"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete', 'Delete this memory for good?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteMemory(memory.id);
                  router.back();
                },
              },
            ])
          }
        />
      </ScrollView>
    </Screen>
  );
}
