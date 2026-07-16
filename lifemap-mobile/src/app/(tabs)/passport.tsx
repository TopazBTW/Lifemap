import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import {
  formatPace,
  useAddFoodEntry,
  useAddRun,
  useAddStayEntry,
  useFoodEntries,
  useRuns,
  useStayEntries,
} from '@/features/passport/usePassport';
import type { StayKind } from '@/shared/types/domain';
import { Button, Chip, EmptyState, Glass, Input, Rating, Screen } from '@/shared/ui';

type Section = 'food' | 'stays' | 'runs';

export default function PassportScreen() {
  const [section, setSection] = useState<Section>('food');

  return (
    <Screen>
      <View className="gap-4 pb-4 pt-2">
        <Text className="text-3xl font-bold text-white">Passports</Text>
        <View className="flex-row gap-2">
          <Chip label="🍜 Food" selected={section === 'food'} onPress={() => setSection('food')} />
          <Chip label="🏨 Stays" selected={section === 'stays'} onPress={() => setSection('stays')} />
          <Chip label="🏃 Runs" selected={section === 'runs'} onPress={() => setSection('runs')} />
        </View>
      </View>

      {section === 'food' && <FoodPassport />}
      {section === 'stays' && <StayPassport />}
      {section === 'runs' && <RunningPassport />}
    </Screen>
  );
}

// ─── Food ─────────────────────────────────────────────────────────────────────

function FoodPassport() {
  const { data: entries = [], isLoading } = useFoodEntries();
  const add = useAddFoodEntry();
  const [name, setName] = useState('');
  const [dish, setDish] = useState('');
  const [rating, setRating] = useState(0);

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerClassName="gap-3 pb-32"
      ListHeaderComponent={
        <Glass>
          <View className="gap-3 p-4">
            <Input placeholder="Restaurant" value={name} onChangeText={setName} />
            <Input placeholder="Dish (optional)" value={dish} onChangeText={setDish} />
            <View className="flex-row items-center justify-between">
              <Rating value={rating} onChange={setRating} />
              <Button
                title="Add"
                loading={add.isPending}
                disabled={!name.trim() || !rating}
                onPress={() =>
                  add.mutate(
                    { restaurantName: name.trim(), dish: dish.trim() || undefined, rating },
                    {
                      onSuccess: () => {
                        setName('');
                        setDish('');
                        setRating(0);
                      },
                    },
                  )
                }
                className="h-11 px-5"
              />
            </View>
          </View>
        </Glass>
      }
      renderItem={({ item }) => (
        <Glass>
          <View className="gap-1 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
                🍜 {item.restaurantName}
              </Text>
              <Rating value={item.rating} size="sm" />
            </View>
            <Text className="text-xs text-white/45">
              {[item.dish, item.city, item.country].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
        </Glass>
      )}
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState
            emoji="🍜"
            title="Your food passport is empty"
            body="Every dish worth remembering gets a page. Rate the places you eat as you travel."
          />
        )
      }
    />
  );
}

// ─── Stays ────────────────────────────────────────────────────────────────────

const STAY_KINDS: { value: StayKind; label: string }[] = [
  { value: 'hotel', label: '🏨 Hotel' },
  { value: 'airbnb', label: '🏡 Airbnb' },
  { value: 'hostel', label: '🛏️ Hostel' },
];

