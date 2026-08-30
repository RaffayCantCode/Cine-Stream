export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

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

  // Map generic "release_date" sort to TMDB's tv-specific "first_air_date"
  if (sortBy === "release_date.desc") sortBy = "first_air_date.desc";
  if (sortBy === "release_date.asc") sortBy = "first_air_date.asc";

  const params: Record<string, string> = { sort_by: sortBy, page };
  if (genreId) params.with_genres = genreId;
  if (minVote) params["vote_average.gte"] = minVote;
  if (year) params.first_air_date_year = year;
  if (maxRuntime) params["with_runtime.lte"] = maxRuntime;
  if (minRuntime) params["with_runtime.gte"] = minRuntime;

  if (withProviders) {
    params.with_watch_providers = withProviders;
    params.watch_region = watchRegion || "US";
    params.with_watch_monetization_types = monetizationTypes;
  }

  // Exclude anime: TMDB keyword 210024 = "anime" (authoritative classification)
  // Also exclude Japanese-language Animation (genre 16) as a secondary signal
  // for titles not yet tagged with the keyword. Western animation is unaffected
  // because it is typically English-language.
  params.without_keywords = "210024";
  params.without_original_language = "ja";

  try {
    const data = await tmdbFetch("/discover/tv", params, { noCache: false });
    return Response.json(data, { headers: cacheHeaders(3600) });
  } catch (error) {
    return Response.json({ error: "Failed to discover TV shows" }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
