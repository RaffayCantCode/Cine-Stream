// AniZip — small, cached client for the ani.zip mapping + episode index.
// Used to resolve AniList <-> TMDB/MAL identity and per-episode air dates.

const ANI_ZIP_BASE = "https://api.ani.zip";
const ANI_ZIP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 CineStream/1.0";
const ANI_ZIP_REVALIDATE = 86400; // 24h

export interface AniZipEpisode {
  episode: number;
  seasonNumber?: number;
  episodeNumber?: number;
  title?: {
    en?: string;
    "x-jat"?: string;
    ja?: string;
  };
  overview?: string;
  summary?: string;
  airDate?: string;
  image?: string;
  malId?: number | null;
}

export interface AniZipMapping {
  tmdbId: number | null;
  malId: number | null;
  /** Keyed by absolute episode number. */
  episodes: Map<number, AniZipEpisode>;
  /** Highest known episode number, or null. */
  maxEpisode: number | null;
}

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

async function fetchAniZip(
  url: string
): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ANI_ZIP_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getAniZipMapping(
  anilistId: string | number
): Promise<AniZipMapping | null> {
  const data = await fetchAniZip(`${ANI_ZIP_BASE}/mappings?anilist_id=${anilistId}`);
  if (!data || data.found === false) return null;

  const mappings = data.mappings || {};
  const tmdbId = toNum(mappings.themoviedb_id);
  const malId = toNum(mappings.mal_id);

  const episodes = new Map<number, AniZipEpisode>();
  let maxEpisode: number | null = null;
  if (data.episodes && typeof data.episodes === "object") {
    for (const key of Object.keys(data.episodes)) {
      const num = parseInt(key, 10);
      if (Number.isNaN(num)) continue;
      const ep = data.episodes[key];
      if (!ep) continue;
      const airDate = typeof ep.airDate === "string" ? ep.airDate : typeof ep.airdate === "string" ? ep.airdate : undefined;
      let image = typeof ep.image === "string" ? ep.image : undefined;
      if (image) {
        // Reject cover/banner images that get reused for every episode —
        // they are not episode thumbnails and cause duplicated thumbnails.
        if (image.includes("/cover/") || image.includes("/banner/") || /\/bx\d+[-]/.test(image)) {
          image = undefined;
        }
      }
      episodes.set(num, {
        episode: num,
        seasonNumber: toNum(ep.seasonNumber) ?? undefined,
        episodeNumber: toNum(ep.episodeNumber) ?? undefined,
        title: ep.title || undefined,
        overview: typeof ep.overview === "string" ? ep.overview : undefined,
        summary: typeof ep.summary === "string" ? ep.summary : undefined,
        airDate,
        image,
        malId: toNum(ep.malId) ?? toNum(ep.mal_id) ?? null,
      });
      if (maxEpisode === null || num > maxEpisode) maxEpisode = num;
    }
  }

  return { tmdbId, malId, episodes, maxEpisode };
}

/** Resolve a TMDB ID to its canonical AniList ID (used by the redirect route). */
export async function getAniListIdFromTmdb(tmdbId: string | number): Promise<number | null> {
  const data = await fetchAniZip(`${ANI_ZIP_BASE}/mappings?themoviedb_id=${tmdbId}`);
  const anilistId = toNum(data?.mappings?.anilist_id);
  return anilistId;
}
