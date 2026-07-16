import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';

// NodeNext ESM: relative imports need the emitted .js extension, even from .ts.
import { extractPlaces } from './gemini.js';
import { geocode } from './geocode.js';
import { resolveReel } from './resolve.js';
import { recomputeCountryRollup } from './rollup.js';

initializeApp();
const db = getFirestore();

// Secrets live in Secret Manager, never in the app bundle or in code.
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const INSTAGRAM_OEMBED_TOKEN = defineSecret('INSTAGRAM_OEMBED_TOKEN');

/**
 * Reel extraction pipeline.
 *
 * Firestore-triggered rather than callable, deliberately: extraction takes
 * 10–30s, and a callable would tie that latency to a live client connection
 * that dies when the user backgrounds the app. Here the client just writes a
 * doc and watches `status`.
 */
export const onReelCreated = onDocumentCreated(
  {
    document: 'reels/{reelId}',
    secrets: [GEMINI_API_KEY, INSTAGRAM_OEMBED_TOKEN],
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const ref = snap.ref;
    const { url } = snap.data() as { url: string };

    try {
      await ref.update({ status: 'extracting', updatedAt: FieldValue.serverTimestamp() });

      const resolved = await resolveReel(url);

      if (resolved.kind === 'unresolved') {
        await ref.update({
          status: 'failed',
          errorMessage: resolved.reason,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const extraction = await extractPlaces(resolved);

      // Geocode each named place. Sequential rather than parallel: Nominatim
      // allows 1 req/s (throttled inside geocode.ts), so a burst of 20 from
      // a single import must queue, not fan out.
      const places = [];
      for (const place of extraction.places) {
        const hit = await geocode(place.name, { country: place.country });
        places.push({
          ...place,
          coordinates: hit ? { lat: hit.lat, lng: hit.lng } : null,
          country: place.country ?? hit?.country ?? null,
          city: place.city ?? hit?.city ?? null,
          // An unresolvable location caps confidence — we genuinely know less.
          confidence: hit ? place.confidence : Math.min(place.confidence, 0.4),
        });
      }

      await ref.update({
        status: places.length ? 'needs_review' : 'failed',
        errorMessage: places.length
          ? FieldValue.delete()
          : 'No identifiable places found in this content.',
        extraction: { places, summary: extraction.summary ?? null },
        thumbnailUrl:
          resolved.kind === 'text' ? (resolved.thumbnailUrl ?? null) : null,
        title: resolved.kind === 'text' ? (resolved.title ?? null) : null,
        authorHandle: resolved.kind === 'text' ? (resolved.author ?? null) : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('reel extraction failed', { url, err });
      await ref.update({
        status: 'failed',
        errorMessage:
          err instanceof Error ? err.message : 'Extraction failed unexpectedly.',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

const commitSchema = z.object({
  reelId: z.string().min(1),
  places: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.string(),
        coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable(),
        country: z.string().length(2).nullable(),
        city: z.string().nullable(),
        confidence: z.number(),
      }),
    )
    .max(20),
});

/**
 * Commit user-approved places to the map.
 *
 * Server-side so we can re-geocode stragglers and update the country rollup
 * atomically with the writes.
 */
export const commitReelPlaces = onCall(
  { timeoutSeconds: 120 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

    const parsed = commitSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Malformed request.');
    }
    const { reelId, places } = parsed.data;

    // Verify ownership — never trust a client-supplied reelId.
    const reelSnap = await db.collection('reels').doc(reelId).get();
    if (!reelSnap.exists || reelSnap.get('ownerId') !== uid) {
      throw new HttpsError('permission-denied', 'Not your reel.');
    }

    const batch = db.batch();
    const placeIds: string[] = [];

    for (const place of places) {
      let coords = place.coordinates;
      let country = place.country;

      if (!coords) {
        const hit = await geocode(place.name, { country });
        if (!hit) continue; // can't place it on a map; skip rather than fake it
        coords = { lat: hit.lat, lng: hit.lng };
        country ??= hit.country;
      }
      if (!country) continue;

      const ref = db.collection('places').doc();
      placeIds.push(ref.id);
      batch.set(ref, {
        ownerId: uid,
        name: place.name,
        kind: place.kind,
        status: 'saved',
        coordinates: coords,
        country,
        city: place.city ?? null,
        tags: [],
        sourceReelId: reelId,
        aiConfidence: place.confidence,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    batch.update(reelSnap.ref, {
      status: 'ready',
      placeIds: FieldValue.arrayUnion(...placeIds),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    await recomputeCountryRollup(db, uid);

    return { placeIds };
  },
);

/** Keep the world map's country colours in sync as places change. */
export const onPlaceWritten = onDocumentCreated('places/{placeId}', async (event) => {
  const ownerId = event.data?.get('ownerId') as string | undefined;
  if (ownerId) await recomputeCountryRollup(db, ownerId);
});
