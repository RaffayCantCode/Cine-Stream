export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { fetchJson } from "@/lib/utils";

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const mediaType = request.nextUrl.searchParams.get("type") || "all"; // all | movie | tv | anime

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results: any[] = [];

  try {
    const tmdbHeaders = {
      Authorization: `Bearer ${TMDB_API_KEY}`,
      accept: "application/json",
    };

    // 1. Search TMDB (Movies & TV)
    if (mediaType === "all" || mediaType === "movie" || mediaType === "tv") {
      const tmdbSearchUrl = `${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
      const tmdbData = await fetch(tmdbSearchUrl, { headers: tmdbHeaders, signal: AbortSignal.timeout(4000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (tmdbData?.results) {
        for (const item of tmdbData.results) {
          if (item.media_type !== "movie" && item.media_type !== "tv") continue;
          if (!item.poster_path && !item.backdrop_path) continue;

          // Check if TMDB anime
          const isAnime = item.genre_ids?.includes(16) && item.original_language === "ja";

          results.push({
            id: item.id,
            media_type: isAnime ? "anime" : item.media_type,
            title: item.title || item.name || "",
            name: item.name || item.title || "",
            poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "",
            backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : "",
            release_date: item.release_date || item.first_air_date || "",
            vote_average: item.vote_average ? Number(item.vote_average.toFixed(1)) : 0,
            overview: item.overview || "",
            isTmdbAnime: isAnime,
          });
        }
      }
    }

    // 2. Search AniList (Anime)
    if (mediaType === "all" || mediaType === "anime") {
      const anilistQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 12) {
            media(search: $search, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
              id
              idMal
              title { romaji english native }
              coverImage { large extraLarge }
              bannerImage
              episodes
              averageScore
              description
              status
              format
              seasonYear
            }
          }
        }
      `;

      const aniData = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: anilistQuery, variables: { search: query } }),
        signal: AbortSignal.timeout(4000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (aniData?.data?.Page?.media) {
        for (const item of aniData.data.Page.media) {
          const title = item.title?.english || item.title?.romaji || "Anime";
          const poster = item.coverImage?.extraLarge || item.coverImage?.large || "";
          results.push({
            id: String(item.id),
            anilistId: String(item.id),
            media_type: "anime",
            title,
            name: title,
            poster_path: poster,
            backdrop_path: item.bannerImage || poster,
            release_date: item.seasonYear ? `${item.seasonYear}-01-01` : "",
            vote_average: item.averageScore ? Number((item.averageScore / 10).toFixed(1)) : 8.5,
            overview: item.description?.replace(/<[^>]*>?/gm, "") || "",
            isTmdbAnime: false,
          });
        }
      }
    }

    // Deduplicate results
    const uniqueMap = new Map<string, any>();
    for (const item of results) {
      const key = `${item.media_type}_${item.id}_${item.title.toLowerCase().trim()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    return NextResponse.json({ results: Array.from(uniqueMap.values()).slice(0, 24) });
  } catch (error) {
    console.error("[Media Search API] Error:", error);
    return NextResponse.json({ results: [] });
  }
}
