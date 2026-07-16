import { useMutation } from '@tanstack/react-query';
import {
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { db } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
import { compressToDataUri } from '@/shared/lib/image';
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

export type NewMemoryMedia = {
  uri: string;
  type: 'photo' | 'video';
  width?: number;
  height?: number;
};

/**
 * Photos are stored **inline in the Firestore doc** as compressed JPEG data
 * URIs, not in Firebase Storage — Storage requires the paid Blaze plan and
 * this project runs on the free tier. At 900px / q0.55 a photo lands around
 * 60–150 KB; MAX_PHOTOS keeps the doc safely under Firestore's 1 MiB limit.
 * If the project ever moves to Blaze, swap this for real Storage uploads.
 */
const MAX_PHOTOS = 3;

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
};

export function useCreateMemory() {
  const user = useSession((s) => s.user);

  return useMutation({
    mutationFn: async (args: CreateMemoryArgs) => {
      if (!user) throw new Error('Not signed in.');

      const photos = args.media
        .filter((m) => m.type === 'photo')
        .slice(0, MAX_PHOTOS);

      const media: MemoryMedia[] = [];
      for (const item of photos) {
        media.push({
          storagePath: 'inline',
          downloadUrl: await compressToDataUri(item.uri),
          type: 'photo',
          width: item.width,
          height: item.height,
        });
      }

      const memoryRef = doc(collection(db, 'memories'));
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
        sharedSpaceId: null,
        occurredAt: Timestamp.fromDate(args.occurredAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return memoryRef.id;
    },
  });
}

export async function deleteMemory(memoryId: string) {
  await deleteDoc(doc(db, 'memories', memoryId));
}
