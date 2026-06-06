const TMDB_BASE = "https://api.themoviedb.org/3";

const ADULT_KEYWORDS = [
  "porn",
  "adult",
  "erotic",
  "sex",
  "nude",
  "nudity",
  "explicit",
  "hardcore",
  "softcore",
  "xxx",
  "nsfw",
  "onlyfans",
  "camgirl",
  "webcam",
  "striptease",
  "burlesque",
  "erotica",
  "masturbation",
  "orgy",
  "bdsm",
  "fetish",
  "provocative",
  "seduction",
  "taboo",
  "playboy",
  "18+",
  "r18",
  "adults only",
  "mature audience",
];

function getAuthHeader(): string {
  const token = process.env.TMDB_API_KEY;
  if (!token || token === "") {
    throw new Error("TMDB_API_KEY is not set");
  }
  return `Bearer ${token}`;
}

export async function tmdbFetch(
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("include_adult", "false");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`TMDB fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return filterTmdbResponse(data);
}

// In-memory cache for TMDB anime show lookups (keyed by anime name + year)
const tmdbShowCache = new Map<string, { id: number; expires: number }>();

export interface TmdbEpisodeData {
  seasonNum: number;
  episodeNum: number;
  title: string;
  thumbnail: string | null;
  description: string | null;
}

/**
 * Search TMDB for a TV show by name + year, return the TMDB show ID.
 */
function normalizeName(s: string): string[] {
  const stopWords = new Set(["the", "a", "an", "of", "and", "in", "to", "for", "with", "on", "at", "by", "is", "das", "der", "die", "el", "la", "le", "les"]);
  return s.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

function nameMatches(searchName: string, tmdbName: string): boolean {
  const words = normalizeName(searchName);
  if (words.length === 0) return true;
  const tmdbWords = new Set(normalizeName(tmdbName));
  const matched = words.filter(w => tmdbWords.has(w)).length;
  return matched / words.length >= 0.5;
}

export async function searchTmdbShow(name: string, year?: number): Promise<number | null> {
  const cacheKey = `${name}:${year || ""}`;
  const cached = tmdbShowCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.id;

  try {
    const cleanName = name.replace(/[^\w\s]/g, "").trim();
    const params: Record<string, string> = { query: cleanName };
    const data = await tmdbFetch("/search/tv", params) as { results?: { id: number; name: string; first_air_date?: string }[] };
    const results = data?.results || [];

    for (const show of results) {
      if (!nameMatches(name, show.name)) continue;
      if (year) {
        const showYear = show.first_air_date ? parseInt(show.first_air_date.slice(0, 4), 10) : 0;
        if (showYear && Math.abs(showYear - year) <= 1) {
          tmdbShowCache.set(cacheKey, { id: show.id, expires: Date.now() + 86400000 });
          return show.id;
        }
      } else {
        tmdbShowCache.set(cacheKey, { id: show.id, expires: Date.now() + 86400000 });
        return show.id;
      }
    }

    // No match with name check — don't cache a wrong result, but don't block retries either
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch TMDB episode data for a given show and list of season numbers.
 * Returns a map keyed by "seasonNum-episodeNum".
 */
export async function fetchTmdbEpisodeData(
  tmdbId: number,
  seasonNumbers: number[]
): Promise<Map<string, TmdbEpisodeData>> {
  const episodeMap = new Map<string, TmdbEpisodeData>();

  for (const seasonNum of seasonNumbers) {
    try {
      const data = await tmdbFetch(`/tv/${tmdbId}/season/${seasonNum}`) as {
        episodes?: {
          episode_number: number;
          name: string;
          overview: string | null;
          still_path: string | null;
        }[];
      };
      const eps = data?.episodes || [];
      for (const ep of eps) {
        const key = `${seasonNum}-${ep.episode_number}`;
        episodeMap.set(key, {
          seasonNum,
          episodeNum: ep.episode_number,
          title: ep.name || "",
          thumbnail: ep.still_path
            ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
            : null,
          description: ep.overview || null,
        });
      }
    } catch {
      // Season not found, skip
    }
  }

  return episodeMap;
}

function filterTmdbResponse(data: unknown): unknown {
  if (!data || typeof data !== "object" || !("results" in data)) {
    return data;
  }

  const response = data as { results?: unknown[] };
  if (!Array.isArray(response.results)) {
    return data;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    ...response,
    results: response.results.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const media = item as {
        adult?: boolean;
        title?: string;
        name?: string;
        overview?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
        release_date?: string;
        first_air_date?: string;
      };

      if (media.adult === true) return false;
      if (!media.poster_path && !media.backdrop_path) return false;

      const searchable = `${media.title || ""} ${media.name || ""} ${media.overview || ""}`.toLowerCase();
      if (ADULT_KEYWORDS.some((keyword) => searchable.includes(keyword))) return false;

      const releaseStr = media.release_date || media.first_air_date;
      if (releaseStr) {
        const releaseDate = new Date(releaseStr);
        if (!isNaN(releaseDate.getTime()) && releaseDate > today) return false;
      }

      return true;
    }),
  };
}
