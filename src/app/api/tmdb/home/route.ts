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
      // All-time most popular movies across 3 pages (vote_count >= 2000, rating >= 7.0)
      tmdbFetch("/discover/movie", { sort_by: "vote_count.desc", "vote_count.gte": "2000", "vote_average.gte": "7.0", include_adult: "false", page: "1" }),
      tmdbFetch("/discover/movie", { sort_by: "vote_count.desc", "vote_count.gte": "2000", "vote_average.gte": "7.0", include_adult: "false", page: "2" }),
      tmdbFetch("/discover/movie", { sort_by: "vote_count.desc", "vote_count.gte": "2000", "vote_average.gte": "7.0", include_adult: "false", page: "3" }),
      tmdbFetch("/movie/now_playing", { page: "1", include_adult: "false" }),
      tmdbFetch("/tv/popular", { page: "1", include_adult: "false" }),
      // All-time most popular TV shows across 3 pages (vote_count >= 1000, rating >= 7.5)
      tmdbFetch("/discover/tv", { sort_by: "vote_count.desc", "vote_count.gte": "1000", "vote_average.gte": "7.5", include_adult: "false", page: "1" }),
      tmdbFetch("/discover/tv", { sort_by: "vote_count.desc", "vote_count.gte": "1000", "vote_average.gte": "7.5", include_adult: "false", page: "2" }),
      tmdbFetch("/discover/tv", { sort_by: "vote_count.desc", "vote_count.gte": "1000", "vote_average.gte": "7.5", include_adult: "false", page: "3" }),
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

    const excludeTvNonShows = (items: any[]): any[] =>
      items.filter(
        (item) =>
          !(item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16)) &&
          (!Array.isArray(item.genre_ids) || !item.genre_ids.includes(10763))
      );

    const topRatedMoviesRaw = excludeAnime([
      ...(extractResults(results[2]) as any[]),
      ...(extractResults(results[3]) as any[]),
      ...(extractResults(results[4]) as any[]),
    ]);
    // Deduplicate top rated / all-time popular movies by ID
    const uniqueTopRatedMoviesMap = new Map();
    topRatedMoviesRaw.forEach((item: any) => {
      if (item?.id && !uniqueTopRatedMoviesMap.has(item.id)) {
        uniqueTopRatedMoviesMap.set(item.id, item);
      }
    });
    const allTimePopularMovies = Array.from(uniqueTopRatedMoviesMap.values());

    const topRatedTvRaw = excludeTvNonShows([
      ...(extractResults(results[7]) as any[]),
      ...(extractResults(results[8]) as any[]),
      ...(extractResults(results[9]) as any[]),
    ]);
    // Deduplicate top rated / all-time popular TV by ID
    const uniqueTopRatedTvMap = new Map();
    topRatedTvRaw.forEach((item: any) => {
      if (item?.id && !uniqueTopRatedTvMap.has(item.id)) {
        uniqueTopRatedTvMap.set(item.id, item);
      }
    });
    const allTimePopularTv = Array.from(uniqueTopRatedTvMap.values());

    const genresRes = results[15];
    const genres = (genresRes.status === "fulfilled" && genresRes.value && typeof genresRes.value === "object" && "genres" in genresRes.value)
      ? (genresRes.value as { genres?: unknown[] }).genres || []
      : [];

    return Response.json({
      trending: { results: extractResults(results[0]) },
      popularMovies: { results: excludeAnime(extractResults(results[1]) as any[]) },
      topRatedMovies: { results: allTimePopularMovies },
      nowPlaying: { results: excludeAnime(extractResults(results[5]) as any[]) },
      popularTv: { results: excludeTvNonShows(extractResults(results[6]) as any[]) },
      topRatedTv: { results: allTimePopularTv },
      onTheAir: { results: excludeTvNonShows(extractResults(results[10]) as any[]) },
      animeMovies: { results: extractResults(results[11]) },
      animeTv: { results: extractResults(results[12]) },
      trendingMoviesToday: { results: excludeAnime(extractResults(results[13]) as any[]) },
      trendingTvToday: { results: excludeTvNonShows(extractResults(results[14]) as any[]) },
      genres: { genres },
    }, { headers: cacheHeaders(7200) });
  } catch (error) {
    console.error("[TMDB Home API Error]:", error);
    return Response.json({ error: "Failed to fetch home media" }, { status: 500 });
  }
}

