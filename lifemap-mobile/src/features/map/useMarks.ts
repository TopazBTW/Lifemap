import { useMemo } from 'react';

import { useMySpace } from '@/features/couple/useSharedSpace';
import {
  setSpaceCityMark,
  setSpaceCountryMark,
  useSpaceMarks,
} from '@/features/couple/useSpaceMarks';
import { setCityMark, useCityMarks } from '@/features/map/useCityMarks';
import { setCountryMark, useCountryMarks } from '@/features/map/useCountryMarks';
import type { CityMark } from '@/shared/types/domain';

/**
 * The effective visited/planned marks for the current user, merging their
 * personal marks with any shared couple-space marks. Writes go to the shared
 * space when they're in one (so a partner sees them), else to personal marks.
 *
 * Every marks consumer — the map, the rollup, the location sheet — reads
 * through this so solo and couple modes behave identically.
 */
export function useMarks() {
  const { space } = useMySpace();
  const spaceId = space?.id ?? null;

  const { data: personalCountry } = useCountryMarks();
  const { data: personalCity } = useCityMarks();
  const { data: spaceMarks } = useSpaceMarks(spaceId ?? undefined);

  const countries = useMemo(
    () => ({
      ...(personalCountry?.countries ?? {}),
      ...(spaceMarks?.countries ?? {}),
    }),
    [personalCountry, spaceMarks],
  );

  const cities = useMemo(
    () => ({
      ...(personalCity?.cities ?? {}),
      ...(spaceMarks?.cities ?? {}),
    }),
    [personalCity, spaceMarks],
  );

  const setCountry = (iso: string, status: 'visited' | 'planned' | null) =>
    spaceId ? setSpaceCountryMark(spaceId, iso, status) : setCountryMark(iso, status);

  const setCity = (key: string, mark: CityMark | null) =>
    spaceId ? setSpaceCityMark(spaceId, key, mark) : setCityMark(key, mark);

  return { countries, cities, setCountry, setCity, shared: !!spaceId };
}
