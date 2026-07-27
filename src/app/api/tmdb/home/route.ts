export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 3600;

function dailySeededShuffle<T>(array: T[]): T[] {
  if (!array || array.length === 0) return array;
  const today = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < today.length; i++) {
    seed = (seed * 31 + today.charCodeAt(i)) >>> 0;
  }
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const j = Math.floor((seed / 4294967296) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function GET(_request: NextRequest) {
  try {
    const results = await Promise.allSettled([
      tmdbFetch("/trending/all/week", { page: "1", include_adult: "false" }),
      tmdbFetch("/movie/popular", { page: "1", include_adult: "false" }),
      tmdbFetch("/movie/top_rated", { page: "1", include_adult: "false" }),
      tmdbFetch("/movie/top_rated", { page: "2", include_adult: "false" }),
      tmdbFetch("/movie/top_rated", { page: "3", include_adult: "false" }),
      tmdbFetch("/movie/now_playing", { page: "1", include_adult: "false" }),
      tmdbFetch("/tv/popular", { page: "1", include_adult: "false" }),
      tmdbFetch("/tv/top_rated", { page: "1", include_adult: "false" }),
      tmdbFetch("/tv/top_rated", { page: "2", include_adult: "false" }),
      tmdbFetch("/tv/top_rated", { page: "3", include_adult: "false" }),
      tmdbFetch("/tv/on_the_air", { page: "1", include_adult: "false" }),
      tmdbFetch("/discover/movie", { page: "1", with_original_language: "ja", with_genres: "16", include_adult: "false" }),
      tmdbFetch("/discover/tv", { page: "1", with_original_language: "ja", with_genres: "16", include_adult: "false" }),
      tmdbFetch("/trending/movie/day", { page: "1", include_adult: "false" }),
      tmdbFetch("/trending/tv/day", { page: "1", include_adult: "false" }),
      tmdbFetch("/genre/movie/list"),
    ]);

    const extractResults = (res: PromiseSettledResult<unknown>) => {
      if (res.status === "fulfilled" && res.value && typeof res.value === "object" && "results" in res.value) {
        return (res.value as { results?: unknown[] }).results || [];
      }
      return [];
    };

    const topRatedMoviesRaw = [
      ...extractResults(results[2]),
      ...extractResults(results[3]),
      ...extractResults(results[4]),
    ];
    // Deduplicate top rated movies by ID
    const uniqueTopRatedMoviesMap = new Map();
    topRatedMoviesRaw.forEach((item: any) => {
      if (item?.id && !uniqueTopRatedMoviesMap.has(item.id)) {
        uniqueTopRatedMoviesMap.set(item.id, item);
      }
    });
    const shuffledTopRatedMovies = dailySeededShuffle(Array.from(uniqueTopRatedMoviesMap.values()));

    const topRatedTvRaw = [
      ...extractResults(results[7]),
      ...extractResults(results[8]),
      ...extractResults(results[9]),
    ];
    // Deduplicate top rated TV by ID
    const uniqueTopRatedTvMap = new Map();
    topRatedTvRaw.forEach((item: any) => {
      if (item?.id && !uniqueTopRatedTvMap.has(item.id)) {
        uniqueTopRatedTvMap.set(item.id, item);
      }
    });
    const shuffledTopRatedTv = dailySeededShuffle(Array.from(uniqueTopRatedTvMap.values()));

    const genresRes = results[15];
    const genres = (genresRes.status === "fulfilled" && genresRes.value && typeof genresRes.value === "object" && "genres" in genresRes.value)
      ? (genresRes.value as { genres?: unknown[] }).genres || []
      : [];

    return Response.json({
      trending: { results: extractResults(results[0]) },
      popularMovies: { results: extractResults(results[1]) },
      topRatedMovies: { results: shuffledTopRatedMovies },
      nowPlaying: { results: extractResults(results[5]) },
      popularTv: { results: extractResults(results[6]) },
      topRatedTv: { results: shuffledTopRatedTv },
      onTheAir: { results: extractResults(results[10]) },
      animeMovies: { results: extractResults(results[11]) },
      animeTv: { results: extractResults(results[12]) },
      trendingMoviesToday: { results: extractResults(results[13]) },
      trendingTvToday: { results: extractResults(results[14]) },
      genres: { genres },
    }, { headers: cacheHeaders(3600) });
  } catch (error) {
    console.error("[TMDB Home API Error]:", error);
    return Response.json({ error: "Failed to fetch home media" }, { status: 500 });
  }
}

