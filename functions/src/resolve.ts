import { logger } from 'firebase-functions';

export type ReelPlatform = 'instagram' | 'tiktok' | 'youtube' | 'unknown';

/**
 * What we can actually give Gemini for a given link.
 *
 *  - `video`: Gemini ingests the video itself. **YouTube only** — the Gemini API
 *    accepts YouTube URLs, Files API uploads, or inline bytes, and nothing else.
 *    There is no supported way to hand it an Instagram/TikTok URL.
 *  - `text`: we resolved public oEmbed metadata (title/caption/author) and let
 *    Gemini extract places from *text*. Weaker, but legitimate and ToS-safe.
 *  - `unresolved`: we have nothing but a URL. The client must ask the user to
 *    paste the caption rather than us inventing places from a bare link.
 */
export type ResolvedReel =
  | { kind: 'video'; fileUri: string; platform: ReelPlatform }
  | {
      kind: 'text';
      platform: ReelPlatform;
      title?: string;
      caption?: string;
      author?: string;
      thumbnailUrl?: string;
    }
  | { kind: 'unresolved'; platform: ReelPlatform; reason: string };

export function detectPlatform(rawUrl: string): ReelPlatform {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
  const is = (...hosts: string[]) =>
    hosts.some((h) => host === h || host.endsWith(`.${h}`));

  if (is('instagram.com', 'instagr.am', 'ig.me')) return 'instagram';
  if (is('tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com')) return 'tiktok';
  if (is('youtube.com', 'youtu.be', 'm.youtube.com')) return 'youtube';
  return 'unknown';
}

export async function resolveReel(url: string): Promise<ResolvedReel> {
  const platform = detectPlatform(url);

  switch (platform) {
    case 'youtube':
      // The only platform Gemini can watch. Shorts URLs work as-is.
      return { kind: 'video', fileUri: url, platform };

    case 'tiktok':
      return resolveTikTok(url);

    case 'instagram':
      return resolveInstagram(url);

    default:
      return {
        kind: 'unresolved',
        platform,
        reason: 'Unsupported link. Use Instagram, TikTok or YouTube.',
      };
  }
}

/**
 * TikTok's oEmbed endpoint is public and unauthenticated. It gives us the
 * caption (as `title`) and author — enough for text-based extraction.
 */
async function resolveTikTok(url: string): Promise<ResolvedReel> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) {
      return {
        kind: 'unresolved',
        platform: 'tiktok',
        reason: `TikTok returned ${res.status}. The video may be private or removed.`,
      };
    }
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      kind: 'text',
      platform: 'tiktok',
      title: data.title,
      caption: data.title,
      author: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    };
  } catch (err) {
    logger.warn('tiktok oembed failed', { url, err });
    return {
      kind: 'unresolved',
      platform: 'tiktok',
      reason: 'Could not reach TikTok for this link.',
    };
  }
}

/**
 * Instagram's oEmbed requires a Facebook App access token
 * (`oembed_read` feature, app review required) — there is no public endpoint
 * since 2020. Without a token we cannot legitimately read the caption.
 *
 * Configure INSTAGRAM_OEMBED_TOKEN to enable; otherwise we degrade honestly and
 * let the client ask the user to paste the caption.
 */
async function resolveInstagram(url: string): Promise<ResolvedReel> {
  const token = process.env.INSTAGRAM_OEMBED_TOKEN;
  if (!token) {
    return {
      kind: 'unresolved',
      platform: 'instagram',
      reason:
        'Instagram captions need a Facebook app token. Paste the caption to extract places.',
    };
  }

  try {
    const endpoint =
      `https://graph.facebook.com/v21.0/instagram_oembed` +
      `?url=${encodeURIComponent(url)}&access_token=${token}&fields=title,author_name,thumbnail_url`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return {
        kind: 'unresolved',
        platform: 'instagram',
        reason: `Instagram returned ${res.status}. The post may be private.`,
      };
    }
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      kind: 'text',
      platform: 'instagram',
      title: data.title,
      caption: data.title,
      author: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    };
  } catch (err) {
    logger.warn('instagram oembed failed', { url, err });
    return {
      kind: 'unresolved',
      platform: 'instagram',
      reason: 'Could not reach Instagram for this link.',
    };
  }
}
