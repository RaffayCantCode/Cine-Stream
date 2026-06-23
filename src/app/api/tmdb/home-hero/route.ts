import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

async function fetchPage(endpoint: string, page: number) {
  const data = await tmdbFetch(endpoint, { page: String(page) }, { noCache: true }) as { results?: unknown[] };
  return data?.results ?? [];
}

function randomPage(): number {
  const roll = Math.random();
  if (roll < 0.15) return Math.floor(Math.random() * 3) + 1;        // 15%: top 3 (blockbusters)
  if (roll < 0.50) return Math.floor(Math.random() * 20) + 1;       // 35%: pages 1-20
  if (roll < 0.80) return Math.floor(Math.random() * 30) + 20;      // 30%: pages 20-50 (underrated)
  return Math.floor(Math.random() * 50) + 50;                        // 20%: pages 50-100 (niche)
}

export async function GET(_request: NextRequest) {
  const results = await Promise.allSettled([
    fetchPage("/trending/all/week", randomPage()),
    fetchPage("/movie/popular", randomPage()),
    fetchPage("/movie/top_rated", randomPage()),
    fetchPage("/movie/now_playing", randomPage()),
    fetchPage("/tv/popular", randomPage()),
    fetchPage("/tv/top_rated", randomPage()),
    fetchPage("/tv/on_the_air", randomPage()),
    fetchPage("/discover/movie?with_original_language=ja", randomPage()),
    fetchPage("/discover/tv?with_original_language=ja&with_genres=16", randomPage()),
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
