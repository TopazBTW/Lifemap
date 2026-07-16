import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, Text } from 'react-native';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

const base =
  'h-13 flex-row items-center justify-center rounded-pill px-6 py-3.5 active:opacity-80';

const variants = {
  primary: 'bg-horizon-500',
  ghost: 'bg-white/10 border border-white/15',
  danger: 'bg-red-500/90',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className={`${base} ${variants[variant]} ${inactive ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="text-base font-semibold text-white">{title}</Text>
      )}
    </Pressable>
  );
}
