export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

const animeNoStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

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
        { status: 404, headers: animeNoStoreHeaders }
      );
    }

    const episodes = data.data.episodes || [];
    const totalEps = data.data.totalEpisodes || episodes.length || 0;
    const seasons = data.data.seasons || [];

    return Response.json({
      success: true,
      data: {
        anime: {
          ...data.data,
          episodes,
          totalEpisodes: totalEps,
          seasons,
        },
      },
    }, { headers: animeNoStoreHeaders });
  } catch (error) {
    console.error("[Anime Details Error]:", error);
    return Response.json(
      { error: "Failed to fetch anime details", success: false },
      { status: 500, headers: animeNoStoreHeaders }
    );
  }
}
