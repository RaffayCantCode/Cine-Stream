export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");

  if (!query) {
    return Response.json(
      { error: "Missing query parameter", success: false },
      { status: 400 }
    );
  }

  try {
    const data = await fetchAnimeApi(
      `/api/search?keyword=${encodeURIComponent(query)}`
    );

    const animes = data.data || [];
    return Response.json({
      success: true,
      data: { animes },
    });
  } catch (error) {
    console.error("[Anime Search Error]:", error);
    return Response.json({ error: "Failed to search anime", success: false }, { status: 500 });
  }
}
