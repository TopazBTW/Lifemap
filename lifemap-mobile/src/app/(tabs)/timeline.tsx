import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, SectionList, Text, View } from 'react-native';

import { signOut, useSession } from '@/features/auth/session';
import { useMemories } from '@/features/memories/useMemories';
import { useFoodEntries, useStayEntries } from '@/features/passport/usePassport';
import { MOODS } from '@/shared/types/domain';
import { Button, EmptyState, Glass, Screen } from '@/shared/ui';

type TimelineItem = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  date: Date;
};

/**
 * Composed client-side from the live collections. When the server-side
 * timelineEntries projection lands (rules already reserve it), swap this for a
 * single query — the render below stays identical.
 */
export default function TimelineScreen() {
  const user = useSession((s) => s.user);
  const { data: memories = [] } = useMemories();
  const { data: food = [] } = useFoodEntries();
  const { data: stays = [] } = useStayEntries();

  const sections = useMemo(() => {
    const items: TimelineItem[] = [
      ...memories.map((m) => ({
        id: `memory-${m.id}`,
        emoji: MOODS.find((x) => x.value === m.mood)?.emoji ?? '📸',
        title: m.title,
        subtitle: [m.city, m.country].filter(Boolean).join(', ') || 'Memory',
        date: m.occurredAt?.toDate?.() ?? new Date(0),
      })),
      ...food.map((f) => ({
        id: `food-${f.id}`,
        emoji: '🍜',
        title: f.restaurantName,
        subtitle: f.dish ?? 'Food passport',
        date: f.visitedAt?.toDate?.() ?? new Date(0),
      })),
      ...stays.map((s) => ({
        id: `stay-${s.id}`,
        emoji: s.kind === 'airbnb' ? '🏡' : '🏨',
        title: s.name,
        subtitle: 'Stay',
        date: s.checkIn?.toDate?.() ?? new Date(0),
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Group by month for section headers ("July 2026").
    const groups = new Map<string, TimelineItem[]>();
    for (const item of items) {
      const key = item.date.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(item);
    }
    return Array.from(groups, ([title, data]) => ({ title, data }));
  }, [memories, food, stays]);

  return (
    <Screen>
      <View className="flex-row items-center justify-between pb-4 pt-2">
        <View>
          <Text className="text-3xl font-bold text-white">Timeline</Text>
          <Text className="text-sm text-white/45">{user?.displayName ?? ''}</Text>
        </View>
        <Button
          title="Sign out"
          variant="ghost"
          size="sm"
          onPress={() =>
            Alert.alert('Sign out', 'Sign out of LifeMap?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
            ])
          }
        />
      </View>

      <Pressable onPress={() => router.push('/couple')} className="pb-4">
        <Glass>
          <View className="flex-row items-center gap-3 p-4">
            <Text className="text-2xl">💞</Text>
            <View className="flex-1">
              <Text className="text-base font-semibold text-white">Shared space</Text>
              <Text className="text-xs text-white/45">
                Share a bucket list & map with your partner
              </Text>
            </View>
            <Text className="text-lg text-white/40">›</Text>
          </View>
        </Glass>
      </Pressable>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 pb-32"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text className="pt-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <Glass>
            <View className="flex-row items-center gap-3 p-4">
              <Text className="text-2xl">{item.emoji}</Text>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-xs text-white/45">
                  {item.date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' · '}
                  {item.subtitle}
                </Text>
              </View>
            </View>
          </Glass>
        )}
        ListEmptyComponent={
          <EmptyState
            emoji="🧭"
            title="Your story starts here"
            body="Memories, meals and stays will all appear on one timeline of your life."
          />
        }
      />
    </Screen>
  );
}
