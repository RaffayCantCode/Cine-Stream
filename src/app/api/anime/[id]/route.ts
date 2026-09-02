export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";

const animeNoStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

const animeCacheHeaders = {
  "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, max-age=3600",
  "Cloudflare-CDN-Cache-Control": "public, max-age=3600",
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const override = await getMediaOverride("anime", id);
    const data = await fetchAnimeApi(`/series/${id}`, true);

    if (!data || !data.success || !data.data) {
      if (override) {
        const synthetic = applyMediaOverride(null, override);
        return Response.json({
          success: true,
          data: {
            anime: {
              ...synthetic,
              episodes: [],
              totalEpisodes: 0,
              seasons: [],
            },
          },
        }, { headers: animeCacheHeaders });
      }

      return Response.json(
        { error: "Anime not found", success: false },
        { status: 404, headers: animeNoStoreHeaders }
      );
    }

    const rawAnime = data.data;
    const finalAnime = applyMediaOverride(rawAnime, override) || rawAnime;

    const episodes = (finalAnime.isUpcoming || finalAnime.isUnavailable) ? [] : (finalAnime.episodes || []);
    const totalEps = (finalAnime.isUpcoming || finalAnime.isUnavailable) ? 0 : (finalAnime.totalEpisodes || episodes.length || 0);
    const seasons = finalAnime.seasons || [];

    return Response.json({
      success: true,
      data: {
        anime: {
          ...finalAnime,
          episodes,
          totalEpisodes: totalEps,
          seasons,
        },
      },
    }, { headers: animeCacheHeaders });
  } catch (error) {
    console.error("[Anime Details Error]:", error);
    const fallbackOverride = await getMediaOverride("anime", id).catch(() => null);
    if (fallbackOverride) {
      const synthetic = applyMediaOverride(null, fallbackOverride);
      return Response.json({
        success: true,
        data: {
          anime: {
            ...synthetic,
            episodes: [],
            totalEpisodes: 0,
            seasons: [],
          },
        },
      }, { headers: animeNoStoreHeaders });
    }

    return Response.json(
      { error: "Failed to fetch anime details", success: false },
      { status: 500, headers: animeNoStoreHeaders }
    );
  }
}
