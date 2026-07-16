import { deleteField, doc, setDoc } from 'firebase/firestore';
import { useMemo } from 'react';

import { db } from '@/shared/lib/firebase';
import { useLiveDoc } from '@/shared/lib/firestore-live';
import type { CityMark, SpaceMarks } from '@/shared/types/domain';

/**
 * Visited/planned marks shared across a couple space. Mirrors the personal
 * countryMarks/cityMarks shape but lives at spaceMarks/{spaceId} so both
 * partners read and write the same "where we've been" layer.
 */
export function useSpaceMarks(spaceId: string | undefined) {
  const ref = useMemo(
    () => (spaceId ? doc(db, 'spaceMarks', spaceId) : null),
    [spaceId],
  );
  return useLiveDoc<SpaceMarks>(['spaceMarks', spaceId], ref, (_, data) => ({
    countries: (data.countries ?? {}) as SpaceMarks['countries'],
    cities: (data.cities ?? {}) as SpaceMarks['cities'],
  }));
}

export async function setSpaceCountryMark(
  spaceId: string,
  iso: string,
  status: 'visited' | 'planned' | null,
): Promise<void> {
  await setDoc(
    doc(db, 'spaceMarks', spaceId),
    { countries: { [iso]: status ?? deleteField() } },
    { merge: true },
  );
}

export async function setSpaceCityMark(
  spaceId: string,
  key: string,
  mark: CityMark | null,
): Promise<void> {
  await setDoc(
    doc(db, 'spaceMarks', spaceId),
    { cities: { [key]: mark ?? deleteField() } },
    { merge: true },
  );
}
