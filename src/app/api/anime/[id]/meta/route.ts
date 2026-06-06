import { NextRequest } from "next/server";
import { getAnimeDetails } from "@/lib/anime-fetch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await getAnimeDetails(id, 100, true);
    if (!data) {
      return Response.json(
        { error: "Anime not found", success: false },
        { status: 404 }
      );
    }

    const { anime, totalEpisodes, seasons } = data;
    return Response.json({
      success: true,
      data: {
        anime: {
          ...anime,
          totalEpisodes,
          seasons,
        },
      },
    });
  } catch (error) {
    console.error("[Anime Meta Error]:", error);
    return Response.json(
      { error: "Failed to fetch anime details", success: false },
      { status: 500 }
    );
  }
}