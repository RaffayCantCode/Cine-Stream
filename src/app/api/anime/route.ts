export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { searchAnime, getPopularAnime, getTrendingAnime, getAiringAnime, getUpcomingAnime } from "@/lib/anime-fetch";
import { cacheHeaders } from "@/lib/tmdb";
import { getCachedAnimeSection, setCachedAnimeSection } from "@/lib/server-cache";

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

  const cacheKey = `${category}_${page}_${genre}`;
  if (category !== "search" && !searchKeyword) {
    const cached = getCachedAnimeSection(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return Response.json({
        success: true,
        data: { items: cached },
        hasMore: cached.length > 0,
      }, { headers: cacheHeaders(3600) });
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
    } else if (category === "upcoming") {
      items = await getUpcomingAnime(page, genre);
    } else {
      items = await getPopularAnime(page, genre);
    }

    // Enrich with media overrides and filter out hidden items
    try {
      const { enrichMediaListWithOverrides } = await import("@/lib/media-overrides");
      const mapped = items.map((i: any) => ({
        ...i,
        id: i.id || i.animeId,
        media_type: "anime",
        mediaType: "anime",
      }));
      items = await enrichMediaListWithOverrides(mapped);
    } catch {}

    if (items.length === 0) {
      // Don't cache empty results — they are transient failures that should
      // be retried promptly so Kitsu never gets served as a permanent answer.
      return Response.json({
        success: false,
        data: { items: [] },
      }, { 
        headers: {
          "Cache-Control": "no-store, max-age=0",
        }
      });
    }

    if (category !== "search" && !searchKeyword && items.length > 0) {
      setCachedAnimeSection(cacheKey, items, 30 * 60 * 1000);
    }

    return Response.json({
      success: true,
      data: { items },
      hasMore: items.length > 0,
    }, { headers: cacheHeaders(3600) });
  } catch (error) {
    console.error("[Anime API Route Error]:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `API Error: ${errorMessage}`, success: false },
      { status: 500 }
    );
  }
}

