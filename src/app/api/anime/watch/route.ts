import { NextRequest } from "next/server";
import { getStreamingSource } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const episodeId = searchParams.get("episodeId");
  const animeId = searchParams.get("animeId") || "";
  const server = searchParams.get("server") || "default";

  if (!episodeId) {
    return Response.json(
      { error: "Missing episodeId parameter", success: false },
      { status: 400 }
    );
  }

  try {
    const data = await getStreamingSource(animeId, episodeId, server);
    return Response.json(data);
  } catch (error) {
    console.error("[Anime Watch Error]:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to fetch streaming source";
    return Response.json({ error: message, success: false }, { status: 500 });
  }
}
