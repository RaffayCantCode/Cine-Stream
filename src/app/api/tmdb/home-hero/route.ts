export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export const revalidate = 3600;

async function fetchPages(endpoint: string, pages: number[]) {
  const promises = pages.map(page => 
    tmdbFetch(endpoint, { page: String(page), include_adult: "false" })
      .then(res => (res as { results?: unknown[] })?.results ?? [])
  );
  const results = await Promise.all(promises);
  return results.flat();
}

export async function GET(_request: NextRequest) {
  // Fetch multiple pages deterministically to build a very large pool.
  // Next.js caches these perfectly. Client-side shuffle handles randomization.
  const pagesToFetch = [1, 2, 3];
  
  const results = await Promise.allSettled([
    fetchPages("/trending/all/week", pagesToFetch),
    fetchPages("/movie/popular", pagesToFetch),
    fetchPages("/movie/top_rated", pagesToFetch),
    fetchPages("/movie/now_playing", pagesToFetch),
    fetchPages("/tv/popular", pagesToFetch),
    fetchPages("/tv/top_rated", pagesToFetch),
    fetchPages("/tv/on_the_air", pagesToFetch),
    fetchPages("/discover/movie?with_original_language=ja", pagesToFetch),
    fetchPages("/discover/tv?with_original_language=ja&with_genres=16", pagesToFetch),
    fetchPages("/trending/movie/day", pagesToFetch),
    fetchPages("/trending/tv/day", pagesToFetch),
  ]);

  const [trending, popularMovies, topRatedMovies, nowPlaying, popularTv, topRatedTv, onTheAir, animeMovies, animeTv, trendingMoviesToday, trendingTvToday] = results.map(r =>
    r.status === "fulfilled" ? r.value : []
  );



  return Response.json({
    trending: { results: trending },
    popularMovies: { results: popularMovies },
    topRatedMovies: { results: topRatedMovies },
    nowPlaying: { results: nowPlaying },
    popularTv: { results: popularTv },
    topRatedTv: { results: topRatedTv },
    onTheAir: { results: onTheAir },
    animeMovies: { results: animeMovies },
    animeTv: { results: animeTv },
    trendingMoviesToday: { results: trendingMoviesToday },
    trendingTvToday: { results: trendingTvToday },
  });
}
