import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { auth, db } from '@/shared/lib/firebase';
import { useLiveCollection } from '@/shared/lib/firestore-live';
import type { BucketListItem, SharedSpace } from '@/shared/types/domain';

/** Short, unambiguous invite code (no 0/O/1/I). */
function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** The user's shared space (first one). One space per couple is the norm. */
export function useMySpace() {
  const user = useSession((s) => s.user);
  const q = useMemo(
    () =>
      user
        ? query(
            collection(db, 'sharedSpaces'),
            where('memberIds', 'array-contains', user.uid),
          )
        : null,
    [user?.uid],
  );
  const { data = [], ...rest } = useLiveCollection<SharedSpace>(
    ['sharedSpace', user?.uid],
    q,
    (id, d) => ({ ...(d as Omit<SharedSpace, 'id'>), id }),
  );
  return { space: data[0] ?? null, ...rest };
}

/** Create a space and its invite-code lookup. */
export async function createSpace(name: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  const inviteCode = makeInviteCode();

  const ref = await addDoc(collection(db, 'sharedSpaces'), {
    ownerId: uid,
    name: name.trim() || 'Our Space',
    memberIds: [uid],
    inviteCode,
    createdAt: serverTimestamp(),
  });

  // The code → spaceId lookup a partner uses to join.
  await setDoc(doc(db, 'spaceInvites', inviteCode), {
    spaceId: ref.id,
    ownerId: uid,
  });
}

/** Join a partner's space using their invite code. */
export async function joinSpace(code: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  const clean = code.trim().toUpperCase();

  const invite = await getDoc(doc(db, 'spaceInvites', clean));
  if (!invite.exists()) throw new Error('That code doesn’t match any space.');

  const spaceId = invite.get('spaceId') as string;
  await updateDoc(doc(db, 'sharedSpaces', spaceId), {
    memberIds: arrayUnion(uid),
  });
}

// ─── Shared bucket list ──────────────────────────────────────────────────────

export function useBucketList(spaceId: string | undefined) {
  const q = useMemo(
    () =>
      spaceId
        ? query(
            collection(db, 'bucketListItems'),
            where('sharedSpaceId', '==', spaceId),
            orderBy('createdAt', 'desc'),
          )
        : null,
    [spaceId],
  );
  return useLiveCollection<BucketListItem>(
    ['bucketList', spaceId],
    q,
    (id, d) => ({ ...(d as Omit<BucketListItem, 'id'>), id }),
  );
}

export async function addBucketItem(
  spaceId: string,
  title: string,
  country?: string | null,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  await addDoc(collection(db, 'bucketListItems'), {
    sharedSpaceId: spaceId,
    createdBy: uid,
    title: title.trim(),
    done: false,
    country: country ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function toggleBucketItem(id: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, 'bucketListItems', id), { done });
}

export async function deleteBucketItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'bucketListItems', id));
}
