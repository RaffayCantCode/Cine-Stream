export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await tmdbFetch(`/movie/${id}/videos`);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to fetch movie videos" }, { status: 500 });
  }
}
