import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

async function fetchPage(endpoint: string, page: number) {
  const data = await tmdbFetch(endpoint, { page: String(page) }) as { results?: unknown[] };
  return data?.results ?? [];
}

export async function GET(_request: NextRequest) {
  // Random page on every request so the hero changes each time you visit
  const pageN = Math.floor(Math.random() * 10) + 1;

  try {
    const [trending, popular, topRated, nowPlaying] = await Promise.all([
      fetchPage("/trending/all/week", pageN),
      fetchPage("/movie/popular", pageN),
      fetchPage("/tv/top_rated", pageN),
      fetchPage("/movie/now_playing", pageN),
    ]);

    return Response.json({
      trending: { results: trending },
      popular: { results: popular },
      topRated: { results: topRated },
      nowPlaying: { results: nowPlaying },
    });
  } catch (error) {
    console.error("[TMDB Home Hero API Error]:", error);
    return Response.json({ error: "Failed to fetch hero media" }, { status: 500 });
  }
}
