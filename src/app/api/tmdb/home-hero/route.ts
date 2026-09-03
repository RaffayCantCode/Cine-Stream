export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 3600;

export async function GET(_request: NextRequest) {
  try {
    // Fetch from a wide mix of quality sources in parallel:
    // trending (current popularity), top-rated movies, top-rated TV (all-time acclaimed),
    // popular movies, and popular TV — so the fast initial hero candidates are genuinely great.
    const results = await Promise.allSettled([
      tmdbFetch("/trending/all/day",       { page: "1", include_adult: "false" }),
      tmdbFetch("/movie/top_rated",        { page: "1", include_adult: "false" }),
      tmdbFetch("/movie/top_rated",        { page: "2", include_adult: "false" }),
      tmdbFetch("/tv/top_rated",           { page: "1", include_adult: "false" }),
      tmdbFetch("/movie/popular",          { page: "1", include_adult: "false" }),
      tmdbFetch("/tv/popular",             { page: "1", include_adult: "false" }),
    ]);

    const extractResults = (res: PromiseSettledResult<unknown>, mediaType?: string) => {
      if (res.status === "fulfilled" && res.value && typeof res.value === "object" && "results" in res.value) {
        const items = (res.value as { results?: any[] }).results || [];
        return mediaType ? items.map((i) => ({ ...i, media_type: mediaType })) : items;
      }
      return [];
    };

    const rawList = [
      ...extractResults(results[0]),                          // trending/all — has media_type set
      ...extractResults(results[1], "movie"),                 // top-rated movies p1
      ...extractResults(results[2], "movie"),                 // top-rated movies p2
      ...extractResults(results[3], "tv"),                    // top-rated TV p1
      ...extractResults(results[4], "movie"),                 // popular movies
      ...extractResults(results[5], "tv"),                    // popular TV
    ];

    // Quality score: rating × log10(votes) — prefers acclaimed & widely-seen entries
    const qualityScore = (item: any): number => {
      const r = item.vote_average || 0;
      const v = item.vote_count || 0;
      if (v < 100) return 0;
      return r * Math.log10(Math.max(v, 10));
    };

    // Deduplicate and filter high-quality hero candidates
    const seen = new Set<string | number>();
    const candidates: any[] = [];

    // Sort by quality before deduplication so the best entry wins per ID
    rawList
      .filter(
        (item) =>
          item &&
          item.id &&
          !item.adult &&
          item.backdrop_path &&
          item.poster_path &&
          item.overview &&
          item.overview.trim().length >= 20 &&
          // Exclude Japanese animation from TMDB hero route (handled by AniList on client)
          !(item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16))
      )
      .sort((a, b) => qualityScore(b) - qualityScore(a))
      .forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        candidates.push(item);
      });

    // Pre-resolve logo for the top candidate so artwork loads with 0 delay on client
    if (candidates.length > 0) {
      const top = candidates[0];
      const targetType = top.media_type === "tv" ? "tv" : "movie";
      try {
        const imgRes = (await tmdbFetch(`/${targetType}/${top.id}/images`, {
          include_image_language: "en,null,ja",
        })) as any;
        if (imgRes && Array.isArray(imgRes.logos) && imgRes.logos.length > 0) {
          const enLogo = imgRes.logos.find((l: any) => l.iso_639_1 === "en" && l.file_path);
          const fallbackLogo = imgRes.logos.find((l: any) => l.file_path);
          const chosen = enLogo || fallbackLogo;
          if (chosen?.file_path) {
            top.logoUrl = `https://image.tmdb.org/t/p/w500${chosen.file_path}`;
          }
        }
      } catch {}
    }

    return Response.json({ results: candidates }, { headers: cacheHeaders(3600) });
  } catch {
    return Response.json({ results: [] }, { status: 500 });
  }
}
