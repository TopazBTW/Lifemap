import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, Text } from 'react-native';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

// Height comes from padding only — never mix a fixed h-* with padding, or the
// padding eats the text box and clips the label. Use `size`, not className, to
// change dimensions.
const base = 'flex-row items-center justify-center rounded-pill active:opacity-80';

const sizes = {
  md: 'px-6 py-3.5',
  sm: 'px-4 py-2',
};

const textSizes = {
  md: 'text-base',
  sm: 'text-sm',
};

const variants = {
  primary: 'bg-horizon-500',
  ghost: 'bg-white/10 border border-white/15',
  danger: 'bg-red-500/90',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
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
      className={`${base} ${sizes[size]} ${variants[variant]} ${inactive ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text
          numberOfLines={1}
          className={`${textSizes[size]} font-semibold text-white`}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
