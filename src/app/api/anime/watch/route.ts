import { NextRequest } from "next/server";
import { fetchAnimeApi, getStreamingSource } from "@/lib/anime-fetch";
import * as Jikan from "@/lib/jikan-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const episodeId = searchParams.get("episodeId");
  const animeId = searchParams.get("animeId") || "";
  const episodeNum = searchParams.get("episode") || "1";
  const server = searchParams.get("server") || "default";

  if (!episodeId && !animeId) {
    return Response.json(
      { error: "Missing episodeId or animeId", success: false },
      { status: 400 }
    );
  }

  try {
    // Try direct streaming from the new APIs first
    if (episodeId) {
      try {
        const streamResult = await getStreamingSource(animeId, episodeId, server);
        if (streamResult.success && streamResult.data?.sources?.length > 0) {
          return Response.json({
            success: true,
            data: {
              sources: streamResult.data.sources,
              subtitles: streamResult.data.subtitles || [],
              intro: { start: 0, end: 0 },
              outro: { start: 0, end: 0 },
            },
            source: streamResult.source,
          });
        }
      } catch {
        // Fallback to the metadata approach below
      }
    }

    // Fallback: try fetching anime metadata and then streaming
    let resolvedId = animeId;

    const malId = parseInt(animeId, 10);
    if (!isNaN(malId)) {
      try {
        const jikanData = await Jikan.getAnimeDetails(malId);
        if (jikanData.success && jikanData.data) {
          const searchResult = await fetchAnimeApi(
            `/api/search?keyword=${encodeURIComponent(jikanData.data.name)}`
          );
          const animes = searchResult.data || [];
          const match = animes.find(
            (a: any) =>
              a.name.toLowerCase().includes(jikanData.data.name.toLowerCase()) ||
              jikanData.data.name.toLowerCase().includes(a.name.toLowerCase())
          );
          if (match) resolvedId = match.id;
        }
      } catch {
        // Ignore Jikan errors
      }
    }

    const data = await fetchAnimeApi(`/series/${resolvedId}`, true);

    if (data.success && data.data?.episodes) {
      const ep = data.data.episodes.find(
        (e: any) =>
          String(e.episodeNum) === String(episodeNum) || e.episodeId === episodeId
      );

      if (ep) {
        try {
          const streamResult = await getStreamingSource(
            resolvedId,
            ep.episodeId || `${resolvedId}-${ep.episodeNum}`,
            server
          );
          if (streamResult.success) {
            return Response.json({
              success: true,
              data: {
                sources: streamResult.data.sources,
                subtitles: streamResult.data.subtitles || [],
              },
              source: streamResult.source,
            });
          }
        } catch {
          // Fall through to error
        }
      }
    }

    return Response.json({
      success: false,
      error: "No streaming sources available for this episode",
    });
  } catch (error) {
    console.error("[Anime Watch Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch streaming", success: false },
      { status: 500 }
    );
  }
}
