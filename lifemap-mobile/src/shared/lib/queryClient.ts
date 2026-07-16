import { QueryClient } from '@tanstack/react-query';

/**
 * Most reads in this app are Firestore snapshots pushed into the cache, so
 * queries are cheap to keep around. Long gcTime keeps navigation instant;
 * retries are conservative because Firestore's SDK already retries transport
 * failures internally.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
