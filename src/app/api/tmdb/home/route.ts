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
      tmdbFetch("/movie/now_playing", { page: "1", include_adult: "false" }),
      tmdbFetch("/tv/popular", { page: "1", include_adult: "false" }),
      tmdbFetch("/tv/top_rated", { page: "1", include_adult: "false" }),
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

    // Strip Japanese animated content (anime) from movie/TV result arrays.
    // The dedicated animeMovies/animeTv keys (results[11], results[12]) are
    // intentionally excluded from this filter — they are the anime home row data.
    const excludeAnime = (items: any[]): any[] =>
      items.filter(
        (item) => !(item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16))
      );

    const topRatedMoviesRaw = excludeAnime(extractResults(results[2]) as any[]);
    // Deduplicate top rated movies by ID
    const uniqueTopRatedMoviesMap = new Map();
    topRatedMoviesRaw.forEach((item: any) => {
      if (item?.id && !uniqueTopRatedMoviesMap.has(item.id)) {
        uniqueTopRatedMoviesMap.set(item.id, item);
      }
    });
    const shuffledTopRatedMovies = dailySeededShuffle(Array.from(uniqueTopRatedMoviesMap.values()));

    const topRatedTvRaw = (extractResults(results[5]) as any[]).filter(
      (item: any) => !(item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16))
    );
    // Deduplicate top rated TV by ID
    const uniqueTopRatedTvMap = new Map();
    topRatedTvRaw.forEach((item: any) => {
      if (item?.id && !uniqueTopRatedTvMap.has(item.id)) {
        uniqueTopRatedTvMap.set(item.id, item);
      }
    });
    const shuffledTopRatedTv = dailySeededShuffle(Array.from(uniqueTopRatedTvMap.values()));

    const genresRes = results[11];
    const genres = (genresRes.status === "fulfilled" && genresRes.value && typeof genresRes.value === "object" && "genres" in genresRes.value)
      ? (genresRes.value as { genres?: unknown[] }).genres || []
      : [];

    return Response.json({
      trending: { results: extractResults(results[0]) },
      popularMovies: { results: excludeAnime(extractResults(results[1]) as any[]) },
      topRatedMovies: { results: shuffledTopRatedMovies },
      nowPlaying: { results: excludeAnime(extractResults(results[3]) as any[]) },
      popularTv: { results: excludeAnime(extractResults(results[4]) as any[]) },
      topRatedTv: { results: shuffledTopRatedTv },
      onTheAir: { results: excludeAnime(extractResults(results[6]) as any[]) },
      animeMovies: { results: extractResults(results[7]) },
      animeTv: { results: extractResults(results[8]) },
      trendingMoviesToday: { results: excludeAnime(extractResults(results[9]) as any[]) },
      trendingTvToday: { results: excludeAnime(extractResults(results[10]) as any[]) },
      genres: { genres },
    }, { headers: cacheHeaders(7200) });
  } catch (error) {
    console.error("[TMDB Home API Error]:", error);
    return Response.json({ error: "Failed to fetch home media" }, { status: 500 });
  }
}

