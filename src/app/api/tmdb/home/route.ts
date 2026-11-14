export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 900;

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomPages(maxPage: number, count: number, alwaysIncludeFirst = true): string[] {
  const pages = new Set<number>();
  if (alwaysIncludeFirst && count > 0) pages.add(1);
  const target = Math.min(count, maxPage);
  const candidates: number[] = [];
  for (let p = alwaysIncludeFirst ? 2 : 1; p <= maxPage; p++) {
    candidates.push(p);
  }
  for (const p of shuffleArray(candidates)) {
    if (pages.size >= target) break;
    pages.add(p);
  }
  return Array.from(pages).map(String);
}

function dedupeById<T extends { id?: number | string }>(items: T[]): T[] {
  const seen = new Map<number | string, T>();
  for (const item of items) {
    if (item?.id && !seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

export async function GET(_request: NextRequest) {
  try {
    const movieDiscoverPages = pickRandomPages(12, 6);
    const tvDiscoverPages = pickRandomPages(10, 6);

    const [coreResults, movieDiscoverResults, tvDiscoverResults] = await Promise.all([
      Promise.allSettled([
        tmdbFetch("/trending/all/week", { page: "1", include_adult: "false" }),
        tmdbFetch("/movie/popular", { page: "1", include_adult: "false" }),
        tmdbFetch("/movie/popular", { page: "2", include_adult: "false" }),
        tmdbFetch("/movie/now_playing", { page: "1", include_adult: "false" }),
        tmdbFetch("/tv/popular", { page: "1", include_adult: "false" }),
        tmdbFetch("/tv/popular", { page: "2", include_adult: "false" }),
        tmdbFetch("/tv/on_the_air", { page: "1", include_adult: "false" }),
        tmdbFetch("/discover/movie", { page: "1", with_original_language: "ja", with_genres: "16", include_adult: "false" }),
        tmdbFetch("/discover/tv", { page: "1", with_original_language: "ja", with_genres: "16", include_adult: "false" }),
        tmdbFetch("/trending/movie/day", { page: "1", include_adult: "false" }),
        tmdbFetch("/trending/tv/day", { page: "1", include_adult: "false" }),
        tmdbFetch("/genre/movie/list"),
      ]),
      Promise.allSettled(
        movieDiscoverPages.map((page) =>
          tmdbFetch("/discover/movie", {
            sort_by: "vote_count.desc",
            "vote_count.gte": "1500",
            "vote_average.gte": "7.0",
            include_adult: "false",
            page,
          })
        )
      ),
      Promise.allSettled(
        tvDiscoverPages.map((page) =>
          tmdbFetch("/discover/tv", {
            sort_by: "vote_count.desc",
            "vote_count.gte": "800",
            "vote_average.gte": "7.4",
            include_adult: "false",
            page,
          })
        )
      ),
    ]);

    const extractResults = (res: PromiseSettledResult<unknown>): any[] => {
      if (res.status === "fulfilled" && res.value && typeof res.value === "object" && "results" in res.value) {
        return ((res.value as { results?: unknown[] }).results || []) as any[];
      }
      return [];
    };

    // Strip Japanese animated content (anime) from movie/TV result arrays.
    // The dedicated animeMovies/animeTv keys (coreResults[7], coreResults[8]) are
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

    const popularMovies = dedupeById(
      excludeAnime([
        ...extractResults(coreResults[1]),
        ...extractResults(coreResults[2]),
      ])
    );

    const popularTv = dedupeById(
      excludeTvNonShows([
        ...extractResults(coreResults[4]),
        ...extractResults(coreResults[5]),
      ])
    );

    const allTimePopularMovies = shuffleArray(
      dedupeById(excludeAnime(movieDiscoverResults.flatMap(extractResults)))
    );

    const allTimePopularTv = shuffleArray(
      dedupeById(excludeTvNonShows(tvDiscoverResults.flatMap(extractResults)))
    );

    const genresRes = coreResults[11];
    const genres = (genresRes.status === "fulfilled" && genresRes.value && typeof genresRes.value === "object" && "genres" in genresRes.value)
      ? (genresRes.value as { genres?: unknown[] }).genres || []
      : [];

    return Response.json({
      trending: { results: extractResults(coreResults[0]) },
      popularMovies: { results: popularMovies },
      topRatedMovies: { results: allTimePopularMovies },
      nowPlaying: { results: excludeAnime(extractResults(coreResults[3])) },
      popularTv: { results: popularTv },
      topRatedTv: { results: allTimePopularTv },
      onTheAir: { results: excludeTvNonShows(extractResults(coreResults[6])) },
      animeMovies: { results: extractResults(coreResults[7]) },
      animeTv: { results: extractResults(coreResults[8]) },
      trendingMoviesToday: { results: excludeAnime(extractResults(coreResults[9])) },
      trendingTvToday: { results: excludeTvNonShows(extractResults(coreResults[10])) },
      genres: { genres },
    }, { headers: cacheHeaders(900) });
  } catch (error) {
    console.error("[TMDB Home API Error]:", error);
    return Response.json({ error: "Failed to fetch home media" }, { status: 500 });
  }
}

