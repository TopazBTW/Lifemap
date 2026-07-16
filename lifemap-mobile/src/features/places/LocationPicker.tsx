import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { flagEmoji } from '@/features/map/geo';
import {
  useLocationSearch,
  type LocationResult,
} from '@/features/places/useLocationSearch';
import { Glass, Input } from '@/shared/ui';

/**
 * Search-and-pick a location. Reused by memory create and the memory detail's
 * "change location". Self-contained: owns its query + debounce and calls back
 * with the chosen result.
 */
export function LocationPicker({
  onPick,
  placeholder = 'Search a place or city…',
}: {
  onPick: (result: LocationResult) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 500);
    return () => clearTimeout(t);
  }, [input]);

  const { results, isFetching } = useLocationSearch(debounced);

  return (
    <View className="gap-2">
      <Input
        placeholder={placeholder}
        value={input}
        onChangeText={setInput}
        autoCorrect={false}
      />
      {isFetching ? <ActivityIndicator color="white" /> : null}
      {results.length ? (
        <Glass>
          <View>
            {results.map((r, i) => (
              <Pressable
                key={r.key}
                onPress={() => {
                  setInput('');
                  setDebounced('');
                  onPick(r);
                }}
                className={i > 0 ? 'border-t border-white/8' : ''}
              >
                <View className="gap-0.5 p-3.5">
                  <Text className="text-sm font-medium text-white">
                    {r.country ? `${flagEmoji(r.country)} ` : ''}
                    {r.name}
                  </Text>
                  <Text className="text-xs text-white/45" numberOfLines={1}>
                    {r.address}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Glass>
      ) : null}
    </View>
  );
}
