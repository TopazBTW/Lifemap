import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { flagEmoji } from '@/features/map/geo';
import { useEnrichment } from '@/features/passport/enrich';
import {
  hasGooglePlaces,
  useGooglePlaceDetails,
  useGooglePlaceSearch,
} from '@/features/passport/googlePlaces';
import {
  addFoodEntry,
  addStayEntry,
  type EstablishmentDraft,
} from '@/features/passport/usePassport';
import { usePlaceSearch } from '@/features/places/searchPlaces';
import type { StayKind } from '@/shared/types/domain';
import { Button, Chip, EmptyState, Glass, Input, Rating, Screen } from '@/shared/ui';

const STAY_KINDS: { value: StayKind; label: string }[] = [
  { value: 'hotel', label: '🏨 Hotel' },
  { value: 'airbnb', label: '🏡 Airbnb' },
  { value: 'hostel', label: '🛏️ Hostel' },
];

/** Normalised result across the Google and Nominatim search backends. */
type EstHit = {
  key: string;
  googlePlaceId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  country: string | null;
  city: string | null;
};

/**
 * Add a real establishment to the Food or Stay passport (`?kind=food|stay`).
 * With a Google key, search + live photos come from Google Places; without one
 * it falls back to free Nominatim search + Wikipedia enrichment. Either way,
 * only a reference + the user's own review/photos are saved — official photos
 * are fetched live.
 */
