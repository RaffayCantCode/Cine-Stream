import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

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
    let data: any;

    if (category === "search") {
      const endpoint = `/search?keyword=${encodeURIComponent(searchKeyword)}&page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`;
      data = await fetchAnimeApi(endpoint);
    } else if (category === "airing") {
      data = await fetchAnimeApi(`/airing?page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`);
    } else if (category === "trending") {
      data = await fetchAnimeApi(`/trending?page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`);
    } else {
      data = await fetchAnimeApi(`/popular?page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`);
    }

    const items = data.data || [];
    return Response.json({
      success: true,
      data: { items },
      hasMore: items.length > 0,
    }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } });
  } catch (error) {
    console.error("[Anime API Route Error]:", error);
    return Response.json(
      { error: "Failed to fetch anime", success: false },
      { status: 500 }
    );
  }
}
