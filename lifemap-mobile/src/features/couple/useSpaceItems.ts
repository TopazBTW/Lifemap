import { collection, orderBy, query, where } from 'firebase/firestore';
import { useMemo } from 'react';

import { db } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
import type { Memory, Place } from '@/shared/types/domain';

/**
 * Places/memories shared to a space — returns **both** partners' items (the
 * sharedWithMe rule grants read). Empty when not in a space or nothing shared.
 */
export function useSpacePlaces(spaceId: string | undefined) {
  const q = useMemo(
    () =>
      spaceId
        ? query(
            collection(db, 'places'),
            where('sharedSpaceId', '==', spaceId),
            orderBy('createdAt', 'desc'),
          )
        : null,
    [spaceId],
  );
  return useLiveCollection<Place>(['spacePlaces', spaceId], q, (id, d) => ({
    ...(d as Omit<Place, 'id'>),
    id,
  }));
}

export function useSpaceMemories(spaceId: string | undefined) {
  const q = useMemo(
    () =>
      spaceId
        ? query(
            collection(db, 'memories'),
            where('sharedSpaceId', '==', spaceId),
            orderBy('occurredAt', 'desc'),
          )
        : null,
    [spaceId],
  );
  return useLiveCollection<Memory>(['spaceMemories', spaceId], q, (id, d) => ({
    ...(d as Omit<Memory, 'id'>),
    id,
  }));
}
