export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { cacheHeaders } from "@/lib/tmdb";
import { buildAnimeCatalog, buildSeasonEpisodes } from "@/lib/anime/catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const built = await buildAnimeCatalog(id);
    if (!built) {
      return Response.json({ success: false, error: "Anime not found" }, { status: 404 });
    }

    const { catalog } = built;
    const opened = await buildSeasonEpisodes(id, catalog.openedSeasonId);
    const episodes = opened?.episodes || [];

    return Response.json(
      {
        success: true,
        data: {
          ...catalog.anime,
          totalEpisodes: catalog.anime.totalEpisodes ?? episodes.length,
          seasons: catalog.seasons,
          openedSeasonId: catalog.openedSeasonId,
          franchiseNodes: catalog.franchiseNodes,
          tmdbId: catalog.tmdbId,
          tmdbSeasonMap: catalog.tmdbSeasonMap,
          episodes,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[api/anime/[id]] Error building catalog:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load anime" },
      { status: 500 }
    );
  }
}