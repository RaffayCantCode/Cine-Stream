import { fetchJson } from "@/lib/utils";

/**
 * Shared anime client-cache configuration.
 *
 * Bump ANIME_API_VERSION whenever the shape of anime meta/episodes responses
 * changes. It is part of every anime fetch URL, so old browser/CDN entries are
 * never mixed with new data.
 */
export const ANIME_API_VERSION = "v62-fast-episodes";

export function animeMetaUrl(id: string): string {
  return `/api/anime/${encodeURIComponent(id)}/meta?v=${ANIME_API_VERSION}`;
}

export function animeMetaCacheKey(id: string): string {
  return `cs_anime_meta_${id}_${ANIME_API_VERSION}`;
}

export function animeEpisodesCacheKey(id: string, seasonId: string): string {
  return `cs_anime_eps_${id}_${seasonId}_${ANIME_API_VERSION}`;
}

const ANIME_PREVIEW_MEMORY = new Map<string, { data: any; timestamp: number }>();
const ANIME_PREVIEW_TTL = 15 * 60 * 1000;

export function cacheAnimePreview(id: string | number, rawItem: any): void {
  if (!id || !rawItem) return;
  const cleanId = String(id).trim();
  if (!cleanId) return;

  const title =
    typeof rawItem.name === "string"
      ? rawItem.name
      : rawItem.name?.english || rawItem.name?.romaji || rawItem.title || "";
  if (!title) return;

  const poster =
    rawItem.poster ||
    (rawItem.poster_path
      ? rawItem.poster_path.startsWith("http")
        ? rawItem.poster_path
        : `https://image.tmdb.org/t/p/w500${rawItem.poster_path.startsWith("/") ? rawItem.poster_path : `/${rawItem.poster_path}`}`
      : "");

  const bannerImage =
    rawItem.bannerImage ||
    rawItem.backdrop ||
    (rawItem.backdrop_path
      ? rawItem.backdrop_path.startsWith("http")
        ? rawItem.backdrop_path
        : `https://image.tmdb.org/t/p/original${rawItem.backdrop_path.startsWith("/") ? rawItem.backdrop_path : `/${rawItem.backdrop_path}`}`
      : null);

  const subCount =
    typeof rawItem.episodes === "number"
      ? rawItem.episodes
      : rawItem.episodes?.sub ?? null;

  const preview = {
    id: cleanId,
    idMal: rawItem.idMal || null,
    name: title,
    jname: rawItem.jname || null,
    poster,
    bannerImage,
    backdrop: bannerImage,
    description: rawItem.description || rawItem.overview || "",
    rating:
      rawItem.rating ||
      (typeof rawItem.vote_average === "number" && rawItem.vote_average > 0
        ? rawItem.vote_average.toFixed(1)
        : null),
    genres: Array.isArray(rawItem.genres) ? rawItem.genres : [],
    status: rawItem.status || null,
    season: rawItem.season || null,
    seasonYear:
      rawItem.seasonYear ||
      (rawItem.first_air_date ? parseInt(String(rawItem.first_air_date).slice(0, 4), 10) : null) ||
      (rawItem.release_date ? parseInt(String(rawItem.release_date).slice(0, 4), 10) : null),
    format: rawItem.format || rawItem.type || "TV",
    type: rawItem.type || rawItem.format || "TV",
    episodes: { sub: subCount, dub: rawItem.episodes?.dub ?? null },
    totalEpisodes: subCount || 12,
    coverColor: rawItem.coverColor || null,
    _isPreviewSeed: true,
  };

  ANIME_PREVIEW_MEMORY.set(cleanId, { data: preview, timestamp: Date.now() });
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        `cs_anime_preview_${cleanId}`,
        JSON.stringify({ data: preview, timestamp: Date.now() })
      );
    } catch {}
  }
}

