import { Pressable, Text } from 'react-native';

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`rounded-pill border px-3.5 py-2 ${
        selected
          ? 'border-horizon-400 bg-horizon-500/25'
          : 'border-white/12 bg-white/5'
      }`}
    >
      <Text
        className={`text-sm font-medium ${selected ? 'text-horizon-300' : 'text-white/70'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
