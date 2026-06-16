import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genreId = searchParams.get("genreId");
  const sortBy = searchParams.get("sortBy") || "popularity.desc";
  const page = searchParams.get("page") || "1";
  const withProviders = searchParams.get("withProviders");
  const watchRegion = searchParams.get("watchRegion");
  const minVote = searchParams.get("minVote");
  const year = searchParams.get("year");

  const params: Record<string, string> = { sort_by: sortBy, page };
  if (genreId) params.with_genres = genreId;
  if (minVote) params["vote_average.gte"] = minVote;
  if (year) params.primary_release_year = year;

  if (withProviders) {
    params.with_watch_providers = withProviders;
    params.watch_region = watchRegion || "US";
    params.with_watch_monetization_types = "flatrate";
  }

  try {
    const data = await tmdbFetch("/discover/movie", params);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to discover movies" }, { status: 500 });
  }
}
