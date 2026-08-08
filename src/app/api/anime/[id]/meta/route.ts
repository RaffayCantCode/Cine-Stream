export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { cacheHeaders } from "@/lib/tmdb";
import { buildAnimeCatalog } from "@/lib/anime/catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const built = await buildAnimeCatalog(id);
  if (!built) {
    return Response.json({ success: false, error: "Anime not found" }, { status: 404 });
  }

  const { catalog } = built;

  return Response.json(
    {
      success: true,
      data: {
        anime: {
          ...catalog.anime,
          totalEpisodes: catalog.anime.totalEpisodes,
          seasons: catalog.seasons,
          openedSeasonId: catalog.openedSeasonId,
          tmdbId: catalog.tmdbId,
          tmdbSeasonMap: catalog.tmdbSeasonMap,
        },
        franchiseNodes: catalog.franchiseNodes,
        tmdbSeasonMap: catalog.tmdbSeasonMap,
      },
    },
    { headers: cacheHeaders(3600) }
  );
}