// TMDB helpers for anime — primary source for seasons, episodes, titles,
// thumbnails (unique stills), runtimes and air dates. Reuses the shared
// tmdbFetch/cacheHeaders pipeline from @/lib/tmdb.

import { tmdbFetch } from "@/lib/tmdb";

export interface TmdbSeasonSummary {
  season_number: number;
  episode_count: number;
  name: string;
  overview: string | null;
}

export interface TmdbEpisode {
  episode_number: number;
  name: string;
  overview: string | null;
  still_path: string | null;
  air_date: string | null;
  vote_average: number | null;
  vote_count: number | null;
  runtime: number | null;
}

export interface TmdbSeasonEpisodes {
  season_number: number;
  name: string;
  overview: string | null;
  episodes: TmdbEpisode[];
}

export interface TmdbShow {
  id: number;
  name: string;
  overview: string | null;
  backdrop_path: string | null;
  seasons: TmdbSeasonSummary[];
}

export function tmdbStillUrl(stillPath: string | null | undefined): string | null {
  if (!stillPath) return null;
  return `https://image.tmdb.org/t/p/w500${stillPath}`;
}

export async function getTmdbShow(tmdbId: number): Promise<TmdbShow | null> {
  try {
    const data = (await tmdbFetch(`/tv/${tmdbId}`)) as
      | {
          id?: number;
          name?: string;
          overview?: string | null;
          backdrop_path?: string | null;
          seasons?: {
            season_number?: number;
            episode_count?: number;
            name?: string;
            overview?: string | null;
          }[];
        }
      | null;
    if (!data || !data.id) return null;

    return {
      id: data.id,
      name: data.name || "",
      overview: data.overview || null,
      backdrop_path: data.backdrop_path || null,
      seasons: (data.seasons || [])
        .filter(
          (s): s is { season_number: number; episode_count?: number; name?: string; overview?: string | null } =>
            typeof s.season_number === "number" && s.season_number >= 0 && (s.episode_count || 0) > 0
        )
        .map((s) => ({
          season_number: s.season_number,
          episode_count: s.episode_count || 0,
          name: s.name || "",
          overview: s.overview || null,
        })),
    };
  } catch {
    return null;
  }
}

export async function getTmdbSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number
): Promise<TmdbSeasonEpisodes | null> {
  try {
    const data = (await tmdbFetch(`/tv/${tmdbId}/season/${seasonNumber}`)) as
      | {
          season_number?: number;
          name?: string;
          overview?: string | null;
          episodes?: {
            episode_number?: number;
            name?: string;
            overview?: string | null;
            still_path?: string | null;
            air_date?: string | null;
            vote_average?: number | null;
            vote_count?: number | null;
            runtime?: number | null;
          }[];
        }
      | null;
    if (!data || !Array.isArray(data.episodes)) return null;

    return {
      season_number: data.season_number ?? seasonNumber,
      name: data.name || "",
      overview: data.overview || null,
      episodes: data.episodes
        .filter(
          (ep): ep is { episode_number: number; name?: string; overview?: string | null; still_path?: string | null; air_date?: string | null; vote_average?: number | null; vote_count?: number | null; runtime?: number | null } =>
            typeof ep.episode_number === "number"
        )
        .map((ep) => ({
          episode_number: ep.episode_number,
          name: ep.name || "",
          overview: ep.overview || null,
          still_path: ep.still_path || null,
          air_date: ep.air_date || null,
          vote_average: ep.vote_average || null,
          vote_count: ep.vote_count || null,
          runtime: ep.runtime || null,
        })),
    };
  } catch {
    return null;
  }
}
