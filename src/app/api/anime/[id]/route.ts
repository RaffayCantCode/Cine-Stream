import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await fetchAnimeApi(`/series/${id}`, true);

    if (!data || !data.success || !data.data) {
      return Response.json(
        { error: "Anime not found", success: false },
        { status: 404 }
      );
    }

    const episodes = data.data.episodes || [];
    const totalEps = data.data.totalEpisodes || episodes.length || 0;

    return Response.json({
      success: true,
      data: {
        anime: {
          ...data.data,
          episodes,
          totalEpisodes: totalEps,
        },
      },
    });
  } catch (error) {
    console.error("[Anime Details Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch anime details", success: false },
      { status: 500 }
    );
  }
}
