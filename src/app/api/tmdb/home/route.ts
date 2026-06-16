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
    const [trending, popular, topRated, nowPlaying, upcoming, genres] = await Promise.all([
      // Trending — fetch 2 pages (week) for ~40 items
      fetchMultiplePages("/trending/all/week", [1, 2]),
      // Popular movies — 3 pages (~60 items)
      fetchMultiplePages("/movie/popular", [1, 2, 3]),
      // Top-rated TV — 3 pages (~60 items)
      fetchMultiplePages("/tv/top_rated", [1, 2, 3]),
      // Now playing movies — 2 pages (~40 items)
      fetchMultiplePages("/movie/now_playing", [1, 2]),
      // Upcoming movies — 2 pages for the "recently added" feel
      fetchMultiplePages("/movie/upcoming", [1, 2]),
      // Genres list (single page, no pagination)
      tmdbFetch("/genre/movie/list"),
    ]);

    return Response.json({
      trending,
      popular,
      topRated,
      nowPlaying,
      upcoming,
      genres,
    });
  } catch (error) {
    console.error("[TMDB Home API Error]:", error);
    return Response.json({ error: "Failed to fetch home media" }, { status: 500 });
  }
}
