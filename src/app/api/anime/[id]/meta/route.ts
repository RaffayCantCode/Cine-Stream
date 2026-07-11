export const dynamic = 'force-dynamic';
export const runtime = 'edge';
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

    const isDev = process.env.NODE_ENV === "development";
    // Check if the result is degraded (any season missing tmdbSeasonNumber)
    const isDegraded = seasons.some((s: any) => s.tmdbSeasonNumber == null && s.seasonLabel?.startsWith("Season"));
    // Use short CDN cache for degraded results so they are quickly replaced.
    // Healthy results use a longer 30-min CDN cache (server in-memory cache is still 30min).
    const cdnMaxAge = isDegraded ? 30 : 1800;
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
    }, { 
      headers: { 
        "Cache-Control": isDev 
          ? "no-cache, no-store, must-revalidate" 
          : `public, s-maxage=${cdnMaxAge}, stale-while-revalidate=${cdnMaxAge * 2}` 
      } 
    });
  } catch (error) {
    console.error("[Anime Meta Error]:", error);
    return Response.json(
      { error: "Failed to fetch anime details", success: false },
      { status: 500 }
    );
  }
}