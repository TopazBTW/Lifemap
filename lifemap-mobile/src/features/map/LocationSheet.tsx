import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { countryName, flagEmoji } from '@/features/map/geo';
import { cityKey } from '@/features/map/useCityMarks';
import { useMarks } from '@/features/map/useMarks';
import { reverseGeocode } from '@/features/places/searchPlaces';
import type { Coordinates } from '@/shared/types/domain';
import { Button, Chip, Glass } from '@/shared/ui';

type Resolved = { city: string | null; country: string | null };

/**
 * Shown when the user taps the map. Lets them mark both the tapped **country**
 * and the specific **city** as visited/planned. The country is known instantly
 * (offline polygon); the city is reverse-geocoded from the tapped point.
 *
 * `preset` short-circuits the lookup when a known city marker was tapped.
 */
export function LocationSheet({
  iso,
  coordinate,
  preset,
  onClose,
}: {
  iso: string | null;
  coordinate: Coordinates;
  preset?: { city: string; country: string | null };
  onClose: () => void;
}) {
  const { countries, cities, setCountry, setCity, shared } = useMarks();
  const [resolved, setResolved] = useState<Resolved | null>(
    preset ? { city: preset.city, country: preset.country } : null,
  );

  useEffect(() => {
    if (preset) return;
    let alive = true;
    reverseGeocode(coordinate.lat, coordinate.lng).then((r) => {
      if (alive) setResolved({ city: r.city, country: r.country ?? iso });
    });
    return () => {
      alive = false;
    };
  }, [coordinate.lat, coordinate.lng, iso, preset]);

  const countryIso = resolved?.country ?? iso;
  const countryStatus = countryIso ? countries[countryIso] : undefined;

  const key =
    resolved?.city && countryIso ? cityKey(resolved.city, countryIso) : null;
  const cityStatus = key ? cities[key]?.status : undefined;

  const markCountry = (status: 'visited' | 'planned') => {
    if (!countryIso) return;
    setCountry(countryIso, countryStatus === status ? null : status);
  };

  const markCity = (status: 'visited' | 'planned') => {
    if (!key || !resolved?.city) return;
    setCity(
      key,
      cityStatus === status
        ? null
        : {
            name: resolved.city,
            lat: coordinate.lat,
            lng: coordinate.lng,
            country: countryIso ?? null,
            status,
          },
    );
  };

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(150)}
      className="absolute inset-x-4 bottom-28"
    >
      <Glass intensity={60}>
        <View className="gap-4 p-5">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 pr-3 text-lg font-semibold text-white">
              {countryIso ? `${flagEmoji(countryIso)} ${countryName(countryIso)}` : 'Somewhere'}
            </Text>
            <Button title="✕" variant="ghost" size="sm" onPress={onClose} />
          </View>

          {/* Country */}
          <View className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-wider text-white/45">
              Country
            </Text>
            <View className="flex-row gap-2">
              <Chip label="✓ Visited" selected={countryStatus === 'visited'} onPress={() => markCountry('visited')} />
              <Chip label="✈ Planned" selected={countryStatus === 'planned'} onPress={() => markCountry('planned')} />
            </View>
          </View>

          {/* City */}
          <View className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-wider text-white/45">
              City
            </Text>
            {!resolved ? (
              <View className="flex-row items-center gap-2 py-1">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-sm text-white/50">Finding the city…</Text>
              </View>
            ) : resolved.city ? (
              <>
                <Text className="text-sm text-white/80">📍 {resolved.city}</Text>
                <View className="flex-row gap-2">
                  <Chip label="✓ Visited" selected={cityStatus === 'visited'} onPress={() => markCity('visited')} />
                  <Chip label="✈ Planned" selected={cityStatus === 'planned'} onPress={() => markCity('planned')} />
                </View>
              </>
            ) : (
              <Text className="text-sm text-white/45">No city here — open sea or unnamed area.</Text>
            )}
          </View>

          <Text className="text-xs leading-4 text-white/35">
            Tapping an active status clears it. Cities you mark also colour their
            country.{shared ? ' Marks are shared with your partner.' : ''}
          </Text>
        </View>
      </Glass>
    </Animated.View>
  );
}
