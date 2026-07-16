import { useMutation } from '@tanstack/react-query';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { db } from '@/shared/lib/firebase';
import { useLiveCollection, useLiveDoc } from '@/shared/lib/firestore-live';
import { deleteImage, uploadImage } from '@/shared/lib/storage';
import type {
  Coordinates,
  Memory,
  MemoryMedia,
  Mood,
} from '@/shared/types/domain';

export function useMemories() {
  const user = useSession((s) => s.user);
  const q = useMemo(
    () =>
      user
        ? query(
            collection(db, 'memories'),
            where('ownerId', '==', user.uid),
            orderBy('occurredAt', 'desc'),
          )
        : null,
    [user?.uid],
  );

  return useLiveCollection<Memory>(['memories', user?.uid], q, (id, data) => ({
    ...(data as Omit<Memory, 'id'>),
    id,
  }));
}

export function useMemory(memoryId: string | undefined) {
  const ref = useMemo(
    () => (memoryId ? doc(db, 'memories', memoryId) : null),
    [memoryId],
  );
  return useLiveDoc<Memory>(['memory', memoryId], ref, (id, data) => ({
    ...(data as Omit<Memory, 'id'>),
    id,
  }));
}

/** Set or move a memory's pin; re-derives the map's country colour from it. */
export async function updateMemoryLocation(
  memoryId: string,
  loc: { coordinates: Coordinates; country: string | null; city: string | null },
) {
  await updateDoc(doc(db, 'memories', memoryId), {
    coordinates: loc.coordinates,
    country: loc.country,
    city: loc.city,
    updatedAt: serverTimestamp(),
  });
}

export type NewMemoryMedia = {
  uri: string;
  type: 'photo' | 'video';
  width?: number;
  height?: number;
};

/**
 * Photos upload to Firebase Storage (see src/shared/lib/storage.ts); the doc
 * stores each media's `storagePath` + tokenised `downloadUrl`. Older memories
 * with inline base64 `downloadUrl`s still render, so no migration is needed.
 */
const MAX_PHOTOS = 8;

type CreateMemoryArgs = {
  title: string;
  note?: string;
  mood?: Mood;
  rating?: number;
  occurredAt: Date;
  coordinates?: Coordinates | null;
  country?: string | null;
  city?: string | null;
  media: NewMemoryMedia[];
  sharedSpaceId?: string | null;
};

export function useCreateMemory() {
  const user = useSession((s) => s.user);

  return useMutation({
    mutationFn: async (args: CreateMemoryArgs) => {
      if (!user) throw new Error('Not signed in.');

      const photos = args.media
        .filter((m) => m.type === 'photo')
        .slice(0, MAX_PHOTOS);

      // Pre-allocate the id so media lives under a stable per-memory path.
      const memoryRef = doc(collection(db, 'memories'));

      const media: MemoryMedia[] = [];
      for (const [i, item] of photos.entries()) {
        const { downloadUrl, storagePath } = await uploadImage(
          item.uri,
          `users/${user.uid}/memories/${memoryRef.id}/${i}.jpg`,
        );
        media.push({
          storagePath,
          downloadUrl,
          type: 'photo',
          width: item.width,
          height: item.height,
        });
      }

      await setDoc(memoryRef, {
        ownerId: user.uid,
        title: args.title,
        note: args.note ?? null,
        media,
        mood: args.mood ?? null,
        rating: args.rating ?? null,
        coordinates: args.coordinates ?? null,
        country: args.country ?? null,
        city: args.city ?? null,
        placeId: null,
        sharedSpaceId: args.sharedSpaceId ?? null,
        occurredAt: Timestamp.fromDate(args.occurredAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return memoryRef.id;
    },
  });
}

export async function deleteMemory(memoryId: string) {
  const ref = doc(db, 'memories', memoryId);
  // Remove the Storage objects before the doc so we don't orphan them.
  const snap = await getDoc(ref);
  const media = (snap.data()?.media ?? []) as MemoryMedia[];
  await Promise.all(media.map((m) => deleteImage(m.storagePath)));
  await deleteDoc(ref);
}
