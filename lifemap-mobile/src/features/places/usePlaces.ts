import {
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { db } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
import type { Place, PlaceStatus } from '@/shared/types/domain';

export function usePlaces() {
  const user = useSession((s) => s.user);
  const q = useMemo(
    () =>
      user
        ? query(
            collection(db, 'places'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc'),
          )
        : null,
    [user?.uid],
  );

  return useLiveCollection<Place>(['places', user?.uid], q, (id, data) => ({
    ...(data as Omit<Place, 'id'>),
    id,
  }));
}

/** Status changes drive the rollup (visited > planned > saved). */
export async function setPlaceStatus(placeId: string, status: PlaceStatus) {
  await updateDoc(doc(db, 'places', placeId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlace(placeId: string) {
  await deleteDoc(doc(db, 'places', placeId));
}
