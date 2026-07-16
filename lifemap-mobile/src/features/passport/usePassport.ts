import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { auth, db } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
import { compressToDataUri } from '@/shared/lib/image';
import type {
  Coordinates,
  FoodEntry,
  StayEntry,
  StayKind,
} from '@/shared/types/domain';

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

/** Shared shape for both passports — a real establishment plus the user's take. */
export type EstablishmentDraft = {
  name: string;
  rating: number;
  review?: string;
  /** Local URIs of the user's own photos; compressed on save. */
  photoUris: string[];
  /** Reference to the real place — official photos are fetched live from this. */
  googlePlaceId?: string | null;
  address?: string | null;
  coordinates?: Coordinates | null;
  country?: string | null;
  city?: string | null;
  /** Food only. */
  dish?: string;
  /** Stay only. */
  kind?: StayKind;
};

const MAX_PHOTOS = 3;

async function compressPhotos(uris: string[]): Promise<string[]> {
  const photos: string[] = [];
  for (const uri of uris.slice(0, MAX_PHOTOS)) {
    photos.push(await compressToDataUri(uri));
  }
  return photos;
}

export async function addFoodEntry(draft: EstablishmentDraft): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  const photos = await compressPhotos(draft.photoUris);
  await addDoc(collection(db, 'foodEntries'), {
    ownerId: uid,
    restaurantName: draft.name,
    dish: draft.dish?.trim() || null,
    rating: draft.rating,
    review: draft.review?.trim() || null,
    photos,
    googlePlaceId: draft.googlePlaceId ?? null,
    address: draft.address ?? null,
    coordinates: draft.coordinates ?? null,
    country: draft.country?.toUpperCase() || null,
    city: draft.city || null,
    sharedSpaceId: null,
    visitedAt: Timestamp.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function addStayEntry(draft: EstablishmentDraft): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  const photos = await compressPhotos(draft.photoUris);
  await addDoc(collection(db, 'stayEntries'), {
    ownerId: uid,
    name: draft.name,
    kind: draft.kind ?? 'hotel',
    rating: draft.rating,
    review: draft.review?.trim() || null,
    photos,
    googlePlaceId: draft.googlePlaceId ?? null,
    address: draft.address ?? null,
    coordinates: draft.coordinates ?? null,
    country: draft.country?.toUpperCase() || null,
    city: draft.city || null,
    sharedSpaceId: null,
    checkIn: Timestamp.now(),
    checkOut: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFoodEntry(id: string) {
  await deleteDoc(doc(db, 'foodEntries', id));
}

export async function deleteStayEntry(id: string) {
  await deleteDoc(doc(db, 'stayEntries', id));
}
