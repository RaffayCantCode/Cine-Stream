export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const providerIdsStr = searchParams.get("providerIds"); // pipe-separated
  const region = searchParams.get("region") || "US";
  const page = searchParams.get("page") || "1";

  if (!query || !providerIdsStr) {
    return NextResponse.json({ success: false, error: "Missing query or providerIds" }, { status: 400 });
  }

  const providerIds = providerIdsStr.split("|").map(Number);

  try {
    // 1. Search Multi
    const searchData = await tmdbFetch(`/search/multi`, {
      query,
      page,
      include_adult: "false",
    }) as any;
    
    const rawResults = searchData.results || [];
    
    // Only movie and tv
    const mediaResults = rawResults.filter((r: any) => r.media_type === "movie" || r.media_type === "tv");

    // 2. Fetch watch providers concurrently
    const filteredResults = [];
    
    const providerChecks = mediaResults.map(async (item: any) => {
      try {
        const wpData = await tmdbFetch(`/${item.media_type}/${item.id}/watch/providers`) as any;
        const countryData = wpData.results?.[region];
        if (!countryData) return null;

        // Check flatrate, free, ads, buy, rent
        const allProvidersInCountry = [
          ...(countryData.flatrate || []),
          ...(countryData.free || []),
          ...(countryData.ads || []),
          ...(countryData.rent || []),
          ...(countryData.buy || []),
        ];

        const hasProvider = allProvidersInCountry.some(p => providerIds.includes(p.provider_id));
        
        if (hasProvider) {
          return item;
        }
        return null;
      } catch (e) {
        return null;
      }
    });

    const checked = await Promise.all(providerChecks);
    for (const item of checked) {
      if (item) filteredResults.push(item);
    }

    return NextResponse.json({
      success: true,
      results: filteredResults,
      page: searchData.page,
      total_pages: searchData.total_pages,
      total_results: searchData.total_results
    });

  } catch (error: any) {
    console.error("Provider search error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
