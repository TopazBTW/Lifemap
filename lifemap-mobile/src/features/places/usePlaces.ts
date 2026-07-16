import {
  addDoc,
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
import { auth, db } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
import type {
  Coordinates,
  Place,
  PlaceKind,
  PlaceStatus,
} from '@/shared/types/domain';

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

/** Manually add a place to the map. `sharedSpaceId` shares it with a partner. */
export async function addPlace(args: {
  name: string;
  kind: PlaceKind;
  status: PlaceStatus;
  coordinates: Coordinates;
  country: string;
  city?: string | null;
  sharedSpaceId?: string | null;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  await addDoc(collection(db, 'places'), {
    ownerId: uid,
    name: args.name,
    kind: args.kind,
    status: args.status,
    coordinates: args.coordinates,
    country: args.country.toUpperCase(),
    city: args.city ?? null,
    tags: [],
    sourceReelId: null,
    sharedSpaceId: args.sharedSpaceId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
