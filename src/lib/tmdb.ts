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

const tmdbApiCache = new Map<string, { data: any; expires: number }>();

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

  const cacheKey = url.toString();
  const cached = tmdbApiCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate: 600 },
  });

  if (!res.ok) {
    throw new Error(`TMDB fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const filtered = filterTmdbResponse(data);
  
  tmdbApiCache.set(cacheKey, { data: filtered, expires: Date.now() + 300000 }); // Cache for 5 mins
  return filtered;
}

// In-memory cache for TMDB anime show lookups (keyed by anime name + year)
const tmdbShowCache = new Map<string, { id: number; expires: number }>();

export interface TmdbEpisodeData {
  seasonNum: number;
  episodeNum: number;
  title: string;
  thumbnail: string | null;
  description: string | null;
  vote_average?: number;
  runtime?: number;
}

export interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  episodes: TmdbEpisodeData[];
}

function getCleanBaseTitle(title: string): string {
  let base = title
    .replace(/\s+(?:[0-9]+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season\b/i, "")
    .replace(/\s+season\s+[0-9]+\b/i, "")
    .replace(/\s+s[0-9]+\b/i, "")
    .replace(/\s+part\s+[0-9]+\b/i, "")
    .replace(/\s+cour\s+[0-9]+\b/i, "")
    .replace(/\s+final\s+season\b/i, "")
    .replace(/\s+第\s*[0-9]+\s*期/g, "")
    .trim();

  const parts = base.split(/\s+-\s+|:\s*|：\s*|–\s*/);
  if (parts.length > 1) {
    const firstPart = parts[0].trim();
    if (firstPart.length > 2) {
      base = firstPart;
    }
  }

  return base;
}

function normalizeName(s: string): string[] {
  const stopWords = new Set(["the", "a", "an", "of", "and", "in", "to", "for", "with", "on", "at", "by", "is", "das", "der", "die", "el", "la", "le", "les"]);
  return s.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w));
}

function nameMatches(searchName: string, tmdbName: string): boolean {
  const words = normalizeName(searchName);
  if (words.length === 0) return true;
  const tmdbWords = normalizeName(tmdbName);
  if (tmdbWords.length === 0) return true;

  const tmdbWordsSet = new Set(tmdbWords);
  const matched = words.filter(w => tmdbWordsSet.has(w)).length;
  
  const minLength = Math.min(words.length, tmdbWords.length);
  const ratio = matched / minLength;
  return ratio >= 0.75;
}

export async function searchTmdbShow(name: string, year?: number): Promise<number | null> {
  const cacheKey = `${name}:${year || ""}`;
  const cached = tmdbShowCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.id;

  try {
    const baseTitle = getCleanBaseTitle(name);
    const queries = [baseTitle, name];
    let results: any[] = [];
    let queryUsed = "";

    for (const query of queries) {
      if (!query) continue;
      const cleanQuery = query.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
      if (!cleanQuery) continue;
      
      const params: Record<string, string> = { query: cleanQuery, language: "en-US" };
      const data = await tmdbFetch("/search/tv", params) as { results?: any[] };
      if (data?.results?.length) {
        results = data.results;
        queryUsed = query;
        break;
      }
    }

    if (results.length === 0) return null;

    // Prefer Japanese-language results (actual anime, not live-action lookalikes)
    const japaneseResults = results.filter(r => r.original_language === "ja");
    const candidatePool = japaneseResults.length > 0 ? japaneseResults : results;

    // First pass: Japanese name match + year match
    for (const show of candidatePool) {
      if (!nameMatches(queryUsed, show.name)) continue;
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

    // Second pass: Japanese name match only (relax year)
    for (const show of candidatePool) {
      if (nameMatches(queryUsed, show.name)) {
        tmdbShowCache.set(cacheKey, { id: show.id, expires: Date.now() + 86400000 });
        return show.id;
      }
    }

    // Third pass: non-Japanese results only if nothing Japanese matched
    if (japaneseResults.length === 0) {
      for (const show of results) {
        if (nameMatches(queryUsed, show.name)) {
          tmdbShowCache.set(cacheKey, { id: show.id, expires: Date.now() + 86400000 });
          return show.id;
        }
      }
    }

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
          vote_average?: number;
          runtime?: number;
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
          vote_average: ep.vote_average,
          runtime: ep.runtime,
        });
      }
    } catch {
      // Season not found, skip
    }
  }

  return episodeMap;
}

/**
 * Fetch a full TMDB season (with overview + episodes) for a TV show.
 * Returns null if the season doesn't exist.
 */
export async function fetchTmdbSeason(
  tmdbId: number,
  seasonNumber: number
): Promise<TmdbSeason | null> {
  try {
    const data = await tmdbFetch(`/tv/${tmdbId}/season/${seasonNumber}`) as {
      id: number;
      season_number: number;
      name: string;
      overview?: string;
      episodes?: {
        episode_number: number;
        name: string;
        overview: string | null;
        still_path: string | null;
        vote_average?: number;
        runtime?: number;
      }[];
    };

    return {
      id: data.id,
      season_number: data.season_number,
      name: data.name,
      overview: data.overview,
      episodes: (data.episodes || []).map((ep) => ({
        seasonNum: data.season_number,
        episodeNum: ep.episode_number,
        title: ep.name || "",
        thumbnail: ep.still_path
          ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
          : null,
        description: ep.overview || null,
        vote_average: ep.vote_average,
        runtime: ep.runtime,
      })),
    };
  } catch {
    return null;
  }
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
