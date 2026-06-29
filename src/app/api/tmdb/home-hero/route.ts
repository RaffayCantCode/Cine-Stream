import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

async function fetchPage(endpoint: string, page: number) {
  const data = await tmdbFetch(endpoint, { page: String(page), include_adult: "true" }) as { results?: unknown[] };
  return data?.results ?? [];
}

export async function GET(_request: NextRequest) {
  // We now fetch pages 1 and 2 deterministically. Next.js caches these perfectly.
  // The client-side shuffle will handle randomization.
  const results = await Promise.allSettled([
    fetchPage("/trending/all/week", 1),
    fetchPage("/movie/popular", 1),
    fetchPage("/movie/top_rated", 1),
    fetchPage("/movie/now_playing", 1),
    fetchPage("/tv/popular", 1),
    fetchPage("/tv/top_rated", 1),
    fetchPage("/tv/on_the_air", 1),
    fetchPage("/discover/movie?with_original_language=ja", 1),
    fetchPage("/discover/tv?with_original_language=ja&with_genres=16", 1),
  ]);

  const [trending, popularMovies, topRatedMovies, nowPlaying, popularTv, topRatedTv, onTheAir, animeMovies, animeTv] = results.map(r =>
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
  });
}
