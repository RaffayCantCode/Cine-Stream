export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextResponse } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("providerId");
  const mediaType = searchParams.get("mediaType") || "movie"; // "movie" or "tv"
  const region = searchParams.get("region") || "US";
  const page = searchParams.get("page") || "1";

  if (!providerId) {
    return NextResponse.json({ success: false, error: "Missing providerId" }, { status: 400 });
  }

  try {
    const data = await tmdbFetch(`/discover/${mediaType}`, {
      with_watch_providers: providerId,
      watch_region: region,
      sort_by: "popularity.desc",
      page,
      include_adult: "false",
      include_video: "false",
    }) as any;

    return NextResponse.json({
      success: true,
      results: data.results || [],
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results
    }, { headers: cacheHeaders(3600) });

  } catch (error: any) {
    console.error("Discover provider error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