function StayPassport() {
  const { data: entries = [], isLoading } = useStayEntries();
  const add = useAddStayEntry();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<StayKind>('hotel');
  const [rating, setRating] = useState(0);

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => e.id}
      contentContainerClassName="gap-3 pb-32"
      ListHeaderComponent={
        <Glass>
          <View className="gap-3 p-4">
            <Input placeholder="Hotel or Airbnb name" value={name} onChangeText={setName} />
            <View className="flex-row gap-2">
              {STAY_KINDS.map((k) => (
                <Chip
                  key={k.value}
                  label={k.label}
                  selected={kind === k.value}
                  onPress={() => setKind(k.value)}
                />
              ))}
            </View>
            <View className="flex-row items-center justify-between">
              <Rating value={rating} onChange={setRating} />
              <Button
                title="Add"
                loading={add.isPending}
                disabled={!name.trim() || !rating}
                onPress={() =>
                  add.mutate(
                    { name: name.trim(), kind, rating },
                    {
                      onSuccess: () => {
                        setName('');
                        setRating(0);
                      },
                    },
                  )
                }
                className="h-11 px-5"
              />
            </View>
          </View>
        </Glass>
      }
      renderItem={({ item }) => (
        <Glass>
          <View className="gap-1 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
                {STAY_KINDS.find((k) => k.value === item.kind)?.label.split(' ')[0] ?? '🏨'}{' '}
                {item.name}
              </Text>
              <Rating value={item.rating} size="sm" />
            </View>
            <Text className="text-xs text-white/45">
              {[
                item.checkIn?.toDate?.().toLocaleDateString(undefined, {
                  month: 'short',
                  year: 'numeric',
                }),
                item.city,
                item.country,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </Glass>
      )}
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState
            emoji="🏨"
            title="No stays logged"
            body="Keep a history of every hotel and Airbnb — you'll thank yourself when someone asks for a recommendation."
          />
        )
      }
    />
  );
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

function RunningPassport() {
  const { data: runs = [], isLoading } = useRuns();
  const add = useAddRun();
  const [km, setKm] = useState('');
  const [min, setMin] = useState('');

  const totalKm = runs.reduce((sum, r) => sum + r.distanceMeters, 0) / 1000;

  return (
    <FlatList
      data={runs}
      keyExtractor={(r) => r.id}
      contentContainerClassName="gap-3 pb-32"
      ListHeaderComponent={
        <View className="gap-3">
          <Glass>
            <View className="flex-row justify-around p-4">
              <View className="items-center">
                <Text className="text-2xl font-bold text-white">{totalKm.toFixed(1)}</Text>
                <Text className="text-xs text-white/45">total km</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-white">{runs.length}</Text>
                <Text className="text-xs text-white/45">runs</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-white">
                  {new Set(runs.map((r) => r.country).filter(Boolean)).size}
                </Text>
                <Text className="text-xs text-white/45">countries</Text>
              </View>
            </View>
          </Glass>
          <Glass>
            <View className="gap-3 p-4">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input
                    placeholder="Distance (km)"
                    value={km}
                    onChangeText={setKm}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    placeholder="Time (min)"
                    value={min}
                    onChangeText={setMin}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <Button
                title="Log run"
                loading={add.isPending}
                disabled={!(parseFloat(km) > 0) || !(parseFloat(min) > 0)}
                onPress={() =>
                  add.mutate(
                    { distanceKm: parseFloat(km), durationMin: parseFloat(min) },
                    {
                      onSuccess: () => {
                        setKm('');
                        setMin('');
                      },
                    },
                  )
                }
              />
            </View>
          </Glass>
        </View>
      }
      renderItem={({ item }) => (
        <Glass>
          <View className="flex-row items-center justify-between p-4">
            <View className="gap-1">
              <Text className="text-base font-semibold text-white">
                🏃 {(item.distanceMeters / 1000).toFixed(2)} km
              </Text>
              <Text className="text-xs text-white/45">
                {item.startedAt?.toDate?.().toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                })}
                {item.city ? ` · ${item.city}` : ''}
              </Text>
            </View>
            <View className="items-end gap-1">
              <Text className="text-sm font-semibold text-horizon-300">
                {formatPace(item.distanceMeters, item.durationSec)} /km
              </Text>
              <Text className="text-xs text-white/45">
                {Math.round(item.durationSec / 60)} min
              </Text>
            </View>
          </View>
        </Glass>
      )}
      ListEmptyComponent={
        isLoading ? null : (
          <EmptyState
            emoji="🏃"
            title="No runs yet"
            body="Log your runs and watch your global running map grow, one city at a time."
          />
        )
      }
    />
  );
}
