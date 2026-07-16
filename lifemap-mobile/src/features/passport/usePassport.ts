import { useMutation } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { db } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
import type { FoodEntry, Run, StayEntry, StayKind } from '@/shared/types/domain';

function useOwnedCollection<T>(
  name: string,
  orderField: string,
  mapId: (id: string, data: Record<string, unknown>) => T,
) {
  const user = useSession((s) => s.user);
  const q = useMemo(
    () =>
      user
        ? query(
            collection(db, name),
            where('ownerId', '==', user.uid),
            orderBy(orderField, 'desc'),
          )
        : null,
    [user?.uid, name, orderField],
  );
  return useLiveCollection<T>([name, user?.uid], q, mapId);
}

export function useFoodEntries() {
  return useOwnedCollection<FoodEntry>('foodEntries', 'visitedAt', (id, data) => ({
    ...(data as Omit<FoodEntry, 'id'>),
    id,
  }));
}

export function useStayEntries() {
  return useOwnedCollection<StayEntry>('stayEntries', 'checkIn', (id, data) => ({
    ...(data as Omit<StayEntry, 'id'>),
    id,
  }));
}

export function useRuns() {
  return useOwnedCollection<Run>('runs', 'startedAt', (id, data) => ({
    ...(data as Omit<Run, 'id'>),
    id,
  }));
}

export function useAddFoodEntry() {
  const user = useSession((s) => s.user);
  return useMutation({
    mutationFn: async (args: {
      restaurantName: string;
      dish?: string;
      rating: number;
      city?: string;
      country?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error('Not signed in.');
      await addDoc(collection(db, 'foodEntries'), {
        ownerId: user.uid,
        restaurantName: args.restaurantName,
        dish: args.dish ?? null,
        rating: args.rating,
        notes: args.notes ?? null,
        photoUrl: null,
        coordinates: null,
        country: args.country?.toUpperCase() || null,
        city: args.city || null,
        placeId: null,
        sharedSpaceId: null,
        visitedAt: Timestamp.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
  });
}

export function useAddStayEntry() {
  const user = useSession((s) => s.user);
  return useMutation({
    mutationFn: async (args: {
      name: string;
      kind: StayKind;
      rating: number;
      review?: string;
      city?: string;
      country?: string;
    }) => {
      if (!user) throw new Error('Not signed in.');
      await addDoc(collection(db, 'stayEntries'), {
        ownerId: user.uid,
        name: args.name,
        kind: args.kind,
        rating: args.rating,
        review: args.review ?? null,
        photoUrl: null,
        coordinates: null,
        country: args.country?.toUpperCase() || null,
        city: args.city || null,
        placeId: null,
        sharedSpaceId: null,
        checkIn: Timestamp.now(),
        checkOut: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
  });
}

export function useAddRun() {
  const user = useSession((s) => s.user);
  return useMutation({
    mutationFn: async (args: {
      distanceKm: number;
      durationMin: number;
      city?: string;
      country?: string;
    }) => {
      if (!user) throw new Error('Not signed in.');
      await addDoc(collection(db, 'runs'), {
        ownerId: user.uid,
        distanceMeters: Math.round(args.distanceKm * 1000),
        durationSec: Math.round(args.durationMin * 60),
        polyline: null,
        startCoordinates: null,
        country: args.country?.toUpperCase() || null,
        city: args.city || null,
        source: 'manual',
        startedAt: Timestamp.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
  });
}

/** min/km pace, formatted "5'24"" — the number runners actually think in. */
export function formatPace(distanceMeters: number, durationSec: number): string {
  if (!distanceMeters) return '—';
  const secPerKm = durationSec / (distanceMeters / 1000);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}'${String(sec).padStart(2, '0')}"`;
}
