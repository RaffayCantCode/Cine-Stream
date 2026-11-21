import { tmdbFetch } from "@/lib/tmdb";
import {
  applyMediaOverride,
  getMediaOverride,
} from "@/lib/media-overrides";
import type { MediaOverride } from "@/lib/db/schema";

const IMAGE_LANGUAGES = "en,null,ja,es,fr,de,it,pt,ru,ko,zh";
const MOVIE_APPEND = "credits,videos,similar,recommendations,images,release_dates";
const TV_APPEND = "credits,videos,similar,recommendations,images,content_ratings";

export interface TmdbDetailsResult {
  data: Record<string, any> | null;
  hidden: boolean;
  error?: string;
}

function isAnime(item: any): boolean {
  return (
    item?.original_language === "ja" &&
    Array.isArray(item?.genre_ids) &&
    item.genre_ids.includes(16)
  );
}

function compactResult(item: any): any {
  return {
    id: item?.id,
    title: item?.title,
    name: item?.name,
    poster_path: item?.poster_path,
    backdrop_path: item?.backdrop_path,
    media_type: item?.media_type,
    release_date: item?.release_date,
    first_air_date: item?.first_air_date,
    vote_average: item?.vote_average,
    vote_count: item?.vote_count,
    original_language: item?.original_language,
    genre_ids: item?.genre_ids,
    profile_path: item?.profile_path,
  };
}

function cleanRecommendations(result: Record<string, any>): void {
  const recs = result.recommendations as { results?: any[] } | undefined;
  const similar = result.similar as { results?: any[] } | undefined;

  if (Array.isArray(recs?.results)) {
    recs.results = recs.results
      .filter((item) => !isAnime(item))
      .slice(0, 20)
      .map(compactResult);
  }
  if (Array.isArray(similar?.results)) {
    similar.results = similar.results
      .filter((item) => !isAnime(item))
      .slice(0, 20)
      .map(compactResult);
  }
}

function compactVideoResults(results: any[]): any[] {
  return results
    .filter(
      (video) =>
        video?.site === "YouTube" &&
        (video?.type === "Trailer" || video?.type === "Teaser")
    )
    .slice(0, 10);
}

export function compactSeasonData(season: any): any {
  if (!season || typeof season !== "object") return season;

  return {
    id: season.id,
    season_number: season.season_number,
    name: season.name,
    overview: season.overview,
    poster_path: season.poster_path,
    air_date: season.air_date,
    videos:
      season.videos && Array.isArray(season.videos.results)
        ? { results: compactVideoResults(season.videos.results) }
        : undefined,
    episodes: Array.isArray(season.episodes)
      ? season.episodes.map((episode: any) => ({
          id: episode?.id,
          episode_number: episode?.episode_number,
          name: episode?.name,
          overview: episode?.overview,
          still_path: episode?.still_path,
          air_date: episode?.air_date,
          vote_average: episode?.vote_average,
          vote_count: episode?.vote_count,
          runtime: episode?.runtime,
        }))
      : [],
  };
}

/**
 * The detail pages only use logos, YouTube trailers, and a small cast/crew
 * slice. Sending the full TMDB `images`, `videos`, and `credits` payloads made
 * the RSC payload several hundred KB larger than necessary.
 */
function extractContentRating(result: Record<string, any>): string | null {
  // 1. Movie release_dates
  const releaseDates = result.release_dates?.results;
  if (Array.isArray(releaseDates)) {
    const usEntry = releaseDates.find((r: any) => r?.iso_3166_1 === "US");
    const preferred = [usEntry, ...releaseDates].filter(Boolean);
    for (const entry of preferred) {
      const dates = Array.isArray(entry.release_dates) ? entry.release_dates : [];
      for (const d of dates) {
        const cert = String(d?.certification || "").trim();
        if (cert) return cert;
      }
    }
  }
  // 2. TV content_ratings
  const contentRatings = result.content_ratings?.results;
  if (Array.isArray(contentRatings)) {
    const usEntry = contentRatings.find((r: any) => r?.iso_3166_1 === "US");
    if (usEntry?.rating) return String(usEntry.rating).trim();
    const first = contentRatings.find((r: any) => r?.rating);
    if (first?.rating) return String(first.rating).trim();
  }
  return null;
}

