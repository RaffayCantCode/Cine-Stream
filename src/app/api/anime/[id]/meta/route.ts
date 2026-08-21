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
        const cleanType = o.mediaType.toLowerCase().trim();
        const cleanId = String(o.mediaId).toLowerCase().trim();
        overrideMap.set(`${cleanType}-${cleanId}`, o);
        overrideMap.set(cleanId, o);
        if (cleanId.startsWith("kitsu-")) overrideMap.set(cleanId.replace("kitsu-", ""), o);
        if (cleanId.startsWith("mal-")) overrideMap.set(cleanId.replace("mal-", ""), o);
      }
    }

    // If main override wasn't found by route ID, check anime.id or openedSeasonId
    let effectiveOverride = override;
    if (!effectiveOverride && anime) {
      const aId = String(anime.id || "").toLowerCase();
      effectiveOverride = overrideMap.get(`anime-${aId}`) || overrideMap.get(aId) || (openedSeasonId ? (overrideMap.get(`anime-${String(openedSeasonId).toLowerCase()}`) || overrideMap.get(String(openedSeasonId).toLowerCase())) : null);
    }

    const isParentUpcoming = Boolean(effectiveOverride?.isUpcoming || effectiveOverride?.status === "upcoming");
    const isParentUnavailable = Boolean(effectiveOverride?.isUnavailable || effectiveOverride?.status === "unavailable");

    const enrichedSeasons = seasons.map((s) => {
      const sId = String(s.id).toLowerCase();
      const sOv = overrideMap.get(`anime-${sId}`) || overrideMap.get(sId);
      if (sOv) {
        return {
          ...s,
          name: sOv.customTitle || s.name,
          seasonLabel: sOv.customTitle ? sOv.customTitle : s.seasonLabel,
          status: sOv.status || (sOv.isUpcoming ? "upcoming" : s.status),
          isUpcoming: Boolean(sOv.isUpcoming || sOv.status === "upcoming" || isParentUpcoming),
          isUnavailable: Boolean(sOv.isUnavailable || sOv.status === "unavailable" || isParentUnavailable),
          customTags: sOv.customTags || [],
        };
      }
      if (isParentUpcoming || isParentUnavailable) {
        return {
          ...s,
          status: isParentUpcoming ? "upcoming" : (isParentUnavailable ? "unavailable" : s.status),
          isUpcoming: isParentUpcoming,
          isUnavailable: isParentUnavailable,
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
    }, effectiveOverride);

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
