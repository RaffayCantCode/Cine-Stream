export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

// Post-filter to strip Japanese animated content (anime) from movie/tv trending lists.
// When type="all" (home hero pool), we leave results intact so anime can appear in the hero.
function excludeAnime(results: any[]): any[] {
  return results.filter(
    (item) => !(item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16))
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "all";
  const timeWindow = searchParams.get("timeWindow") || "week";
  const page = searchParams.get("page") || "1";

  try {
    const data = await tmdbFetch(`/trending/${type}/${timeWindow}`, {
      page,
      include_adult: "false",
    }) as { results?: unknown[] };

    // Only strip anime from type-specific trending (movie or tv).
    // Leave "all" trending intact — it feeds the home hero which intentionally
    // mixes movies, TV, and anime into the hero banner.
    if ((type === "movie" || type === "tv") && data && Array.isArray(data.results)) {
      (data as any).results = excludeAnime(data.results as any[]);
    }

    return Response.json(data, { headers: cacheHeaders(3600) });
  } catch (error) {
    return Response.json({ error: "Failed to fetch trending" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
