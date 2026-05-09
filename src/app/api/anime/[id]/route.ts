import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await fetchAnimeApi(`/api/anime/${encodeURIComponent(id)}`, { next: { revalidate: 300 } });

    // Response is already transformed by fetchAnimeApi
    return Response.json(data);
  } catch (error) {
    console.error("[Anime Details Error]:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to fetch anime details";
    return Response.json({ error: message, success: false }, { status: 500 });
  }
}
