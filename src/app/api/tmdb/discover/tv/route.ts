import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genreId = searchParams.get("genreId");
  const sortBy = searchParams.get("sortBy") || "popularity.desc";
  const page = searchParams.get("page") || "1";

  const params: Record<string, string> = { sort_by: sortBy, page };
  if (genreId) params.with_genres = genreId;

  try {
    const data = await tmdbFetch("/discover/tv", params);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to discover TV shows" }, { status: 500 });
  }
}
