import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { countryName, flagEmoji } from '@/features/map/geo';
import { useMapFocus } from '@/features/map/useMapFocus';
import { useMemories } from '@/features/memories/useMemories';
import { useFoodEntries, useStayEntries } from '@/features/passport/usePassport';
import { KIND_EMOJI } from '@/features/places/kinds';
import { usePlaces } from '@/features/places/usePlaces';
import { MOODS, type Mood } from '@/shared/types/domain';
import { Button, Chip, EmptyState, Glass, Input, Rating, Screen } from '@/shared/ui';

type Row = {
  id: string;
  kind: 'memory' | 'place' | 'review';
  emoji: string;
  title: string;
  subtitle: string;
  country: string | null;
  rating?: number;
  onPress: () => void;
};

const has = (haystack: (string | null | undefined)[], q: string) =>
  haystack.some((s) => s?.toLowerCase().includes(q));

/**
 * Search everything you've saved. All client-side over the already-live
 * collections — no new queries. Text matches names/notes/reviews; chips filter
 * by country, mood, place kind and minimum rating.
 */
export default function SearchScreen() {
  const { data: memories = [] } = useMemories();
  const { data: places = [] } = usePlaces();
  const { data: food = [] } = useFoodEntries();
  const { data: stays = [] } = useStayEntries();
  const focusOn = useMapFocus((s) => s.focusOn);

  const [q, setQ] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [minRating, setMinRating] = useState(0);

  // Countries present across all data, for the filter row.
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const m of memories) if (m.country) set.add(m.country);
    for (const p of places) set.add(p.country);
    for (const f of food) if (f.country) set.add(f.country);
    for (const s of stays) if (s.country) set.add(s.country);
    return Array.from(set).sort();
  }, [memories, places, food, stays]);

  const rows = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    const out: Row[] = [];

    for (const m of memories) {
      if (country && m.country !== country) continue;
      if (mood && m.mood !== mood) continue;
      if (minRating && (m.rating ?? 0) < minRating) continue;
      if (needle && !has([m.title, m.note, m.city, m.country], needle)) continue;
      out.push({
        id: `mem-${m.id}`,
        kind: 'memory',
        emoji: MOODS.find((x) => x.value === m.mood)?.emoji ?? '📸',
        title: m.title,
        subtitle: [m.city, m.country ? countryName(m.country) : null].filter(Boolean).join(', ') || 'Memory',
        country: m.country ?? null,
        rating: m.rating,
        onPress: () => router.replace({ pathname: '/memory/[id]', params: { id: m.id } }),
      });
    }

    // Mood filter only applies to memories — skip the rest when it's set.
    if (!mood) {
      for (const p of places) {
        if (country && p.country !== country) continue;
        if (minRating && (p.rating ?? 0) < minRating) continue;
        if (needle && !has([p.name, p.city, p.country, p.kind], needle)) continue;
        out.push({
          id: `place-${p.id}`,
          kind: 'place',
          emoji: KIND_EMOJI[p.kind] ?? '📍',
          title: p.name,
          subtitle: [p.city, p.country ? countryName(p.country) : null].filter(Boolean).join(', ') || p.kind,
          country: p.country,
          onPress: () => {
            focusOn(p.coordinates);
            router.dismissAll();
            // See memory/[id]: '/' is ambiguous with the auth index.
            router.navigate('/(tabs)');
          },
        });
      }

      for (const f of food) {
        if (country && f.country !== country) continue;
        if (minRating && f.rating < minRating) continue;
        if (needle && !has([f.restaurantName, f.dish, f.city, f.country, f.review], needle)) continue;
        out.push({
          id: `food-${f.id}`,
          kind: 'review',
          emoji: '🍜',
          title: f.restaurantName,
          subtitle: [f.dish, f.city, f.country ? countryName(f.country) : null].filter(Boolean).join(' · ') || 'Food',
          country: f.country ?? null,
          rating: f.rating,
          onPress: () => {},
        });
      }

      for (const s of stays) {
        if (country && s.country !== country) continue;
        if (minRating && s.rating < minRating) continue;
        if (needle && !has([s.name, s.city, s.country, s.review], needle)) continue;
        out.push({
          id: `stay-${s.id}`,
          kind: 'review',
          emoji: s.kind === 'airbnb' ? '🏡' : '🏨',
          title: s.name,
          subtitle: [s.city, s.country ? countryName(s.country) : null].filter(Boolean).join(' · ') || 'Stay',
          country: s.country ?? null,
          rating: s.rating,
          onPress: () => {},
        });
      }
    }

    return out;
  }, [q, country, mood, minRating, memories, places, food, stays, focusOn]);

  const active = q.trim() || country || mood || minRating > 0;

  return (
    <Screen>
      <View className="flex-row items-center justify-between pb-3 pt-2">
        <Text className="text-2xl font-bold text-white">Search</Text>
        <Button title="✕ Close" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>

      <Input
        placeholder="Search memories, places, reviews…"
        value={q}
        onChangeText={setQ}
        autoFocus
        autoCorrect={false}
      />

      {/* Filters */}
      <View className="gap-2 py-3">
        <View className="flex-row flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip
              key={m.value}
              label={m.emoji}
              selected={mood === m.value}
              onPress={() => setMood(mood === m.value ? null : m.value)}
            />
          ))}
          {[3, 4, 5].map((r) => (
            <Chip
              key={r}
              label={`⭐${r}+`}
              selected={minRating === r}
              onPress={() => setMinRating(minRating === r ? 0 : r)}
            />
          ))}
        </View>
        {countries.length ? (
          <FlatList
            horizontal
            data={countries}
            keyExtractor={(c) => c}
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            renderItem={({ item }) => (
              <Chip
                label={`${flagEmoji(item)} ${item}`}
                selected={country === item}
                onPress={() => setCountry(country === item ? null : item)}
              />
            )}
          />
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-2 pb-10"
        renderItem={({ item }) => (
          <Pressable onPress={item.onPress}>
            <Glass>
              <View className="flex-row items-center gap-3 p-4">
                <Text className="text-2xl">{item.emoji}</Text>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-xs text-white/45" numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                {item.rating ? <Rating value={item.rating} size="sm" /> : null}
              </View>
            </Glass>
          </Pressable>
        )}
        ListEmptyComponent={
          active ? (
            <EmptyState emoji="🧐" title="No matches" body="Try a different word or clear a filter." />
          ) : (
            <EmptyState
              emoji="🔍"
              title="Find anything"
              body="Search across your memories, places and reviews — filter by country, mood or rating."
            />
          )
        }
      />
    </Screen>
  );
}
