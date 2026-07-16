import { deleteField, doc, setDoc } from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { auth, db } from '@/shared/lib/firebase';
import { useLiveDoc } from '@/shared/lib/firestore-live';
import type { CityMark, CityMarks } from '@/shared/types/domain';

/** Stable key for a city mark: `${city}|${country}`, lower-cased. */
export function cityKey(city: string, country: string | null): string {
  return `${city}|${country ?? ''}`.toLowerCase();
}

export function useCityMarks() {
  const user = useSession((s) => s.user);
  const ref = useMemo(
    () => (user ? doc(db, 'cityMarks', user.uid) : null),
    [user?.uid],
  );
  return useLiveDoc<CityMarks>(['cityMarks', user?.uid], ref, (_, data) => ({
    cities: (data.cities ?? {}) as CityMarks['cities'],
  }));
}

/** Mark a city visited/planned, or clear it with null. */
export async function setCityMark(
  key: string,
  mark: CityMark | null,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  await setDoc(
    doc(db, 'cityMarks', uid),
    { cities: { [key]: mark ?? deleteField() } },
    { merge: true },
  );
}
