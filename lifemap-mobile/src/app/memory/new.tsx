import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  useCreateMemory,
  type NewMemoryMedia,
} from '@/features/memories/useMemories';
import { MOODS, type Coordinates, type Mood } from '@/shared/types/domain';
import { Button, Chip, Glass, Input, Rating, Screen } from '@/shared/ui';

export default function NewMemoryScreen() {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<Mood | undefined>();
  const [rating, setRating] = useState(0);
  const [media, setMedia] = useState<NewMemoryMedia[]>([]);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateMemory();

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.85,
    });
    if (result.canceled) return;
    setMedia((prev) => [
      ...prev,
      ...result.assets.map((a) => ({
        uri: a.uri,
        type: a.type === 'video' ? ('video' as const) : ('photo' as const),
        width: a.width,
        height: a.height,
      })),
    ]);
  };

  const tagLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    setError(null);
    create.mutate(
      {
        title: title.trim(),
        note: note.trim() || undefined,
        mood,
        rating: rating || undefined,
        occurredAt: new Date(),
        coordinates: coords,
        media,
      },
      {
        onSuccess: () => router.back(),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Could not save memory.'),
      },
    );
  };

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="gap-5 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-white">New memory</Text>

        <Input
          label="Title"
          placeholder="Sunset at Cap Spartel"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Note"
          placeholder="What made this moment worth keeping?"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={4}
          className="min-h-24"
          textAlignVertical="top"
        />

        <View className="gap-2">
          <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
            Mood
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {MOODS.map((m) => (
              <Chip
                key={m.value}
                label={`${m.emoji} ${m.label}`}
                selected={mood === m.value}
                onPress={() => setMood(mood === m.value ? undefined : m.value)}
              />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
            Rating
          </Text>
          <Rating value={rating} onChange={setRating} />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
            Photos & videos
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {media.map((m, i) => (
              <Pressable
                key={m.uri}
                onLongPress={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
              >
                <Image
                  source={{ uri: m.uri }}
                  style={{ width: 76, height: 76, borderRadius: 14 }}
                  contentFit="cover"
                />
              </Pressable>
            ))}
            <Pressable
              onPress={pickMedia}
              className="h-19 w-19 items-center justify-center rounded-2xl border border-dashed border-white/25"
              style={{ width: 76, height: 76 }}
            >
              <Text className="text-2xl text-white/60">＋</Text>
            </Pressable>
          </View>
          {media.length ? (
            <Text className="text-xs text-white/35">Long-press a photo to remove it.</Text>
          ) : null}
        </View>

        <Glass>
          <Pressable
            onPress={tagLocation}
            className="flex-row items-center justify-between p-4"
          >
            <Text className="text-sm text-white/80">
              {coords
                ? `📍 Tagged (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`
                : '📍 Tag current location'}
            </Text>
            {locating ? <Text className="text-xs text-white/40">Locating…</Text> : null}
          </Pressable>
        </Glass>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Button
          title="Save memory"
          onPress={save}
          loading={create.isPending}
          disabled={!title.trim()}
        />
      </ScrollView>
    </Screen>
  );
}
