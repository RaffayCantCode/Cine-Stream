export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 3600;

// Fetch multiple pages and merge results for a much larger pool to randomize from
async function fetchMultiplePages(endpoint: string, pages: number[]) {
  const results = await Promise.allSettled(
    pages.map((page) => tmdbFetch(endpoint, { page: String(page), include_adult: "false" }))
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
  // Deterministic fetching allows perfect edge caching.
  // We fetch pages 1 and 2 to get a pool of 40 items per category, 
  // and the client shuffles them visually.
  const pages = [1, 2];

  try {
    const [trending, popular, topRated, nowPlaying, genres] = await Promise.all([
      fetchMultiplePages("/trending/all/week", pages),
      fetchMultiplePages("/discover/movie?sort_by=vote_average.desc&vote_count.gte=5000", pages),
      fetchMultiplePages("/tv/top_rated", pages),
      fetchMultiplePages("/movie/now_playing", pages),
      tmdbFetch("/genre/movie/list"),
    ]);

    return Response.json({
      trending,
      popular,
      topRated,
      nowPlaying,
      genres,
    }, { headers: cacheHeaders(3600) });
  } catch (error) {
    console.error("[TMDB Home API Error]:", error);
    return Response.json({ error: "Failed to fetch home media" }, { status: 500 });
  }
}
