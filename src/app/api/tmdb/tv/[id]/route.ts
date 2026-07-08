export const runtime = 'edge';
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [data, extraRecs, extraSimilar] = await Promise.all([
      tmdbFetch(`/tv/${id}`, {
        append_to_response: "credits,videos,similar,recommendations",
      }),
      tmdbFetch(`/tv/${id}/recommendations`, { page: "2" }).catch(() => null),
      tmdbFetch(`/tv/${id}/similar`, { page: "2" }).catch(() => null),
    ]);

    const result = data as Record<string, unknown>;
    const recs = result.recommendations as { results?: unknown[] } | undefined;
    const sim = result.similar as { results?: unknown[] } | undefined;

    if (extraRecs && recs?.results) {
      const existing = new Set(recs.results.map((r: any) => r.id));
      for (const item of (extraRecs as any).results ?? []) {
        if (!existing.has(item.id)) {
          existing.add(item.id);
          recs.results.push(item);
        }
      }
    }

    if (extraSimilar && sim?.results) {
      const existing = new Set(sim.results.map((r: any) => r.id));
      for (const item of (extraSimilar as any).results ?? []) {
        if (!existing.has(item.id)) {
          existing.add(item.id);
          sim.results.push(item);
        }
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: "Failed to fetch TV show details" }, { status: 500 });
  }
}
