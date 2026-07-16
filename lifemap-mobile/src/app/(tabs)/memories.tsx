import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useMemories } from '@/features/memories/useMemories';
import { MOODS, type Memory } from '@/shared/types/domain';
import { Button, EmptyState, Glass, Rating, Screen } from '@/shared/ui';

export default function MemoriesScreen() {
  const { data: memories = [], isLoading } = useMemories();

  return (
    <Screen>
      <View className="flex-row items-center justify-between pb-4 pt-2">
        <Text className="text-3xl font-bold text-white">Memories</Text>
        <Button
          title="＋ New"
          variant="ghost"
          onPress={() => router.push('/memory/new')}
          className="h-10 px-4 py-2"
        />
      </View>

      <FlatList
        data={memories}
        keyExtractor={(m) => m.id}
        contentContainerClassName="gap-3 pb-32"
        renderItem={({ item }) => <MemoryCard memory={item} />}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              emoji="📸"
              title="No memories yet"
              body="Capture a moment — photos, a voice note, how you felt. It lands on your map and timeline forever."
            />
          )
        }
      />
    </Screen>
  );
}

function MemoryCard({ memory }: { memory: Memory }) {
  const cover = memory.media.find((m) => m.type === 'photo');
  const mood = MOODS.find((m) => m.value === memory.mood);
  const date = memory.occurredAt?.toDate?.();

  return (
    <Pressable>
      <Glass>
        {cover ? (
          <Image
            source={{ uri: cover.downloadUrl }}
            style={{ width: '100%', height: 180 }}
            contentFit="cover"
            transition={200}
          />
        ) : null}
        <View className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
              {mood ? `${mood.emoji} ` : ''}
              {memory.title}
            </Text>
            {memory.rating ? <Rating value={memory.rating} size="sm" /> : null}
          </View>
          <Text className="text-xs text-white/40">
            {[
              date
                ? date.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : null,
              memory.city,
              memory.country,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {memory.note ? (
            <Text className="text-sm leading-5 text-white/60" numberOfLines={2}>
              {memory.note}
            </Text>
          ) : null}
        </View>
      </Glass>
    </Pressable>
  );
}
