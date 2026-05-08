import { tmdbFetch } from "@/lib/tmdb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await tmdbFetch(`/movie/${id}`, {
      append_to_response: "credits,videos,similar",
    });
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch movie details" },
      { status: 500 }
    );
  }
}
