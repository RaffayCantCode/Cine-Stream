export const runtime = 'edge';
import { cacheHeaders } from "@/lib/tmdb";
import { fetchMovieDetails } from "@/lib/tmdb-details";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await fetchMovieDetails(id);

    if (result.hidden) {
      return Response.json(
        { error: "Movie is unavailable" },
        { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    if (!result.data) {
      return Response.json(
        { error: result.error || "Failed to fetch movie details" },
        { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    return Response.json(result.data, {
      headers: cacheHeaders(21600),
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch movie details" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
