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
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { db, storage } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
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

      // Pre-allocate the doc id so media can live under a stable Storage path
      // (users/{uid}/memories/{memoryId}/…, matching storage.rules).
      const memoryRef = doc(collection(db, 'memories'));

      const media: MemoryMedia[] = [];
      for (const [i, item] of args.media.entries()) {
        const ext = item.type === 'photo' ? 'jpg' : 'mp4';
        const path = `users/${user.uid}/memories/${memoryRef.id}/${i}.${ext}`;
        const blob = await (await fetch(item.uri)).blob();
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, blob, {
          contentType: item.type === 'photo' ? 'image/jpeg' : 'video/mp4',
        });
        media.push({
          storagePath: path,
          downloadUrl: await getDownloadURL(fileRef),
          type: item.type,
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
