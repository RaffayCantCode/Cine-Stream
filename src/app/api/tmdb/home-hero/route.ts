export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 3600;

export async function GET(_request: NextRequest) {
  const results = await Promise.allSettled([
    tmdbFetch("/trending/all/week", { page: "1", include_adult: "false" }),
    tmdbFetch("/movie/popular", { page: "1", include_adult: "false" }),
    tmdbFetch("/movie/top_rated", { page: "1", include_adult: "false" }),
    tmdbFetch("/movie/now_playing", { page: "1", include_adult: "false" }),
    tmdbFetch("/tv/popular", { page: "1", include_adult: "false" }),
    tmdbFetch("/tv/top_rated", { page: "1", include_adult: "false" }),
    tmdbFetch("/tv/on_the_air", { page: "1", include_adult: "false" }),
    tmdbFetch("/discover/movie", { page: "1", with_original_language: "ja", with_genres: "16", include_adult: "false" }),
    tmdbFetch("/discover/tv", { page: "1", with_original_language: "ja", with_genres: "16", include_adult: "false" }),
    tmdbFetch("/trending/movie/day", { page: "1", include_adult: "false" }),
    tmdbFetch("/trending/tv/day", { page: "1", include_adult: "false" }),
  ]);

  const extractResults = (res: PromiseSettledResult<unknown>) => {
    if (res.status === "fulfilled" && res.value && typeof res.value === "object" && "results" in res.value) {
      return (res.value as { results?: unknown[] }).results || [];
    }
    return [];
  };

  return Response.json({
    trending: { results: extractResults(results[0]) },
    popularMovies: { results: extractResults(results[1]) },
    topRatedMovies: { results: extractResults(results[2]) },
    nowPlaying: { results: extractResults(results[3]) },
    popularTv: { results: extractResults(results[4]) },
    topRatedTv: { results: extractResults(results[5]) },
    onTheAir: { results: extractResults(results[6]) },
    animeMovies: { results: extractResults(results[7]) },
    animeTv: { results: extractResults(results[8]) },
    trendingMoviesToday: { results: extractResults(results[9]) },
    trendingTvToday: { results: extractResults(results[10]) },
  }, { headers: cacheHeaders(3600) });
}

