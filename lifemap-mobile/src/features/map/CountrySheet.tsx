import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { countryName, flagEmoji } from '@/features/map/geo';
import { setCountryMark } from '@/features/map/useCountryMarks';
import type { CountryEntry } from '@/shared/types/domain';
import { Button, Chip, Glass } from '@/shared/ui';

/**
 * Bottom card shown when the user taps a country. This is where "I've been
 * to Japan" happens without needing a saved place there first.
 */
export function CountrySheet({
  iso,
  entry,
  onClose,
}: {
  iso: string;
  entry: CountryEntry | null;
  onClose: () => void;
}) {
  const status = entry?.status ?? 'none';

  const counts = [
    entry?.placeCount ? `${entry.placeCount} places` : null,
    entry?.memoryCount ? `${entry.memoryCount} memories` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(150)}
      className="absolute inset-x-4 bottom-28"
    >
      <Glass intensity={60}>
        <View className="gap-4 p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-1 pr-3">
              <Text className="text-lg font-semibold text-white">
                {flagEmoji(iso)} {countryName(iso)}
              </Text>
              <Text className="text-sm text-white/50">
                {counts || 'Nothing saved here yet'}
              </Text>
            </View>
            <Button title="✕" variant="ghost" onPress={onClose} className="h-9 px-3 py-1" />
          </View>

          <View className="flex-row gap-2">
            <Chip
              label="✓ Visited"
              selected={status === 'visited'}
              onPress={async () => {
                await setCountryMark(iso, status === 'visited' ? null : 'visited');
                onClose();
              }}
            />
            <Chip
              label="✈ Planned"
              selected={status === 'planned'}
              onPress={async () => {
                await setCountryMark(iso, status === 'planned' ? null : 'planned');
                onClose();
              }}
            />
          </View>

          <Text className="text-xs leading-4 text-white/35">
            Tapping an active status clears it. Memories in a country mark it
            visited automatically.
          </Text>
        </View>
      </Glass>
    </Animated.View>
  );
}
