import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genreId = searchParams.get("genreId");
  const sortBy = searchParams.get("sortBy") || "popularity.desc";
  const page = searchParams.get("page") || "1";

  const params: Record<string, string> = { sort_by: sortBy, page };
  if (genreId) params.with_genres = genreId;

  const withProviders = searchParams.get("withProviders");
  const watchRegion = searchParams.get("watchRegion");
  if (withProviders) {
    params.with_watch_providers = withProviders;
    params.watch_region = watchRegion || "US";
    params.with_watch_monetization_types = "flatrate";
  }

  try {
    const data = await tmdbFetch("/discover/tv", params);
    return Response.json(data);
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : "Failed to discover TV shows";
    return Response.json({ error: message }, { status: 500 });
  }
}
