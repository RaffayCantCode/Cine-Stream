/**
 * Shared anime client-cache configuration.
 *
 * Bump ANIME_API_VERSION whenever the shape of anime meta/episodes responses
 * changes. It is part of every anime fetch URL, so old browser/CDN entries are
 * never mixed with new data.
 */
export const ANIME_API_VERSION = "v56-sync";

export function animeMetaUrl(id: string): string {
  return `/api/anime/${encodeURIComponent(id)}/meta?v=${ANIME_API_VERSION}`;
}

export function animeMetaCacheKey(id: string): string {
  return `cs_anime_meta_${id}_${ANIME_API_VERSION}`;
}

export function animeEpisodesCacheKey(id: string, seasonId: string): string {
  return `cs_anime_eps_${id}_${seasonId}_${ANIME_API_VERSION}`;
}
