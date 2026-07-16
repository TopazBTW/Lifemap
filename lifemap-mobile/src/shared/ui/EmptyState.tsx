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
      <Text className="text-5xl">{emoji}</Text>
      <Text className="mt-2 text-center text-lg font-semibold text-white">
        {title}
      </Text>
      <Text className="text-center text-sm leading-5 text-white/50">{body}</Text>
    </View>
  );
}
