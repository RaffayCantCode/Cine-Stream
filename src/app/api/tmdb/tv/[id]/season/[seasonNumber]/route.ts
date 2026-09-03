export const runtime = 'edge';
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; seasonNumber: string }> }
) {
  const { id, seasonNumber } = await params;

  try {
    const data = await tmdbFetch(
      `/tv/${id}/season/${seasonNumber}`,
      { append_to_response: "videos" },
      { noCache: false }
    );
    return Response.json(data, { headers: cacheHeaders(3600) });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch season details" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
