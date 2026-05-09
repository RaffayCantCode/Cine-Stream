import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Missing query parameter", success: false }, { status: 400 });
  }

  try {
    const data = await fetchAnimeApi(`/api/search?keyword=${encodeURIComponent(query)}`, {
      next: { revalidate: 300 },
    });

    // Response is already transformed by fetchAnimeApi
    return Response.json(data);
  } catch (error) {
    console.error("[Anime Search Error]:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to search anime";
    return Response.json({ error: message, success: false }, { status: 500 });
  }
}
