import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

type CountryEntry = {
  status: 'visited' | 'planned' | 'saved' | 'none';
  placeCount: number;
  memoryCount: number;
  reelCount: number;
  runCount: number;
};

/**
 * Recompute the per-user country rollup that paints the world map.
 *
 * Full recompute rather than incremental deltas: the read cost is a few hundred
 * docs for a heavy user, it runs off the hot path, and incremental counters
 * drift the moment any write path forgets to decrement. Correctness over
 * cleverness here — this is what the user actually looks at.
 *
 * If this becomes a bottleneck, the fix is debouncing (one recompute per user
 * per minute), not counter deltas.
 */
export async function recomputeCountryRollup(
  db: Firestore,
  ownerId: string,
): Promise<void> {
  const [places, memories, runs] = await Promise.all([
    db.collection('places').where('ownerId', '==', ownerId).get(),
    db.collection('memories').where('ownerId', '==', ownerId).get(),
    db.collection('runs').where('ownerId', '==', ownerId).get(),
  ]);

  const countries: Record<string, CountryEntry> = {};

  const entry = (iso: string): CountryEntry =>
    (countries[iso] ??= {
      status: 'none',
      placeCount: 0,
      memoryCount: 0,
      reelCount: 0,
      runCount: 0,
    });

  for (const doc of places.docs) {
    const iso = doc.get('country') as string | undefined;
    if (!iso) continue;
    const e = entry(iso);
    e.placeCount += 1;
    if (doc.get('sourceReelId')) e.reelCount += 1;

    // Status precedence: visited > planned > saved. A country you've been to
    // stays "visited" even if you also have places merely saved there.
    const status = doc.get('status') as string;
    if (status === 'visited') e.status = 'visited';
    else if (status === 'planned' && e.status !== 'visited') e.status = 'planned';
    else if (e.status === 'none') e.status = 'saved';
  }

  // A memory or a run in a country is proof you were physically there.
  for (const doc of memories.docs) {
    const iso = doc.get('country') as string | undefined;
    if (!iso) continue;
    const e = entry(iso);
    e.memoryCount += 1;
    e.status = 'visited';
  }

  for (const doc of runs.docs) {
    const iso = doc.get('country') as string | undefined;
    if (!iso) continue;
    const e = entry(iso);
    e.runCount += 1;
    e.status = 'visited';
  }

  await db
    .collection('countryRollups')
    .doc(ownerId)
    .set(
      { ownerId, countries, updatedAt: FieldValue.serverTimestamp() },
      { merge: false },
    );
}
