import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

/** 1–5 stars. Omit `onChange` for a read-only display. */
export function Rating({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const textSize = { sm: 'text-sm', md: 'text-2xl', lg: 'text-3xl' }[size];
  return (
    <View className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={!onChange}
          onPress={() => {
            Haptics.selectionAsync();
            onChange?.(star);
          }}
          hitSlop={4}
        >
          <Text className={`${textSize} ${star <= value ? '' : 'opacity-25'}`}>
            ⭐
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
