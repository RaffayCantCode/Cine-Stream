export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

// TMDB list endpoints don't support without_keywords/without_original_language.
// We post-filter server-side to strip Japanese animated content (anime).
function excludeAnime(results: any[]): any[] {
  return results.filter(
    (item) => !(item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16))
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get("page") || "1";

  try {
    const data = await tmdbFetch("/movie/now_playing", { page, include_adult: "false" }) as any;
    if (data?.results) data.results = excludeAnime(data.results);
    return Response.json(data, { headers: cacheHeaders(3600) });
  } catch (error) {
    return Response.json({ error: "Failed to fetch now-playing movies" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