function compactDetailPayload(result: Record<string, any>): void {
  const cert = extractContentRating(result);
  if (cert) {
    result.contentRating = cert;
  }
  delete result.release_dates;
  delete result.content_ratings;

  const images = result.images as Record<string, any> | undefined;
  if (images) {
    result.images = { logos: Array.isArray(images.logos) ? images.logos : [] };
  }

  const videos = result.videos as { results?: any[] } | undefined;
  if (videos && Array.isArray(videos.results)) {
    videos.results = compactVideoResults(videos.results);
  }

  const credits = result.credits as Record<string, any> | undefined;
  if (credits) {
    const cast = Array.isArray(credits.cast) ? credits.cast : [];
    const crew = Array.isArray(credits.crew) ? credits.crew : [];
    result.credits = {
      ...credits,
      cast: cast.slice(0, 30),
      crew: crew
        .filter(
          (person: any) =>
            person?.job === "Director" || person?.job === "Creator" || person?.job === "Executive Producer"
        )
        .slice(0, 12),
    };
  }
}

async function safeOverride(
  mediaType: "movie" | "tv",
  id: string
): Promise<MediaOverride | null> {
  try {
    return await getMediaOverride(mediaType, id);
  } catch {
    return null;
  }
}

/**
 * Fetches and normalises movie details for both the API route and the server
 * page. The page passes the result to the client as initial data, which removes
 * the extra browser -> API round-trip on first paint and on client navigation.
 */
export async function fetchMovieDetails(id: string): Promise<TmdbDetailsResult> {
  const overridePromise = safeOverride("movie", id);

  try {
    // The override lookup (DB) and TMDB request are independent — run them in
    // parallel so the page does not pay both latencies back to back.
    const [override, data] = await Promise.all([
      overridePromise,
      tmdbFetch(`/movie/${id}`, {
        append_to_response: MOVIE_APPEND,
        include_image_language: IMAGE_LANGUAGES,
      }),
    ]);

    if (override?.isHidden || override?.status === "hidden") {
      return { data: null, hidden: true };
    }

    if (!data || typeof data !== "object" || !(data as any).id) {
      if (override) {
        return { data: applyMediaOverride(null, override), hidden: false };
      }
      return { data: null, hidden: false, error: "Movie not found" };
    }

    // tmdbFetch returns its shared memory-cache object. Clone before trimming so
    // one request cannot remove fields that another request still needs.
    const result = structuredClone(data) as Record<string, any>;
    cleanRecommendations(result);
    compactDetailPayload(result);

    return { data: applyMediaOverride(result, override), hidden: false };
  } catch (error) {
    const fallbackOverride = await overridePromise;
    if (fallbackOverride?.isHidden || fallbackOverride?.status === "hidden") {
      return { data: null, hidden: true };
    }
    if (fallbackOverride) {
      return {
        data: applyMediaOverride(null, fallbackOverride),
        hidden: false,
      };
    }
    console.warn(`[TMDB] Movie details failed for ${id}:`, error);
    return { data: null, hidden: false, error: "Failed to fetch movie details" };
  }
}

/**
 * Fetches TV details without blocking on season/episode data.
 *
 * Bundling `season/1` into `append_to_response` meant the detail page could
 * not render until TMDB had serialised every episode (and its videos) of the
 * first season — often several seconds for long-running shows. The client
 * already loads the active season on demand (and caches it per session), so
 * the show hero now paints as soon as the show record arrives.
 */
export async function fetchTvDetails(id: string): Promise<TmdbDetailsResult> {
  const overridePromise = safeOverride("tv", id);

  try {
    // Run the override lookup and the TMDB request concurrently.
    const [override, data] = await Promise.all([
      overridePromise,
      tmdbFetch(`/tv/${id}`, {
        append_to_response: TV_APPEND,
        include_image_language: IMAGE_LANGUAGES,
      }),
    ]);

    if (override?.isHidden || override?.status === "hidden") {
      return { data: null, hidden: true };
    }

    if (!data || typeof data !== "object" || !(data as any).id) {
      if (override) {
        return { data: applyMediaOverride(null, override), hidden: false };
      }
      return { data: null, hidden: false, error: "TV show not found" };
    }

    // tmdbFetch returns its shared memory-cache object. Clone before trimming
    // so one request cannot remove fields that another request still needs.
    const result = structuredClone(data) as Record<string, any>;
    cleanRecommendations(result);
    compactDetailPayload(result);

    return { data: applyMediaOverride(result, override), hidden: false };
  } catch (error) {
    const fallbackOverride = await overridePromise;
    if (fallbackOverride?.isHidden || fallbackOverride?.status === "hidden") {
      return { data: null, hidden: true };
    }
    if (fallbackOverride) {
      return {
        data: applyMediaOverride(null, fallbackOverride),
        hidden: false,
      };
    }
    console.warn(`[TMDB] TV details failed for ${id}:`, error);
    return { data: null, hidden: false, error: "Failed to fetch TV show details" };
  }
}
