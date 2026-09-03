export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 3600;

// High-speed edge memory cache for hero candidates (10-minute TTL)
let cachedHeroResult: { results: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(_request: NextRequest) {
  try {
    const now = Date.now();
    if (cachedHeroResult && now - cachedHeroResult.timestamp < CACHE_TTL_MS) {
      return Response.json({ results: cachedHeroResult.results }, { headers: cacheHeaders(3600) });
    }

    // High-speed edge queries to get prime hero candidates in <100ms
    const results = await Promise.allSettled([
      tmdbFetch("/trending/all/day", { page: "1", include_adult: "false" }),
      tmdbFetch("/trending/movie/day", { page: "1", include_adult: "false" }),
      tmdbFetch("/trending/tv/day", { page: "1", include_adult: "false" }),
      tmdbFetch("/movie/popular", { page: "1", include_adult: "false" }),
    ]);

    const extractResults = (res: PromiseSettledResult<unknown>) => {
      if (res.status === "fulfilled" && res.value && typeof res.value === "object" && "results" in res.value) {
        return (res.value as { results?: any[] }).results || [];
      }
      return [];
    };

    const rawList = [
      ...extractResults(results[0]),
      ...extractResults(results[1]).map((i) => ({ ...i, media_type: "movie" })),
      ...extractResults(results[2]).map((i) => ({ ...i, media_type: "tv" })),
      ...extractResults(results[3]).map((i) => ({ ...i, media_type: "movie" })),
    ];

    // Deduplicate and filter high-quality hero candidates
    const seen = new Set<string | number>();
    const candidates: any[] = [];

    for (const item of rawList) {
      if (!item || !item.id || seen.has(item.id)) continue;
      if (item.adult) continue;
      if (!item.backdrop_path || !item.poster_path) continue;
      if (!item.overview || item.overview.trim().length < 20) continue;
      if (item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16)) continue;

      seen.add(item.id);
      candidates.push(item);
      if (candidates.length >= 10) break;
    }

    // Pre-resolve logos for the first 3 candidates in parallel so artwork loads with 0 delay
    if (candidates.length > 0) {
      await Promise.allSettled(
        candidates.slice(0, 3).map(async (item) => {
          const targetType = item.media_type === "tv" ? "tv" : "movie";
          try {
            const imgRes = (await tmdbFetch(`/${targetType}/${item.id}/images`, {
              include_image_language: "en,null,ja",
            })) as any;
            if (imgRes && Array.isArray(imgRes.logos) && imgRes.logos.length > 0) {
              const enLogo = imgRes.logos.find((l: any) => l.iso_639_1 === "en" && l.file_path);
              const fallbackLogo = imgRes.logos.find((l: any) => l.file_path);
              const chosen = enLogo || fallbackLogo;
              if (chosen?.file_path) {
                item.logoUrl = `https://image.tmdb.org/t/p/w500${chosen.file_path}`;
              }
            }
          } catch {}
        })
      );
    }

    if (candidates.length > 0) {
      cachedHeroResult = { results: candidates, timestamp: now };
    }

    return Response.json({ results: candidates }, { headers: cacheHeaders(3600) });
  } catch {
    if (cachedHeroResult) {
      return Response.json({ results: cachedHeroResult.results }, { headers: cacheHeaders(3600) });
    }
    return Response.json({ results: [] }, { status: 500 });
  }
}
