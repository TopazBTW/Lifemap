import { doc } from 'firebase/firestore';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { db } from '@/shared/lib/firebase';
import { useLiveDoc } from '@/shared/lib/firestore-live';
import type { CountryRollup } from '@/shared/types/domain';

export function useCountryRollup() {
  const user = useSession((s) => s.user);
  const ref = useMemo(
    () => (user ? doc(db, 'countryRollups', user.uid) : null),
    [user?.uid],
  );

  return useLiveDoc<CountryRollup>(
    ['countryRollup', user?.uid],
    ref,
    (id, data) => ({ ...(data as Omit<CountryRollup, 'ownerId'>), ownerId: id }) as CountryRollup,
  );
}
