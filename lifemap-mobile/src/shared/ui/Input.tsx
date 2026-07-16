import { Text, TextInput, View, type TextInputProps } from 'react-native';

type InputProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function Input({ label, error, className = '', ...rest }: InputProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.35)"
        className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-base text-white ${
          error ? 'border-red-400/60' : ''
        } ${className}`}
        {...rest}
      />
      {error ? <Text className="text-xs text-red-400">{error}</Text> : null}
    </View>
  );
}
