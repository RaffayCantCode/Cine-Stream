import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") || "popular";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const q = searchParams.get("q") || "";
  const genre = searchParams.get("genre") || "";

  try {
    let data: any;

    if (category === "search") {
      const endpoint = `/search?keyword=${encodeURIComponent(q)}&page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`;
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
      hasMore: items.length >= 50,
    });
  } catch (error) {
    console.error("[Anime API Route Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch anime", success: false },
      { status: 500 }
    );
  }
}
