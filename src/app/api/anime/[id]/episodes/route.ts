export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { cacheHeaders } from "@/lib/tmdb";
import { buildAnimeCatalog, buildSeasonEpisodes } from "@/lib/anime/catalog";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const live = searchParams.get("live") === "1";
  const seasonId = searchParams.get("seasonId") || id;

  const built = await buildAnimeCatalog(id);
  if (!built) {
    return Response.json({ success: false, error: "Anime not found", data: null }, { status: 404 });
  }

  const result = await buildSeasonEpisodes(id, seasonId);
  if (!result) {
    return Response.json({ success: false, error: "Season not found", data: null }, { status: 404 });
  }

  const payload = { success: true, data: result, totalEpisodes: result.episodes.length };

  return Response.json(payload, { headers: noStoreHeaders });
}