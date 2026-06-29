import { tmdbFetch } from "@/lib/tmdb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await tmdbFetch(`/tv/${id}/videos`);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to fetch TV videos" }, { status: 500 });
  }
}
