import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { countryName, flagEmoji } from '@/features/map/geo';
import { KIND_EMOJI } from '@/features/places/kinds';
import { addPlace } from '@/features/places/usePlaces';
import {
  detectPlatform,
  extractPlacesFromCaption,
  hasExtractor,
  resolveCaption,
  type ExtractedPlace,
} from '@/features/reels/extract';
import { Button, EmptyState, Glass, Input, Screen } from '@/shared/ui';

type Step = 'input' | 'extracting' | 'review';

export default function ReelsScreen() {
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<ExtractedPlace[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const enabled = hasExtractor();

  const fetchCaption = async () => {
    setError(null);
    if (detectPlatform(url) === 'unknown') {
      setError('Paste an Instagram, TikTok or YouTube link.');
      return;
    }
    setBusy(true);
    try {
      const resolved = await resolveCaption(url);
      if (resolved.caption) setCaption(resolved.caption);
      else
        setError(
          'Could not read this post automatically — paste its caption below.',
        );
    } finally {
      setBusy(false);
    }
  };

  const extract = async () => {
    setError(null);
    setStep('extracting');
    try {
      const result = await extractPlacesFromCaption(caption.trim());
      if (!result.length) {
        setError('No identifiable places found. Try a caption that names spots.');
        setStep('input');
        return;
      }
      setPlaces(result);
      // Pre-select the located, confident ones.
      setSelected(
        new Set(
          result
            .map((p, i) => (p.coordinates && p.confidence >= 0.5 ? i : -1))
            .filter((i) => i >= 0),
        ),
      );
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed.');
      setStep('input');
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      for (const [i, p] of places.entries()) {
        if (!selected.has(i) || !p.coordinates || !p.country) continue;
        await addPlace({
          name: p.name,
          kind: p.kind,
          status: 'saved',
          coordinates: p.coordinates,
          country: p.country,
          city: p.city,
        });
      }
      reset();
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('input');
    setUrl('');
    setCaption('');
    setPlaces([]);
    setSelected(new Set());
    setError(null);
  };

  if (!enabled) {
    return (
      <Screen>
        <Text className="pb-4 pt-2 text-3xl font-bold text-white">Reel to Reality</Text>
        <EmptyState
          emoji="🎬"
          title="One free key away"
          body="Reel extraction needs a free AI key — Mistral (console.mistral.ai) or Gemini (aistudio.google.com). Grab one and I'll switch it on."
        />
      </Screen>
    );
  }

  if (step === 'review') {
    const chosen = places.filter((_, i) => selected.has(i));
    return (
      <Screen>
        <View className="gap-1 pb-4 pt-2">
          <Text className="text-3xl font-bold text-white">Found {places.length}</Text>
          <Text className="text-sm text-white/50">Pick the places to drop on your map.</Text>
        </View>
        <FlatList
          data={places}
          keyExtractor={(_, i) => String(i)}
          contentContainerClassName="gap-3 pb-4"
          renderItem={({ item, index }) => (
            <ExtractedCard
              place={item}
              selected={selected.has(index)}
              onToggle={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  next.has(index) ? next.delete(index) : next.add(index);
                  return next;
                })
              }
            />
          )}
        />
        <View className="gap-2 pb-8 pt-2">
          <Button
            title={chosen.length ? `Add ${chosen.length} to my map` : 'Select places'}
            disabled={!chosen.length}
            loading={busy}
            onPress={commit}
          />
          <Button title="Start over" variant="ghost" size="sm" onPress={reset} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text className="pb-4 pt-2 text-3xl font-bold text-white">Reel to Reality</Text>
      <View className="gap-4">
        <Glass>
          <View className="gap-3 p-4">
            <Input
              placeholder="Paste an Instagram, TikTok or YouTube link"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Button
              title="Read caption"
              variant="ghost"
              size="sm"
              loading={busy}
              disabled={!url.trim()}
              onPress={fetchCaption}
            />
          </View>
        </Glass>

        <Input
          label="Caption / description"
          placeholder="Paste or edit the post's caption — the more it names places, the better."
          value={caption}
          onChangeText={setCaption}
          multiline
          numberOfLines={6}
          className="min-h-32"
          textAlignVertical="top"
          error={error}
        />

        <Button
          title={step === 'extracting' ? 'Extracting places…' : 'Extract places with AI'}
          loading={step === 'extracting'}
          disabled={caption.trim().length < 8}
          onPress={extract}
        />
        <Text className="text-center text-xs text-white/35">
          Instagram captions can’t be read automatically — paste them here.
        </Text>
      </View>
    </Screen>
  );
}

function ExtractedCard({
  place,
  selected,
  onToggle,
}: {
  place: ExtractedPlace;
  selected: boolean;
  onToggle: () => void;
}) {
  const unlocated = !place.coordinates;
  return (
    <Pressable onPress={onToggle} disabled={unlocated}>
      <Glass>
        <View
          className={`flex-row items-center gap-3 rounded-card border p-4 ${
            selected ? 'border-horizon-400/70' : 'border-transparent'
          } ${unlocated ? 'opacity-50' : ''}`}
        >
          <Text className="text-2xl">{KIND_EMOJI[place.kind] ?? '📍'}</Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold text-white">{place.name}</Text>
            <Text className="text-xs text-white/45">
              {place.country ? `${flagEmoji(place.country)} ` : ''}
              {[place.city, place.country ? countryName(place.country) : null]
                .filter(Boolean)
                .join(', ') || 'Location unknown'}
            </Text>
            {unlocated ? (
              <Text className="text-xs text-planned">Couldn’t locate — can’t map this one</Text>
            ) : null}
          </View>
          <View
            className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
              selected ? 'border-horizon-400 bg-horizon-500' : 'border-white/25'
            }`}
          >
            {selected ? <Text className="text-xs text-white">✓</Text> : null}
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}
