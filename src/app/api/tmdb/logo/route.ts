export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export const revalidate = 2592000; // 30 days cache

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const typeParam = searchParams.get("type") || "movie";
  const title = searchParams.get("title") || "";
  const isAnime = typeParam === "anime";
  const type = isAnime ? "tv" : typeParam === "tv" ? "tv" : "movie";

  if (!id && !title) {
    return Response.json({ logoUrl: null }, { status: 400 });
  }

  try {
    let tmdbId: string | null = id && !isNaN(Number(id)) && Number(id) > 0 ? id : null;

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

    // 1. For non-anime, try direct TMDB ID lookup first
    if (tmdbId && !isAnime) {
      const directLogo = await fetchLogosForId(type as "movie" | "tv", tmdbId);
      if (directLogo) {
        return Response.json(directLogo, { headers: cacheHeaders(86400 * 30) });
      }
    }

    // 2. Build search queries (title, cleaned title, slug-extracted title)
    const searchQueries: string[] = [];
    if (title) {
      searchQueries.push(title);
      const cleaned = cleanSearchTitle(title);
      if (cleaned && cleaned !== title) searchQueries.push(cleaned);
      // If title has multiple words, add first 2-3 words (root title)
      const words = cleaned.split(" ");
      if (words.length > 2) {
        searchQueries.push(words.slice(0, 2).join(" "));
        searchQueries.push(words.slice(0, 3).join(" "));
      }
    }

    if (id && isNaN(Number(id))) {
      const slugTitle = cleanSearchTitle(id.replace(/-\d+$/, "").replace(/-/g, " "));
      if (slugTitle && !searchQueries.includes(slugTitle)) {
        searchQueries.push(slugTitle);
      }
    }

    const uniqueQueries = Array.from(new Set(searchQueries.filter(Boolean)));

    for (const query of uniqueQueries) {
      // For anime: search TV shows first and check top results
      if (isAnime) {
        const tvSearch = (await tmdbFetch(`/search/tv`, { query, include_adult: "false" })) as any;
        const tvResults: any[] = tvSearch?.results || [];

        // Check top TV matches for a logo
        for (const item of tvResults.slice(0, 4)) {
          if (item?.id) {
            const foundLogo = await fetchLogosForId("tv", String(item.id));
            if (foundLogo) {
              return Response.json(foundLogo, { headers: cacheHeaders(86400 * 30) });
            }
          }
        }

        // Also check anime movie search
        const movieSearch = (await tmdbFetch(`/search/movie`, { query, include_adult: "false" })) as any;
        const movieResults: any[] = movieSearch?.results || [];
        for (const item of movieResults.slice(0, 3)) {
          if (item?.id) {
            const foundLogo = await fetchLogosForId("movie", String(item.id));
            if (foundLogo) {
              return Response.json(foundLogo, { headers: cacheHeaders(86400 * 30) });
            }
          }
        }
      } else {
        // Standard Movie / TV search
        const primaryType = type === "movie" ? "movie" : "tv";
        const secondaryType = type === "movie" ? "tv" : "movie";

        const primarySearch = (await tmdbFetch(`/search/${primaryType}`, { query, include_adult: "false" })) as any;
        for (const item of (primarySearch?.results || []).slice(0, 3)) {
          if (item?.id) {
            const foundLogo = await fetchLogosForId(primaryType, String(item.id));
            if (foundLogo) {
              return Response.json(foundLogo, { headers: cacheHeaders(86400 * 30) });
            }
          }
        }

        const secondarySearch = (await tmdbFetch(`/search/${secondaryType}`, { query, include_adult: "false" })) as any;
        for (const item of (secondarySearch?.results || []).slice(0, 3)) {
          if (item?.id) {
            const foundLogo = await fetchLogosForId(secondaryType, String(item.id));
            if (foundLogo) {
              return Response.json(foundLogo, { headers: cacheHeaders(86400 * 30) });
            }
          }
        }
      }
    }

    return Response.json({ logoUrl: null }, { headers: cacheHeaders(86400 * 7) });
  } catch (error) {
    console.error("[TMDB Logo API Error]:", error);
    return Response.json({ logoUrl: null }, { status: 200, headers: cacheHeaders(86400) });
  }
}