export function getAnimePreview(id: string | number): any | null {
  if (!id) return null;
  const cleanId = String(id).trim();
  const mem = ANIME_PREVIEW_MEMORY.get(cleanId);
  if (mem && Date.now() - mem.timestamp < ANIME_PREVIEW_TTL) {
    return mem.data;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(`cs_anime_preview_${cleanId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data && Date.now() - (parsed.timestamp || 0) < ANIME_PREVIEW_TTL) {
          ANIME_PREVIEW_MEMORY.set(cleanId, parsed);
          return parsed.data;
        }
      }
    } catch {}
  }
  return null;
}

const IN_FLIGHT_PRELOADS = new Set<string>();

/**
 * Pre-warms both the anime metadata AND the active season's episode list on card hover/touch/click
 * so that opening `/anime/[id]` renders the hero and episode grid with zero waterfall delay.
 */
export function preloadAnimePageData(id: string | number, seedItem?: any): void {
  if (typeof window === "undefined" || !id) return;
  const cleanId = String(id).trim();
  if (!cleanId) return;

  if (seedItem) {
    cacheAnimePreview(cleanId, seedItem);
  }

  if (IN_FLIGHT_PRELOADS.has(cleanId)) return;
  IN_FLIGHT_PRELOADS.add(cleanId);

  const metaKey = animeMetaCacheKey(cleanId);
  try {
    const existingMeta = sessionStorage.getItem(metaKey);
    if (existingMeta) {
      const parsed = JSON.parse(existingMeta);
      if (parsed?.success && parsed?.data?.anime && Date.now() - (parsed._cachedAt || 0) < 2 * 60 * 1000) {
        IN_FLIGHT_PRELOADS.delete(cleanId);
        return;
      }
    }
  } catch {}

  fetchJson<any>(animeMetaUrl(cleanId))
    .then((metaData) => {
      if (!metaData?.success || !metaData?.data?.anime) return;
      try {
        sessionStorage.setItem(metaKey, JSON.stringify({ ...metaData, _cachedAt: Date.now() }));
      } catch {}

      const a = metaData.data.anime;
      const seasons = a.seasons || [];
      const activeSeason =
        seasons.find((s: any) => String(s.id) === cleanId) ||
        seasons.find((s: any) => s.isCurrent) ||
        seasons[0];
      const seasonId = String(activeSeason?.id || metaData.data.openedSeasonId || a.openedSeasonId || a.id || cleanId);
      const epKey = animeEpisodesCacheKey(cleanId, seasonId);

      try {
        if (sessionStorage.getItem(epKey)) return;
      } catch {}

      const sName = activeSeason?.name || a.name || "";
      const sTot = activeSeason?.totalEpisodes || a.totalEpisodes || 0;
      const effectiveTmdbId = activeSeason?.tmdbId ?? a.tmdbId ?? null;
      const effectiveTmdbSeason = activeSeason?.tmdbSeasonNumber ?? null;
      const effectiveOffset = activeSeason?.episodeOffset ?? 0;

      const tmdbQ = effectiveTmdbId != null ? `&tmdbId=${effectiveTmdbId}` : "";
      const tsQ = effectiveTmdbSeason != null ? `&tmdbSeason=${effectiveTmdbSeason}` : "";
      const offQ = effectiveOffset != null ? `&episodeOffset=${effectiveOffset}` : "";
      const nameQ = sName ? `&seasonName=${encodeURIComponent(sName)}` : "";
      const totQ = sTot > 0 ? `&totalEpisodes=${sTot}` : "";

      return fetchJson<any>(
        `/api/anime/${encodeURIComponent(cleanId)}/episodes?seasonId=${encodeURIComponent(seasonId)}${tmdbQ}${tsQ}${offQ}${nameQ}${totQ}&v=${ANIME_API_VERSION}`
      ).then((epRes) => {
        const eps = epRes?.data?.episodes;
        if (epRes?.success && Array.isArray(eps) && eps.length > 0) {
          const hasRealData = eps.some((ep: any) => !ep.isPlaceholder && (ep.title !== `Episode ${ep.episodeNum}` || ep.thumbnail));
          if (hasRealData) {
            try {
              sessionStorage.setItem(
                epKey,
                JSON.stringify({
                  episodes: eps.map((ep: any) => ({ ...ep, seasonId })),
                  seasonOverview: epRes.data?.seasonOverview || null,
                  status: a.status || "",
                  _cachedAt: Date.now(),
                })
              );
            } catch {}
          }
        }
      });
    })
    .catch(() => {})
    .finally(() => {
      IN_FLIGHT_PRELOADS.delete(cleanId);
    });
}
