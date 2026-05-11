import { NextRequest } from "next/server";
import * as AniPub from "@/lib/anime-fetch-new";

const STREAMING_SOURCES = [
  { name: "CineSrc", baseUrl: "https://cinesrc.st", type: "anime" },
  { name: "VidSrc ME", baseUrl: "https://vidsrc.mov", type: "anime" },
  { name: "VidSrc ME", baseUrl: "https://vidsrc.me", type: "anime" },
  { name: "SuperStream", baseUrl: "https://superstream.se", type: "anime" },
  { name: "VidKing", baseUrl: "https://vidking.net", type: "anime" },
];

function buildEmbedUrl(source: typeof STREAMING_SOURCES[0], animeId: string, animeTitle: string, episode: number): string {
  const cleanTitle = animeTitle.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").trim();
  
  switch (source.name) {
    case "CineSrc":
      return `${source.baseUrl}/embed/anime/${animeId}?ep=${episode}`;
    case "VidSrc ME":
      if (source.baseUrl === "https://vidsrc.mov") {
        return `${source.baseUrl}/embed/anime/${animeId}/${episode}`;
      }
      return `${source.baseUrl}/embed/${cleanTitle}-episode-${episode}`;
    case "SuperStream":
      return `${source.baseUrl}/embed/${animeId}?ep=${episode}`;
    case "VidKing":
      return `${source.baseUrl}/embed/anime/${animeId}/${episode}`;
    default:
      return `${source.baseUrl}/embed/${cleanTitle}-episode-${episode}`;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const details = await AniPub.getAnimeDetails(id);
    const animeTitle = details.data?.name || "Unknown";
    const totalEps = details.data?.episodes?.sub || 1;
    
    const maxEps = Math.min(totalEps, 100);
    const episodes = [];
    
    for (let i = 1; i <= maxEps; i++) {
      const sources = STREAMING_SOURCES.map(source => ({
        name: source.name,
        url: buildEmbedUrl(source, id, animeTitle, i),
      }));
      
      episodes.push({
        episodeId: `${id}-${i}`,
        episodeNum: i,
        title: `Episode ${i}`,
        sources: sources,
      });
    }
    
    return Response.json({
      success: true,
      data: {
        episodes,
        totalEpisodes: maxEps,
      },
    });
    
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch episodes", success: false },
      { status: 500 }
    );
  }
}