export default function NewEstablishmentScreen() {
  const { kind } = useLocalSearchParams<{ kind: 'food' | 'stay' }>();
  const isFood = kind !== 'stay';
  const google = hasGooglePlaces();

  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<EstHit | null>(null);

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [dish, setDish] = useState('');
  const [stayKind, setStayKind] = useState<StayKind>('hotel');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), 500);
    return () => clearTimeout(t);
  }, [input]);

  // Both hooks are always called (rules of hooks); the inactive one is disabled
  // by feeding it an empty query.
  const gSearch = useGooglePlaceSearch(google ? debounced : '');
  const nSearch = usePlaceSearch(google ? '' : debounced);

  const results: EstHit[] = google
    ? (gSearch.data ?? []).map((h) => ({
        key: h.placeId,
        googlePlaceId: h.placeId,
        name: h.name,
        address: h.address,
        lat: h.lat,
        lng: h.lng,
        country: h.country,
        city: h.city,
      }))
    : (nSearch.data ?? []).map((h) => ({
        key: h.id,
        googlePlaceId: null,
        name: h.name,
        address: h.displayName,
        lat: h.lat,
        lng: h.lng,
        country: h.country,
        city: h.city,
      }));
  const isFetching = google ? gSearch.isFetching : nSearch.isFetching;

  // Live official info for the chosen place — Google when we have a placeId,
  // Wikipedia otherwise. Never persisted.
  const gDetails = useGooglePlaceDetails(picked?.googlePlaceId);
  const wiki = useEnrichment(picked && !picked.googlePlaceId ? picked.name : null);

  const officialPhoto = gDetails.data?.photoUrls[0] ?? wiki.data?.imageUrl ?? null;
  const officialSummary = gDetails.data?.summary ?? wiki.data?.summary ?? null;
  const officialLoading = gDetails.isFetching || wiki.isFetching;

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.85,
    });
    if (result.canceled) return;
    setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 3));
  };

  const save = async () => {
    if (!picked || !rating) return;
    setSaving(true);
    setError(null);
    try {
      const draft: EstablishmentDraft = {
        name: picked.name,
        rating,
        review: review.trim() || undefined,
        photoUris,
        googlePlaceId: picked.googlePlaceId,
        address: picked.address,
        coordinates: { lat: picked.lat, lng: picked.lng },
        country: picked.country,
        city: picked.city,
        dish: isFood ? dish : undefined,
        kind: isFood ? undefined : stayKind,
      };
      await (isFood ? addFoodEntry(draft) : addStayEntry(draft));
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  // ── Search step ──────────────────────────────────────────────────────────
  if (!picked) {
    return (
      <Screen>
        <View className="gap-4 pb-4 pt-4">
          <Text className="text-2xl font-bold text-white">
            {isFood ? 'Add a restaurant' : 'Add a stay'}
          </Text>
          <Input
            placeholder={
              isFood
                ? 'e.g. “Sirocco Bangkok”, “Nobu London”'
                : 'e.g. “Hotel Costes Paris”, “Aman Tokyo”'
            }
            value={input}
            onChangeText={setInput}
            autoFocus
            autoCorrect={false}
          />
          <Text className="text-xs leading-4 text-white/35">
            {google
              ? 'Powered by Google Maps. Add the city to find places abroad — a plain “restaurant” search shows ones near you.'
              : 'Powered by OpenStreetMap. Add the city for places abroad.'}
          </Text>
        </View>

        <FlatList
          data={results}
          keyExtractor={(hit) => hit.key}
          contentContainerClassName="gap-2 pb-10"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => setPicked(item)}>
              <Glass>
                <View className="gap-0.5 p-4">
                  <Text className="text-sm font-semibold text-white">
                    {item.country ? `${flagEmoji(item.country)} ` : ''}
                    {item.name}
                  </Text>
                  <Text className="text-xs text-white/45" numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
              </Glass>
            </Pressable>
          )}
          ListEmptyComponent={
            isFetching ? (
              <View className="items-center py-10">
                <ActivityIndicator color="white" />
              </View>
            ) : debounced.trim().length >= 3 ? (
              <EmptyState
                emoji="🧐"
                title="No matches"
                body="Add the city to narrow it down — e.g. “Nobu, London”."
              />
            ) : (
              <EmptyState
                emoji={isFood ? '🍽️' : '🏨'}
                title="Find the real place"
                body="Search by name and we’ll pull its location and photo live. Type at least 3 letters."
              />
            )
          }
        />
      </Screen>
    );
  }

  // ── Detail step ──────────────────────────────────────────────────────────
  return (
    <Screen>
      <ScrollView
        contentContainerClassName="gap-5 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => setPicked(null)}>
          <Text className="text-sm text-horizon-300">‹ Search again</Text>
        </Pressable>

        {/* Live official card — photo/summary fetched from Google/Wikipedia,
            shown for context but never saved. */}
        <Glass>
          {officialPhoto ? (
            <Image
              source={{ uri: officialPhoto }}
              style={{ width: '100%', height: 180 }}
              contentFit="cover"
              transition={200}
            />
          ) : null}
          <View className="gap-1 p-4">
            <Text className="text-base font-semibold text-white">
              {picked.country ? `${flagEmoji(picked.country)} ` : ''}
              {picked.name}
            </Text>
            <Text className="text-xs text-white/45" numberOfLines={2}>
              {picked.address}
            </Text>
            {officialLoading ? (
              <Text className="pt-1 text-xs text-white/35">Looking it up…</Text>
            ) : officialSummary ? (
              <Text className="pt-1 text-xs leading-4 text-white/55" numberOfLines={4}>
                {officialSummary}
              </Text>
            ) : null}
          </View>
        </Glass>

        {isFood ? (
          <Input
            label="Dish (optional)"
            placeholder="What did you order?"
            value={dish}
            onChangeText={setDish}
          />
        ) : (
          <View className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
              Type
            </Text>
            <View className="flex-row gap-2">
              {STAY_KINDS.map((k) => (
                <Chip
                  key={k.value}
                  label={k.label}
                  selected={stayKind === k.value}
                  onPress={() => setStayKind(k.value)}
                />
              ))}
            </View>
          </View>
        )}

        <View className="gap-2">
          <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
            Your rating
          </Text>
          <Rating value={rating} onChange={setRating} size="lg" />
        </View>

        <Input
          label="Your review"
          placeholder="What was it like? Worth going back?"
          value={review}
          onChangeText={setReview}
          multiline
          numberOfLines={4}
          className="min-h-24"
          textAlignVertical="top"
        />

        <View className="gap-2">
          <Text className="text-xs font-medium uppercase tracking-wider text-white/50">
            Your photos (up to 3)
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {photoUris.map((uri, i) => (
              <Pressable
                key={uri}
                onLongPress={() =>
                  setPhotoUris((prev) => prev.filter((_, j) => j !== i))
                }
              >
                <Image
                  source={{ uri }}
                  style={{ width: 76, height: 76, borderRadius: 14 }}
                  contentFit="cover"
                />
              </Pressable>
            ))}
            <Pressable
              onPress={pickPhotos}
              className="items-center justify-center rounded-2xl border border-dashed border-white/25"
              style={{ width: 76, height: 76 }}
            >
              <Text className="text-2xl text-white/60">＋</Text>
            </Pressable>
          </View>
          {photoUris.length ? (
            <Text className="text-xs text-white/35">Long-press a photo to remove it.</Text>
          ) : null}
        </View>

        {error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        <Button
          title={isFood ? 'Save to food passport' : 'Save to stay passport'}
          onPress={save}
          loading={saving}
          disabled={!rating}
        />
      </ScrollView>
    </Screen>
  );
}
