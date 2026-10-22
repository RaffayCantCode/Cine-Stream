import { tmdbFetch } from "@/lib/tmdb";
import {
  applyMediaOverride,
  getMediaOverride,
} from "@/lib/media-overrides";
import type { MediaOverride } from "@/lib/db/schema";

const IMAGE_LANGUAGES = "en,null,ja,es,fr,de,it,pt,ru,ko,zh";
const BASE_APPEND = "credits,videos,similar,recommendations,images";

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
function compactDetailPayload(result: Record<string, any>): void {
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
      cast: cast.filter((person: any) => person?.profile_path).slice(0, 30),
      crew: crew
        .filter(
          (person: any) =>
            person?.profile_path &&
            (person?.job === "Director" || person?.job === "Creator")
        )
        .slice(0, 10),
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
        append_to_response: BASE_APPEND,
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
 * Fetches TV details and the first real season in one TMDB request whenever
 * possible. TMDB supports `append_to_response=season/1,season/1/videos`, so the
 * common case no longer pays for a second sequential request before the page
 * can render. Shows whose first real season is not 1 fall back to a single
 * on-demand season request.
 */
export async function fetchTvDetails(id: string): Promise<TmdbDetailsResult> {
  const overridePromise = safeOverride("tv", id);

  try {
    const startedAt = Date.now();
    // Run the override lookup and the (large) TMDB request concurrently.
    const [override, initialData] = await Promise.all([
      overridePromise,
      tmdbFetch(`/tv/${id}`, {
        append_to_response: `${BASE_APPEND},season/1,season/1/videos`,
        include_image_language: IMAGE_LANGUAGES,
      }),
    ]);

    if (override?.isHidden || override?.status === "hidden") {
      return { data: null, hidden: true };
    }

    let data = initialData;

    // Some very old / unusual entries do not have a season 1. Retry without the
    // season append so the show itself still renders. Only retry fast failures
    // (typically a 404); a timeout should not double the page's wait time.
    if (!data && Date.now() - startedAt < 3000) {
      data = await tmdbFetch(`/tv/${id}`, {
        append_to_response: BASE_APPEND,
        include_image_language: IMAGE_LANGUAGES,
      });
    }

    if (!data || typeof data !== "object" || !(data as any).id) {
      if (override) {
        return { data: applyMediaOverride(null, override), hidden: false };
      }
      return { data: null, hidden: false, error: "TV show not found" };
    }

    // tmdbFetch returns its shared memory-cache object. Clone before trimming
    // and removing the season/1 append keys so later requests can reuse the
    // cached payload.
    const result = structuredClone(data) as Record<string, any>;
    cleanRecommendations(result);
    compactDetailPayload(result);

    const seasons = Array.isArray(result.seasons) ? result.seasons : [];
    const firstSeasonNum =
      seasons.find((season: any) => Number(season?.season_number) > 0)
        ?.season_number ?? 1;

    let initialSeasonData = result["season/1"] as Record<string, any> | undefined;
    const seasonVideos = result["season/1/videos"] as
      | { results?: any[] }
      | undefined;

    if (initialSeasonData) {
      initialSeasonData = compactSeasonData({
        ...initialSeasonData,
        videos: seasonVideos ?? initialSeasonData.videos,
      });
    }

    // These are implementation details, not part of the public show payload.
    delete result["season/1"];
    delete result["season/1/videos"];

    if (!initialSeasonData || Number(firstSeasonNum) !== 1) {
      const fetchedSeason = (await tmdbFetch(
        `/tv/${id}/season/${firstSeasonNum}`,
        { append_to_response: "videos" }
      )) as Record<string, any> | null;
      initialSeasonData = fetchedSeason
        ? compactSeasonData(fetchedSeason)
        : undefined;
    }

    const finalResult = applyMediaOverride(result, override) as
      | Record<string, any>
      | null;

    if (finalResult && initialSeasonData) {
      finalResult._initialSeasonNum = Number(firstSeasonNum);
      finalResult._initialSeasonData = initialSeasonData;
    }

    return { data: finalResult, hidden: false };
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
