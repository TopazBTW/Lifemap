import { useMemo } from 'react';

import { useCountryMarks } from '@/features/map/useCountryMarks';
import { useMemories } from '@/features/memories/useMemories';
import { usePlaces } from '@/features/places/usePlaces';
import type { CountryEntry, CountryRollup } from '@/shared/types/domain';

/**
 * The world map's country rollup, derived **on-device**.
 *
 * The original design had a Cloud Function maintain a countryRollups doc, but
 * Functions require the Blaze plan and this project is free-tier-only. All
 * the source collections are already streamed to the client for their own
 * screens, so deriving here costs nothing extra and is never stale.
 *
 * An explicit user mark or any memory proves "visited"; place status ranks
 * visited > planned > saved.
 */
export function useCountryRollup(): { data: CountryRollup | null } {
  const { data: places = [] } = usePlaces();
  const { data: memories = [] } = useMemories();
  const { data: marks } = useCountryMarks();

  const data = useMemo<CountryRollup | null>(() => {
    const countries: Record<string, CountryEntry> = {};
    const entry = (iso: string): CountryEntry =>
      (countries[iso] ??= {
        status: 'none',
        placeCount: 0,
        memoryCount: 0,
        reelCount: 0,
      });

    const raise = (e: CountryEntry, status: 'visited' | 'planned' | 'saved') => {
      if (status === 'visited') e.status = 'visited';
      else if (status === 'planned' && e.status !== 'visited') e.status = 'planned';
      else if (e.status === 'none') e.status = 'saved';
    };

    for (const p of places) {
      if (!p.country) continue;
      const e = entry(p.country);
      e.placeCount += 1;
      if (p.sourceReelId) e.reelCount += 1;
      raise(e, p.status);
    }

    for (const m of memories) {
      if (!m.country) continue;
      const e = entry(m.country);
      e.memoryCount += 1;
      e.status = 'visited';
    }

    for (const [iso, status] of Object.entries(marks?.countries ?? {})) {
      raise(entry(iso), status);
    }

    return {
      ownerId: '',
      countries,
      updatedAt: null as never,
    };
  }, [places, memories, marks]);

  return { data };
}
