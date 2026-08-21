export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { getAnimeDetails } from "@/lib/anime-fetch";
import { getMediaOverride, applyMediaOverride, getAllMediaOverrides } from "@/lib/media-overrides";

const noStoreHeaders = {
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
    const [override, data, allOverrides] = await Promise.all([
      getMediaOverride("anime", id).catch(() => null),
      getAnimeDetails(id, 1500, true),
      getAllMediaOverrides().catch(() => []),
    ]);

    if (override?.isHidden || override?.status === "hidden") {
      return Response.json(
        { error: "Anime is unavailable", success: false },
        { status: 404, headers: noStoreHeaders }
      );
    }

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
        }, { headers: noStoreHeaders });
      }

      return Response.json(
        { error: "Anime details unavailable", success: false },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const { anime, totalEpisodes, seasons, openedSeasonId, franchiseNodes, tmdbId, tmdbSeasonMap } = data;

    // Apply season-level overrides if individual seasons are overridden
    const overrideMap = new Map<string, any>();
    for (const o of allOverrides) {
      if (o.id) overrideMap.set(o.id.toLowerCase().trim(), o);
      if (o.mediaType && o.mediaId) {
        overrideMap.set(`${o.mediaType.toLowerCase()}-${String(o.mediaId).toLowerCase()}`, o);
        overrideMap.set(String(o.mediaId).toLowerCase(), o);
      }
    }

    const enrichedSeasons = seasons.map((s) => {
      const sId = String(s.id).toLowerCase();
      const sOv = overrideMap.get(`anime-${sId}`) || overrideMap.get(sId);
      if (sOv) {
        return {
          ...s,
          name: sOv.customTitle || s.name,
          seasonLabel: sOv.customTitle ? sOv.customTitle : s.seasonLabel,
          status: sOv.status || (sOv.isUpcoming ? "upcoming" : s.status),
          isUpcoming: Boolean(sOv.isUpcoming || sOv.status === "upcoming"),
          isUnavailable: Boolean(sOv.isUnavailable || sOv.status === "unavailable"),
          customTags: sOv.customTags || [],
        };
      }
      return s;
    });

    const finalAnime = applyMediaOverride({
      ...anime,
      totalEpisodes,
      seasons: enrichedSeasons,
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
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[Anime Meta Error]:", error);
    const fallbackOverride = await getMediaOverride("anime", id).catch(() => null);
    if (fallbackOverride) {
      const synthetic = applyMediaOverride(null, fallbackOverride);
      return Response.json({
        success: true,
        data: {
          anime: synthetic,
          franchiseNodes: [],
          tmdbSeasonMap: {},
        },
      }, { headers: noStoreHeaders });
    }

    return Response.json(
      { error: "Failed to fetch anime details", success: false },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
