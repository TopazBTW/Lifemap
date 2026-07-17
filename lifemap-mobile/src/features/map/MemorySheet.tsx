import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { countryName, flagEmoji } from '@/features/map/geo';
import { MOODS, type Memory } from '@/shared/types/domain';
import { Button, Glass, Rating } from '@/shared/ui';

/**
 * Bottom overlay card for a memory pin — the mirror of PlaceSheet, so tapping
 * a memory on the map reads the same as tapping a place instead of yanking the
 * user to another screen. "Show on map" opens this directly.
 */
export function MemorySheet({
  memory,
  partnerName,
  onClose,
}: {
  memory: Memory & { isPartner?: boolean };
  partnerName?: string | null;
  onClose: () => void;
}) {
  const mood = MOODS.find((m) => m.value === memory.mood);
  const cover = memory.media.find((m) => m.type === 'photo');
  const date = memory.occurredAt?.toDate?.();

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(150)}
      className="absolute inset-x-4 bottom-28"
    >
      <Glass intensity={60}>
        <View className="gap-4 p-5">
          <View className="flex-row items-start gap-3">
            {cover ? (
              <Image
                source={{ uri: cover.downloadUrl }}
                style={{ width: 56, height: 56, borderRadius: 12 }}
                contentFit="cover"
              />
            ) : null}
            <View className="flex-1 gap-1">
              <Text className="text-lg font-semibold text-white" numberOfLines={1}>
                {mood ? `${mood.emoji} ` : ''}
                {memory.title}
              </Text>
              <Text className="text-sm text-white/50" numberOfLines={1}>
                {[
                  date?.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                  memory.city,
                  memory.country ? countryName(memory.country) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Button title="✕" variant="ghost" size="sm" onPress={onClose} />
          </View>

          {memory.isPartner && partnerName ? (
            <View className="flex-row">
              <View className="rounded-pill bg-white/10 px-2 py-0.5">
                <Text className="text-[10px] font-medium text-white/55">
                  ○ {partnerName}
                </Text>
              </View>
            </View>
          ) : null}

          {memory.rating ? <Rating value={memory.rating} size="sm" /> : null}

          {memory.note ? (
            <Text className="text-sm leading-5 text-white/70" numberOfLines={3}>
              {memory.note}
            </Text>
          ) : null}

          <Button
            title="Open memory"
            onPress={() =>
              router.push({ pathname: '/memory/[id]', params: { id: memory.id } })
            }
          />
        </View>
      </Glass>
    </Animated.View>
  );
}
