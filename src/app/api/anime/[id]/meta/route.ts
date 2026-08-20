export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { getAnimeDetails } from "@/lib/anime-fetch";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";

const animeMetaCacheHeaders = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
  "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
  "Cloudflare-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const override = await getMediaOverride("anime", id).catch(() => null);
    if (override?.isHidden || override?.status === "hidden") {
      return Response.json(
        { error: "Anime is unavailable", success: false },
        { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const data = await getAnimeDetails(id, 1500, true);
    if (!data || !data.anime || !data.seasons || data.seasons.length === 0) {
      if (override) {
        const synthetic = applyMediaOverride(null, override);
        return Response.json({
          success: true,
          data: {
            anime: synthetic,
            franchiseNodes: [],
            tmdbSeasonMap: {},
          },
        }, { headers: { "Cache-Control": "no-store, max-age=0" } });
      }

      return Response.json(
        { error: "Anime details unavailable", success: false },
        { 
          status: 404, 
          headers: {
            "Cache-Control": "no-store, max-age=0",
          }
        }
      );
    }

    const { anime, totalEpisodes, seasons, openedSeasonId, franchiseNodes, tmdbId, tmdbSeasonMap } = data;
    const finalAnime = applyMediaOverride({
      ...anime,
      totalEpisodes,
      seasons,
      openedSeasonId,
      tmdbId,
    }, override);

    return Response.json({
      success: true,
      data: {
        anime: finalAnime,
        franchiseNodes,
        tmdbSeasonMap,
      },
    }, { headers: override ? { "Cache-Control": "no-store, max-age=0" } : animeMetaCacheHeaders });
  } catch (error) {
    console.error("[Anime Meta Error]:", error);
    return Response.json(
      { error: "Failed to fetch anime details", success: false },
      { status: 500, headers: animeMetaCacheHeaders }
    );
  }
}
