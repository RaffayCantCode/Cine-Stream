export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { getAnimeDetails } from "@/lib/anime-fetch";
import { getMediaOverride, applyMediaOverride, getAllMediaOverrides } from "@/lib/media-overrides";

// no-store: for hidden/error responses or uncacheable content
const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

// Short CDN cache for ongoing/airing anime (2 min CDN, 5 min stale)
const ongoingCacheHeaders = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300, stale-if-error=3600",
  "CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=300",
  "Cloudflare-CDN-Cache-Control": "public, max-age=120, stale-while-revalidate=300",
} as const;

// Longer CDN cache for completed anime (5 min CDN, 15 min stale)
const finishedCacheHeaders = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900, stale-if-error=86400",
  "CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=900",
  "Cloudflare-CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=900",
} as const;

function getAnimeCacheHeaders(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (s.includes("RELEASING") || s.includes("AIRING") || s.includes("NOT_YET")) {
    return ongoingCacheHeaders;
  }
  return finishedCacheHeaders;
}


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
        if (/^\d+$/.test(cleanId)) {
          overrideMap.set(`kitsu-${cleanId}`, o);
          overrideMap.set(`mal-${cleanId}`, o);
          overrideMap.set(`anime-kitsu-${cleanId}`, o);
          overrideMap.set(`anime-mal-${cleanId}`, o);
        }
      }
    }

    // If main override wasn't found by route ID, check id candidates, anime.id or openedSeasonId
    let effectiveOverride = override;
    if (!effectiveOverride) {
      const idLower = id.toLowerCase();
      const idNum = idLower.replace(/^(kitsu-|mal-|anime-|tv-)/, "");
      effectiveOverride = overrideMap.get(`anime-${idLower}`) || 
                          overrideMap.get(idLower) || 
                          overrideMap.get(`anime-${idNum}`) || 
                          overrideMap.get(idNum);
    }
    if (!effectiveOverride && anime) {
      const aId = String(anime.id || "").toLowerCase();
      const aIdNum = aId.replace(/^(kitsu-|mal-|anime-|tv-)/, "");
      effectiveOverride = overrideMap.get(`anime-${aId}`) || 
                          overrideMap.get(aId) || 
                          overrideMap.get(`anime-${aIdNum}`) || 
                          overrideMap.get(aIdNum) || 
                          (openedSeasonId ? (overrideMap.get(`anime-${String(openedSeasonId).toLowerCase()}`) || overrideMap.get(String(openedSeasonId).toLowerCase())) : null);
    }

    const isParentUpcoming = Boolean(effectiveOverride?.isUpcoming || effectiveOverride?.status === "upcoming");
    const isParentUnavailable = Boolean(effectiveOverride?.isUnavailable || effectiveOverride?.status === "unavailable");

    const enrichedSeasons = seasons.map((s) => {
      const sId = String(s.id).toLowerCase();
      const sIdNum = sId.replace(/^(kitsu-|mal-|anime-|tv-)/, "");
      const sOv = overrideMap.get(`anime-${sId}`) || 
                  overrideMap.get(sId) || 
                  overrideMap.get(`anime-${sIdNum}`) || 
                  overrideMap.get(sIdNum);
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

    // Use smart caching: ongoing/airing anime get 2min CDN cache, finished anime get 5min CDN cache
    const cacheHeaders = (isParentUpcoming || isParentUnavailable)
      ? noStoreHeaders
      : getAnimeCacheHeaders((finalAnime as any)?.status || anime?.status);

    return Response.json({
      success: true,
      data: {
        anime: finalAnime,
        franchiseNodes,
        tmdbSeasonMap,
      },
    }, { headers: cacheHeaders });
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
