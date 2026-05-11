import { NextRequest } from "next/server";
import * as AniPub from "@/lib/anime-fetch-new";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get anime details - this should work
    let data;
    try {
      data = await AniPub.getAnimeDetails(id);
    } catch (e) {
      console.warn("[AniPub] Could not get anime details:", e);
      return Response.json(
        { error: "Anime not found", success: false },
        { status: 404 }
      );
    }
    
    if (!data.success || !data.data) {
      return Response.json(
        { error: "Anime not found", success: false },
        { status: 404 }
      );
    }
    
    // Get streaming links - but don't fail if it doesn't work
    let links = { success: true, data: { episodes: [], totalEpisodes: 0 } };
    try {
      links = await AniPub.getStreamingLinks(id);
    } catch (e) {
      console.warn("[AniPub] Could not get streaming links:", e);
    }
    
    const episodes = links.data?.episodes || [];
    const totalEps = links.data?.totalEpisodes || data.data?.episodes?.sub || 0;
    
    // If no episodes from API, generate placeholder episodes based on epCount
    const generatedEpisodes: { episodeId: string; episodeNum: number; title: string }[] = [];
    if (episodes.length === 0 && totalEps > 0) {
      for (let i = 1; i <= Math.min(totalEps, 100); i++) {
        generatedEpisodes.push({ episodeId: `${id}-${i}`, episodeNum: i, title: `Episode ${i}` });
      }
    }
    const finalEpisodes = episodes.length > 0 ? episodes : generatedEpisodes;
    
    return Response.json({
      success: true,
      data: {
        anime: {
          ...data.data,
          episodes: finalEpisodes,
          totalEpisodes: finalEpisodes.length || totalEps,
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