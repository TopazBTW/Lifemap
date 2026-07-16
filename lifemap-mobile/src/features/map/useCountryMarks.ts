import { deleteField, doc, setDoc } from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { auth, db } from '@/shared/lib/firebase';
import { useLiveDoc } from '@/shared/lib/firestore-live';
import type { CountryMarks } from '@/shared/types/domain';

export function useCountryMarks() {
  const user = useSession((s) => s.user);
  const ref = useMemo(
    () => (user ? doc(db, 'countryMarks', user.uid) : null),
    [user?.uid],
  );

  return useLiveDoc<CountryMarks>(['countryMarks', user?.uid], ref, (_, data) => ({
    countries: (data.countries ?? {}) as CountryMarks['countries'],
  }));
}

/** Mark a country visited/planned, or clear the mark with null. */
export async function setCountryMark(
  iso: string,
  status: 'visited' | 'planned' | null,
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  await setDoc(
    doc(db, 'countryMarks', uid),
    { countries: { [iso]: status ?? deleteField() } },
    { merge: true },
  );
}
