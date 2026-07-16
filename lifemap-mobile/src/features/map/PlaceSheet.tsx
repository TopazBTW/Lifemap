import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { KIND_EMOJI } from '@/features/places/kinds';
import { deletePlace, setPlaceStatus } from '@/features/places/usePlaces';
import type { Place, PlaceStatus } from '@/shared/types/domain';
import { Button, Chip, Glass } from '@/shared/ui';

const STATUSES: { value: PlaceStatus; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'planned', label: 'Planned' },
  { value: 'visited', label: 'Visited' },
];

/** Bottom overlay card shown when a pin is tapped. */
export function PlaceSheet({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
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
                {KIND_EMOJI[place.kind]} {place.name}
              </Text>
              <Text className="text-sm text-white/50">
                {[place.city, place.country].filter(Boolean).join(', ')}
              </Text>
            </View>
            <Button title="✕" variant="ghost" size="sm" onPress={onClose} />
          </View>

          <View className="flex-row gap-2">
            {STATUSES.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                selected={place.status === s.value}
                onPress={() => setPlaceStatus(place.id, s.value)}
              />
            ))}
          </View>

          <Button
            title="Remove from map"
            variant="danger"
            onPress={() => {
              deletePlace(place.id);
              onClose();
            }}
          />
        </View>
      </Glass>
    </Animated.View>
  );
}
