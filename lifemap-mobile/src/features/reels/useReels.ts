import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { db, functions } from '@/shared/lib/firebase';
import { useLiveCollection, useLiveDoc } from '@/shared/lib/firestore-live';
import type { ExtractedPlace, Reel, ReelPlatform } from '@/shared/types/domain';

/** Client-side mirror of functions/src/resolve.ts detectPlatform. */
export function detectPlatform(rawUrl: string): ReelPlatform {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
  const is = (...hosts: string[]) =>
    hosts.some((h) => host === h || host.endsWith(`.${h}`));

  if (is('instagram.com', 'instagr.am', 'ig.me')) return 'instagram';
  if (is('tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com')) return 'tiktok';
  if (is('youtube.com', 'youtu.be', 'm.youtube.com')) return 'youtube';
  return 'unknown';
}

export function useReels() {
  const user = useSession((s) => s.user);
  const q = useMemo(
    () =>
      user
        ? query(
            collection(db, 'reels'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc'),
          )
        : null,
    [user?.uid],
  );

  return useLiveCollection<Reel>(['reels', user?.uid], q, (id, data) => ({
    ...(data as Omit<Reel, 'id'>),
    id,
  }));
}

export function useReel(reelId: string | undefined) {
  const ref = useMemo(
    () => (reelId ? doc(db, 'reels', reelId) : null),
    [reelId],
  );
  return useLiveDoc<Reel>(['reel', reelId], ref, (id, data) => ({
    ...(data as Omit<Reel, 'id'>),
    id,
  }));
}

/**
 * Import = write a `pending` doc and stop. The onReelCreated function does the
 * heavy lifting server-side (extraction can take 30s and must survive the app
 * being backgrounded); the list screen just watches `status`.
 */
export function useImportReel() {
  const user = useSession((s) => s.user);

  return useMutation({
    mutationFn: async (url: string) => {
      if (!user) throw new Error('Not signed in.');
      const platform = detectPlatform(url);
      if (platform === 'unknown') {
        throw new Error('Paste an Instagram, TikTok or YouTube link.');
      }
      const ref = await addDoc(collection(db, 'reels'), {
        ownerId: user.uid,
        url: url.trim(),
        platform,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
  });
}

/** Server callable — re-geocodes stragglers and updates the rollup atomically. */
export function useCommitReelPlaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { reelId: string; places: ExtractedPlace[] }) => {
      const call = httpsCallable(functions, 'commitReelPlaces');
      const res = await call({
        reelId: args.reelId,
        places: args.places.map((p) => ({
          name: p.name,
          kind: p.kind,
          coordinates: p.coordinates,
          country: p.country,
          city: p.city,
          confidence: p.confidence,
        })),
      });
      return res.data as { placeIds: string[] };
    },
    onSuccess: () => {
      // Places and the rollup stream in via snapshots; nothing to invalidate.
      qc.invalidateQueries({ queryKey: ['itineraries'] });
    },
  });
}

export async function deleteReel(reelId: string) {
  await deleteDoc(doc(db, 'reels', reelId));
}
