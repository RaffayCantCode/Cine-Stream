export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const override = await getMediaOverride("tv", id);
    if (override?.isHidden || override?.status === "hidden") {
      return Response.json({ error: "TV show is unavailable" }, { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    let data: any = null;
    let extraRecs: any = null;
    let extraSimilar: any = null;

    try {
      [data, extraRecs, extraSimilar] = await Promise.all([
        tmdbFetch(`/tv/${id}`, {
          append_to_response: "credits,videos,similar,recommendations",
        }),
        tmdbFetch(`/tv/${id}/recommendations`, { page: "2" }).catch(() => null),
        tmdbFetch(`/tv/${id}/similar`, { page: "2" }).catch(() => null),
      ]);
    } catch (fetchErr) {
      if (override) {
        const synthetic = applyMediaOverride(null, override);
        return Response.json(synthetic, { headers: cacheHeaders(1800) });
      }
      throw fetchErr;
    }

    const result = data as Record<string, unknown>;
    const recs = result.recommendations as { results?: unknown[] } | undefined;
    const sim = result.similar as { results?: unknown[] } | undefined;

    const isAnime = (item: any) =>
      item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16);

    if (recs?.results) {
      recs.results = recs.results.filter((item: any) => !isAnime(item));
    }

    if (sim?.results) {
      sim.results = sim.results.filter((item: any) => !isAnime(item));
    }

    if (extraRecs && recs?.results) {
      const existing = new Set(recs.results.map((r: any) => r.id));
      for (const item of (extraRecs as any).results ?? []) {
        if (!isAnime(item) && !existing.has(item.id)) {
          existing.add(item.id);
          recs.results.push(item);
        }
      }
    }

    if (extraSimilar && sim?.results) {
      const existing = new Set(sim.results.map((r: any) => r.id));
      for (const item of (extraSimilar as any).results ?? []) {
        if (!isAnime(item) && !existing.has(item.id)) {
          existing.add(item.id);
          sim.results.push(item);
        }
      }
    }

    const finalResult = applyMediaOverride(result, override);
    return Response.json(finalResult, {
      headers: cacheHeaders(3600),
    });
  } catch (error) {
    const fallbackOverride = await getMediaOverride("tv", id).catch(() => null);
    if (fallbackOverride) {
      const synthetic = applyMediaOverride(null, fallbackOverride);
      return Response.json(synthetic, {
        headers: cacheHeaders(1800),
      });
    }
    return Response.json({ error: "Failed to fetch TV show details" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
