import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

async function fetchPage(endpoint: string, page: number) {
  const data = await tmdbFetch(endpoint, { page: String(page) }) as { results?: unknown[] };
  return data?.results ?? [];
}

export async function GET(_request: NextRequest) {
  // Random page on every request so the hero changes each time you visit
  const pageN = Math.floor(Math.random() * 10) + 1;

  const results = await Promise.allSettled([
    fetchPage("/trending/all/week", pageN),
    fetchPage("/movie/popular", pageN),
    fetchPage("/tv/top_rated", pageN),
    fetchPage("/movie/now_playing", pageN),
  ]);

  const [trending, popular, topRated, nowPlaying] = results.map(r =>
    r.status === "fulfilled" ? r.value : []
  );

  return Response.json({
    trending: { results: trending },
    popular: { results: popular },
    topRated: { results: topRated },
    nowPlaying: { results: nowPlaying },
  });
}
