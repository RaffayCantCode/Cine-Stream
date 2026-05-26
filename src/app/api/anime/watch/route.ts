import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const episodeId = searchParams.get("episodeId");
  const animeId = searchParams.get("animeId") || "";
  const episodeNum = searchParams.get("episode") || "1";

  if (!episodeId && !animeId) {
    return Response.json(
      { error: "Missing episodeId or animeId", success: false },
      { status: 400 }
    );
  }

  try {
    let resolvedId = animeId;

    const data = await fetchAnimeApi(`/series/${resolvedId}`, true);

    if (data.success && data.data?.episodes) {
      const ep = data.data.episodes.find(
        (e: any) =>
          String(e.episodeNum) === String(episodeNum) || e.episodeId === episodeId
      );

      if (ep) {
        return Response.json({
          success: true,
          data: {
            sources: [{ url: `https://vidnest.fun/animepahe/${resolvedId.replace(/\D/g, "")}/${ep.episodeNum}/sub`, quality: "1080p" }],
            subtitles: [],
          },
          source: "AnimePahe",
        });
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
