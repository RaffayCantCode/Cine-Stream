export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { searchAnime, getPopularAnime, getTrendingAnime, getAiringAnime } from "@/lib/anime-fetch";
import { cacheHeaders } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const categoryRaw = searchParams.get("category") || "popular";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const q = searchParams.get("q") || "";
  const genre = searchParams.get("genre") || "";

  let category = categoryRaw;
  let searchKeyword = q;
  if (categoryRaw.startsWith("search&q=")) {
    category = "search";
    try {
      searchKeyword = decodeURIComponent(categoryRaw.substring("search&q=".length));
    } catch {
      searchKeyword = categoryRaw.substring("search&q=".length);
    }
  }

  try {
    let items: any[] = [];

    if (category === "search") {
      items = await searchAnime(searchKeyword, page, genre);
    } else if (category === "airing") {
      items = await getAiringAnime(page, genre);
    } else if (category === "trending") {
      items = await getTrendingAnime(page, genre);
    } else {
      items = await getPopularAnime(page, genre);
    }

    return Response.json({
      success: true,
      data: { items },
      hasMore: items.length > 0,
    }, { headers: cacheHeaders(3600) });
  } catch (error) {
    console.error("[Anime API Route Error]:", error);
    return Response.json(
      { error: "Failed to fetch anime", success: false },
      { status: 500 }
    );
  }
}
