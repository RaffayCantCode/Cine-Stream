export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 2592000; // 30 days cache

// Edge memory cache for fast sub-millisecond repeated logo queries
const logoMemoryCache = new Map<string, { logoUrl: string | null; aspectRatio?: number; width?: number; height?: number }>();

function cleanSearchTitle(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/\s*\([^)]*\)\s*/g, " ") // Remove (Dub), (TV), etc.
    .replace(/\b(season|part|cour|arc)\s*(\d+|[ivx]+)\b/gi, " ") // Remove Season 2, Season II, etc.
    .replace(/\b(\d+)(st|nd|rd|th)\s+season\b/gi, " ") // Remove 2nd Season, 3rd Season
    .replace(/\b(the\s+final\s+season|final\s+season|the\s+final\s+chapters|the\s+movie|the\s+animation|entertainment\s+district|hashira\s+training|swordsmith\s+village|mugen\s+train|shippuden|brotherhood|tv|ova|ona|special)\b/gi, " ")
    .replace(/[:\-–—_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function isTitleMatch(target: string, candidate: string): boolean {
  if (!target || !candidate) return false;
  const normTarget = normalizeTitle(target);
  const normCandidate = normalizeTitle(candidate);
  if (!normTarget || !normCandidate) return false;

  // Exact normalized match
  if (normTarget === normCandidate) return true;

  // Prefix match with high length ratio
  if (normTarget.startsWith(normCandidate) || normCandidate.startsWith(normTarget)) {
    const minLen = Math.min(normTarget.length, normCandidate.length);
    const maxLen = Math.max(normTarget.length, normCandidate.length);
    if (minLen / maxLen >= 0.75) return true;
  }

  // Token overlap check
  const targetWords = target.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const candidateWords = candidate.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (targetWords.length === 0 || candidateWords.length === 0) return false;

  const targetSet = new Set(targetWords);
  const matches = candidateWords.filter(w => targetSet.has(w)).length;
  const overlapRatio = (2 * matches) / (targetWords.length + candidateWords.length);
  return overlapRatio >= 0.75;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const explicitTmdbId = searchParams.get("tmdbId");
  const typeParam = searchParams.get("type") || "movie";
  const title = searchParams.get("title") || "";
  const isAnime = typeParam === "anime";
  const type = isAnime ? "tv" : typeParam === "tv" ? "tv" : "movie";

  if (!id && !title && !explicitTmdbId) {
    return Response.json({ logoUrl: null }, { status: 400 });
  }

  const cacheKey = `${id || ""}_${explicitTmdbId || ""}_${typeParam}_${title.trim().toLowerCase()}`;
  if (logoMemoryCache.has(cacheKey)) {
    return Response.json(logoMemoryCache.get(cacheKey), { headers: cacheHeaders(86400 * 30) });
  }

  const returnLogo = (data: { logoUrl: string | null; aspectRatio?: number; width?: number; height?: number }) => {
    logoMemoryCache.set(cacheKey, data);
    return Response.json(data, { headers: cacheHeaders(data.logoUrl ? 86400 * 30 : 86400 * 7) });
  };

  try {
    let tmdbId: string | null = (explicitTmdbId && !isNaN(Number(explicitTmdbId))) 
      ? explicitTmdbId 
      : (id && !isNaN(Number(id)) && Number(id) > 0 ? id : null);

    // Helper to fetch logos for a given type & ID
    const fetchLogosForId = async (targetType: "movie" | "tv", targetId: string) => {
      try {
        const res = (await tmdbFetch(`/${targetType}/${targetId}/images`, {
          include_image_language: "en,null,ja,es,fr,de,it,pt,ru,ko,zh",
        })) as any;
        if (res && Array.isArray(res.logos) && res.logos.length > 0) {
          const englishLogo = res.logos.find(
            (l: any) => l.iso_639_1 === "en" && l.file_path
          );
          const nullLangLogo = res.logos.find(
            (l: any) => (!l.iso_639_1 || l.iso_639_1 === "null") && l.file_path
          );
          const jaLogo = res.logos.find(
            (l: any) => l.iso_639_1 === "ja" && l.file_path
          );
          const chosen = englishLogo || nullLangLogo || jaLogo || res.logos[0];
          if (chosen?.file_path) {
            return {
              logoUrl: `https://image.tmdb.org/t/p/w500${chosen.file_path}`,
              aspectRatio: chosen.aspect_ratio || 1,
              width: chosen.width,
              height: chosen.height,
            };
          }
        }
      } catch {}
      return null;
    };

    // 0. Explicit TMDB ID lookup (if caller specifically provided a tmdbId, even for anime)
    if (explicitTmdbId) {
      const directLogo = (await fetchLogosForId("tv", explicitTmdbId)) || (await fetchLogosForId("movie", explicitTmdbId));
      if (directLogo) {
        return returnLogo(directLogo);
      }
    }

    // 1. Direct TMDB ID lookup first (fastest and most accurate)
    // CRITICAL: NEVER treat an anime ID as a TMDB ID because anime uses AniList IDs (e.g. Bleach is 269 on AniList, but TMDB TV 269 is One Tree Hill!)
    if (tmdbId && !isAnime && !explicitTmdbId) {
      const directLogo = await fetchLogosForId(type as "movie" | "tv", tmdbId);
      if (directLogo) {
        return returnLogo(directLogo);
      }
      // If direct TMDB ID failed and media is non-anime, do not guess unrelated titles
      if (!title) {
        return returnLogo({ logoUrl: null });
      }
    }

    // 2. Build search queries (only target title and clean title — NEVER partial words that cause false matches)
    const searchQueries: string[] = [];
    if (title) {
      searchQueries.push(title.trim());
      const cleaned = cleanSearchTitle(title);
      if (cleaned && cleaned !== title.trim() && cleaned.length >= 3) {
        searchQueries.push(cleaned);
      }
    }

    if (id && isNaN(Number(id))) {
      const slugTitle = cleanSearchTitle(id.replace(/-\d+$/, "").replace(/-/g, " "));
      if (slugTitle && slugTitle.length >= 3 && !searchQueries.includes(slugTitle)) {
        searchQueries.push(slugTitle);
      }
    }

    const uniqueQueries = Array.from(new Set(searchQueries.filter(q => q && q.length >= 2)));

    for (const query of uniqueQueries) {
      if (isAnime) {
        // Search TV and Movie in parallel for speed
        const [tvSearch, movieSearch] = await Promise.all([
          tmdbFetch(`/search/tv`, { query, include_adult: "false" }).catch(() => null) as Promise<any>,
          tmdbFetch(`/search/movie`, { query, include_adult: "false" }).catch(() => null) as Promise<any>,
        ]);

        const candidateList: { type: "tv" | "movie"; id: string; name: string }[] = [];

        for (const item of (tvSearch?.results || []).slice(0, 6)) {
          const candName = item.name || item.original_name || "";
          // Must be actual Japanese origin OR animation genre to prevent matching live-action TV shows with the same name
          const isAnimeCandidate = item.original_language === "ja" || item.genre_ids?.includes(16);
          if (item?.id && isAnimeCandidate && isTitleMatch(query, candName)) {
            candidateList.push({ type: "tv", id: String(item.id), name: candName });
          }
        }

        for (const item of (movieSearch?.results || []).slice(0, 4)) {
          const candName = item.title || item.original_title || "";
          const isAnimeCandidate = item.original_language === "ja" || item.genre_ids?.includes(16);
          if (item?.id && isAnimeCandidate && isTitleMatch(query, candName)) {
            candidateList.push({ type: "movie", id: String(item.id), name: candName });
          }
        }

        if (candidateList.length > 0) {
          // Fetch logos in parallel
          const logoResults = await Promise.all(
            candidateList.map(cand => fetchLogosForId(cand.type, cand.id))
          );
          const found = logoResults.find(Boolean);
          if (found) {
            return returnLogo(found);
          }
        }
      } else {
        // Standard Movie / TV search with strict title match verification
        const primaryType = type === "movie" ? "movie" : "tv";
        const secondaryType = type === "movie" ? "tv" : "movie";

        const [primarySearch, secondarySearch] = await Promise.all([
          tmdbFetch(`/search/${primaryType}`, { query, include_adult: "false" }).catch(() => null) as Promise<any>,
          tmdbFetch(`/search/${secondaryType}`, { query, include_adult: "false" }).catch(() => null) as Promise<any>,
        ]);

        const candidateList: { type: "movie" | "tv"; id: string; name: string }[] = [];

        for (const item of (primarySearch?.results || []).slice(0, 4)) {
          const candName = item.title || item.name || item.original_title || item.original_name || "";
          if (item?.id && isTitleMatch(query, candName)) {
            candidateList.push({ type: primaryType, id: String(item.id), name: candName });
          }
        }

        for (const item of (secondarySearch?.results || []).slice(0, 2)) {
          const candName = item.title || item.name || item.original_title || item.original_name || "";
          if (item?.id && isTitleMatch(query, candName)) {
            candidateList.push({ type: secondaryType, id: String(item.id), name: candName });
          }
        }

        if (candidateList.length > 0) {
          const logoResults = await Promise.all(
            candidateList.map(cand => fetchLogosForId(cand.type, cand.id))
          );
          const found = logoResults.find(Boolean);
          if (found) {
            return returnLogo(found);
          }
        }
      }
    }

    return returnLogo({ logoUrl: null });
  } catch (error) {
    console.error("[TMDB Logo API Error]:", error);
    return Response.json({ logoUrl: null }, { status: 200, headers: cacheHeaders(86400) });
  }
}
