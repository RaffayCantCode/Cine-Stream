import { NextRequest } from "next/server";
import { getAnimeDetails } from "@/lib/anime-fetch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await getAnimeDetails(id, 1500, true);
    if (!data) {
      return Response.json(
        { error: "Anime not found", success: false },
        { status: 404 }
      );
    }

    const { anime, totalEpisodes, seasons, openedSeasonId, franchiseNodes, tmdbId, tmdbSeasonMap } = data;

    return Response.json({
      success: true,
      data: {
        anime: {
          ...anime,
          totalEpisodes,
          seasons,
          openedSeasonId,
          tmdbId,
        },
        franchiseNodes,
        tmdbSeasonMap,
      },
    }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } });
  } catch (error) {
    console.error("[Anime Meta Error]:", error);
    return Response.json(
      { error: "Failed to fetch anime details", success: false },
      { status: 500 }
    );
  }
}