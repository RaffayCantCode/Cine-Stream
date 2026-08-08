export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { cacheHeaders } from "@/lib/tmdb";
import { browseAnime } from "@/lib/anime/anilist";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
};

const SUPPORTED_CATEGORIES = new Set(["popular", "trending", "top", "top100", "airing", "upcoming", "movie", "search"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let category = searchParams.get("category") || "popular";
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const genre = searchParams.get("genre") || "";
  let q = searchParams.get("q") || "";

  if (category.startsWith("search&")) {
    const match = category.match(/^search&q=([\s\S]*)$/);
    if (match) {
      category = "search";
      try {
        q = decodeURIComponent(match[1]);
      } catch {
        q = match[1];
      }
    }
  }

  if (!SUPPORTED_CATEGORIES.has(category)) {
    category = "popular";
  }

  try {
    const result = await browseAnime(category, page, genre, q);
    const headers = result.items.length > 0 ? cacheHeaders(3600) : noStoreHeaders;
    return Response.json(
      { success: true, data: { items: result.items }, hasMore: result.hasMore },
      { headers }
    );
  } catch (error) {
    console.error("[Anime Browse Error]:", error);
    return Response.json(
      { success: false, data: { items: [] }, hasMore: false },
      { headers: noStoreHeaders }
    );
  }
}