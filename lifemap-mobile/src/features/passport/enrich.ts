import { useQuery } from '@tanstack/react-query';

export type Enrichment = {
  imageUrl: string | null;
  summary: string | null;
  wikiTitle: string | null;
};

/**
 * Best-effort "official-looking" info for an establishment, from Wikipedia's
 * REST API — keyless and free, unlike Google/Foursquare Places (which need
 * billing this project won't enable).
 *
 * Honest about its limits: Wikipedia has articles for famous hotels, beaches
 * and attractions, but almost never for an individual restaurant. When there's
 * no confident match we return nulls and the UI leans on the user's own
 * photos. This is the enrichment ceiling on a no-billing stack.
 */
async function fetchEnrichment(query: string): Promise<Enrichment> {
  const empty: Enrichment = { imageUrl: null, summary: null, wikiTitle: null };

  // 1) Find the best-matching page title.
  const searchUrl =
    `https://en.wikipedia.org/w/rest.php/v1/search/page` +
    `?q=${encodeURIComponent(query)}&limit=1`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'User-Agent': 'LifeMapAI/1.0 (personal travel journal)' },
  });
  if (!searchRes.ok) return empty;

  const search = (await searchRes.json()) as {
    pages?: { title: string }[];
  };
  const title = search.pages?.[0]?.title;
  if (!title) return empty;

  // 2) Pull the summary + thumbnail for that page.
  const summaryUrl =
    `https://en.wikipedia.org/api/rest_v1/page/summary/` +
    encodeURIComponent(title);
  const summaryRes = await fetch(summaryUrl, {
    headers: { 'User-Agent': 'LifeMapAI/1.0 (personal travel journal)' },
  });
  if (!summaryRes.ok) return { ...empty, wikiTitle: title };

  const data = (await summaryRes.json()) as {
    extract?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  };

  return {
    imageUrl: data.originalimage?.source ?? data.thumbnail?.source ?? null,
    summary: data.extract ?? null,
    wikiTitle: title,
  };
}

/** Fetches enrichment for a chosen establishment name; disabled until asked. */
export function useEnrichment(query: string | null) {
  return useQuery({
    queryKey: ['enrichment', query],
    queryFn: () => fetchEnrichment(query!),
    enabled: !!query,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
