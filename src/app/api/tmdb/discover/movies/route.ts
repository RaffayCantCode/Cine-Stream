export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genreId = searchParams.get("genreId");
  let sortBy = searchParams.get("sortBy") || "popularity.desc";
  const page = searchParams.get("page") || "1";
  const withProviders = searchParams.get("withProviders");
  const watchRegion = searchParams.get("watchRegion");
  const minVote = searchParams.get("minVote");
  const year = searchParams.get("year");
  const maxRuntime = searchParams.get("maxRuntime");
  const minRuntime = searchParams.get("minRuntime");
  // Per-provider monetization override (defaults to "flatrate")
  const monetizationTypes = searchParams.get("monetizationTypes") || "flatrate";

  // Map generic "release_date" sort to TMDB's movie-specific "primary_release_date"
  if (sortBy === "release_date.desc") sortBy = "primary_release_date.desc";
  if (sortBy === "release_date.asc") sortBy = "primary_release_date.asc";

  const params: Record<string, string> = { sort_by: sortBy, page };
  if (genreId) params.with_genres = genreId;
  if (minVote) params["vote_average.gte"] = minVote;
  if (year) params.primary_release_year = year;
  if (maxRuntime) params["with_runtime.lte"] = maxRuntime;
  if (minRuntime) params["with_runtime.gte"] = minRuntime;

  if (withProviders) {
    params.with_watch_providers = withProviders;
    params.watch_region = watchRegion || "US";
    params.with_watch_monetization_types = monetizationTypes;
  }

  try {
    // Skip all caches for provider-filtered requests — ensures fresh results after any config change
    const data = await tmdbFetch("/discover/movie", {
      ...params,
      include_adult: "true",
    }, { noCache: !!withProviders });
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to discover movies" }, { status: 500 });
  }
}
