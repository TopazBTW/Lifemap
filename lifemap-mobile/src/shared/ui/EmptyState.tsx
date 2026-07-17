import { Text, View } from 'react-native';

export function EmptyState({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-10 py-16">
      {/* Inline fontSize, not a text-* class: Tailwind's sizes carry a
          lineHeight (text-5xl is 1×), and emoji glyphs are taller than their
          font size, so they get clipped. Let the line box size itself. */}
      <Text style={{ fontSize: 48 }}>{emoji}</Text>
      <Text className="mt-2 text-center text-lg font-semibold text-white">
        {title}
      </Text>
      <Text className="text-center text-sm leading-5 text-white/50">{body}</Text>
    </View>
  );
}
