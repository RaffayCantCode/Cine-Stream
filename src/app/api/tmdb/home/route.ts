import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

// Fetch multiple pages and merge results for a much larger pool to randomize from
async function fetchMultiplePages(endpoint: string, pages: number[]) {
  const results = await Promise.allSettled(
    pages.map((page) => tmdbFetch(endpoint, { page: String(page) }))
  );

  const allItems: unknown[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      const data = r.value as { results?: unknown[] };
      if (data?.results) allItems.push(...data.results);
    }
  }
  return { results: allItems };
}

export async function GET(_request: NextRequest) {
  try {
    const [trending, popular, topRated, nowPlaying, genres] = await Promise.all([
      // Trending — 2 pages (~40 items)
      fetchMultiplePages("/trending/all/week", [1, 2]),
      // Popular movies — 2 pages (~40 items)
      fetchMultiplePages("/movie/popular", [1, 2]),
      // Top-rated TV — 2 pages (~40 items)
      fetchMultiplePages("/tv/top_rated", [1, 2]),
      // Now playing movies — 2 pages (~40 items)
      fetchMultiplePages("/movie/now_playing", [1, 2]),
      // Genres list (single page, no pagination)
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
