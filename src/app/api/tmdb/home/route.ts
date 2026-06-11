import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  try {
    const [trending, popular, topRated, nowPlaying, genres] = await Promise.all([
      tmdbFetch("/trending/all/week", { page: "1" }),
      tmdbFetch("/movie/popular", { page: "1" }),
      tmdbFetch("/tv/top_rated", { page: "1" }),
      tmdbFetch("/movie/now_playing", { page: "1" }),
      tmdbFetch("/genre/movie/list"),
    ]);

    return Response.json({
      trending,
      popular,
      topRated,
      nowPlaying,
      genres,
    });
  } catch (error) {
    console.error("[TMDB Home API Error]:", error);
    return Response.json({ error: "Failed to fetch home media" }, { status: 500 });
  }
}
