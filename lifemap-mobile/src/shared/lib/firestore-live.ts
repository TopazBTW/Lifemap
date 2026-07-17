import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  onSnapshot,
  type DocumentReference,
  type FirestoreError,
  type Query,
} from 'firebase/firestore';
import { useEffect } from 'react';

/**
 * Bridge Firestore's push model into React Query's cache.
 *
 * Firestore already handles offline persistence, dedupe and reconnection; what
 * React Query adds is a single cache the whole app reads through, so a place
 * committed on the review screen appears on the map with no manual wiring.
 *
 * The pattern: `onSnapshot` keeps `setQueryData` fresh; the `useQuery` beneath
 * never refetches on its own (staleTime: Infinity) — Firestore is the source
 * of truth for freshness.
 *
 * **Every listener MUST pass an onError callback.** Without one, a listener
 * error (most commonly `permission-denied` during sign-out or before a
 * couple-space membership resolves) is an *uncaught* async error — harmless in
 * dev (red box), but in a production/hosted build it can crash the whole app.
 * The handler swallows it and keeps the last-good data.
 */
function onListenerError(key: readonly unknown[]) {
  return (err: FirestoreError) => {
    // Expected and benign: fires whenever a listener outlives read access
    // (sign-out, token refresh, membership change). Keep the cached data.
    if (__DEV__) console.warn('live listener error', key, err.code);
  };
}

export function useLiveCollection<T>(
  key: readonly unknown[],
  query: Query | null,
  map: (id: string, data: Record<string, unknown>) => T,
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!query) return;
    const unsub = onSnapshot(
      query,
      (snap) => {
        const rows = snap.docs.map((d) =>
          map(d.id, d.data() as Record<string, unknown>),
        );
        qc.setQueryData(key, rows);
      },
      onListenerError(key),
    );
    return unsub;
    // key is a stable serialisable array; stringify avoids resubscribing on
    // every render from a new array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, JSON.stringify(key), query !== null]);

  return useQuery<T[]>({
    queryKey: key,
    queryFn: () => new Promise<T[]>(() => {}), // resolved by the snapshot above
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: query !== null,
  });
}

export function useLiveDoc<T>(
  key: readonly unknown[],
  ref: DocumentReference | null,
  map: (id: string, data: Record<string, unknown>) => T,
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!ref) return;
    const unsub = onSnapshot(
      ref,
      (snap) => {
        qc.setQueryData(
          key,
          snap.exists()
            ? map(snap.id, snap.data() as Record<string, unknown>)
            : null,
        );
      },
      onListenerError(key),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, JSON.stringify(key), ref !== null]);

  return useQuery<T | null>({
    queryKey: key,
    queryFn: () => new Promise<T | null>(() => {}),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: ref !== null,
  });
}
