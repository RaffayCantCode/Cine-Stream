export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { fetchJson, isTmdbAnime } from "@/lib/utils";

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

    const aniResults: any[] = [];
    const tmdbResults: any[] = [];

    // 1. Search AniList (Anime)
    if (mediaType === "all" || mediaType === "anime") {
      let animeFound = false;
      try {
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

        if (aniData?.data?.Page?.media && aniData.data.Page.media.length > 0) {
          animeFound = true;
          for (const item of aniData.data.Page.media) {
            const title = item.title?.english || item.title?.romaji || "Anime";
            const poster = item.coverImage?.extraLarge || item.coverImage?.large || "";
            aniResults.push({
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
              targetUrl: `/anime/${item.id}`,
              target_url: `/anime/${item.id}`,
            });
          }
        }
      } catch {}

      // Fallback to Kitsu ONLY if explicitly searching the anime catalog and AniList returned no items
      if (!animeFound && mediaType === "anime") {
        try {
          const kitsuRes = await fetch(
            `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=12`,
            { headers: { "Accept": "application/vnd.api+json", "User-Agent": "CineStream/1.0" }, signal: AbortSignal.timeout(4000) }
          ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

          if (kitsuRes?.data && Array.isArray(kitsuRes.data) && kitsuRes.data.length > 0) {
            for (const item of kitsuRes.data) {
              const attr = item.attributes || {};
              const title = attr.titles?.en || attr.canonicalTitle || attr.titles?.en_jp || "Anime";
              const poster = attr.posterImage?.large || attr.posterImage?.original || "";
              aniResults.push({
                id: `kitsu-${item.id}`,
                anilistId: `kitsu-${item.id}`,
                media_type: "anime",
                title,
                name: title,
                poster_path: poster,
                backdrop_path: attr.coverImage?.large || poster,
                release_date: attr.startDate || (attr.startDate ? `${new Date(attr.startDate).getFullYear()}-01-01` : ""),
                vote_average: attr.averageRating ? Number((parseFloat(attr.averageRating) / 10).toFixed(1)) : 8.0,
                overview: attr.synopsis?.replace(/<[^>]*>?/gm, "") || "",
                isTmdbAnime: false,
                targetUrl: `/anime/kitsu-${item.id}`,
                target_url: `/anime/kitsu-${item.id}`,
              });
            }
          }
        } catch {}
      }
    }

    // 2. Search TMDB (Movies & TV)
    if (mediaType === "all" || mediaType === "movie" || mediaType === "tv") {
      let tmdbSearchUrl = `${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
      if (mediaType === "movie") {
        tmdbSearchUrl = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
      } else if (mediaType === "tv") {
        tmdbSearchUrl = `${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
      }

      const tmdbData = await fetch(tmdbSearchUrl, { headers: tmdbHeaders, signal: AbortSignal.timeout(4000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (tmdbData?.results) {
        for (const item of tmdbData.results) {
          const itemType = item.media_type || (mediaType === "movie" ? "movie" : mediaType === "tv" ? "tv" : (item.first_air_date ? "tv" : "movie"));
          if (itemType !== "movie" && itemType !== "tv") continue;
          if (!item.poster_path && !item.backdrop_path) continue;

          // Check if TMDB anime (Animation genre + Japanese language or Japanese origin country)
          const isAnime = isTmdbAnime(item) || (item.genre_ids?.includes(16) && (item.original_language === "ja" || (Array.isArray(item.origin_country) && item.origin_country.includes("JP"))));

          // If this is an anime, DO NOT return it as a regular movie/tv show!
          // CineStream handles all anime through the dedicated anime section.
          if (isAnime) {
            // When searching "all", if not already added by AniList, add it strictly routed to /anime/
            if (mediaType === "all") {
              tmdbResults.push({
                id: `tmdb-${item.id}`,
                anilistId: `tmdb-${item.id}`,
                media_type: "anime",
                title: item.title || item.name || "",
                name: item.name || item.title || "",
                poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "",
                backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : "",
                release_date: item.release_date || item.first_air_date || "",
                vote_average: item.vote_average ? Number(item.vote_average.toFixed(1)) : 0,
                overview: item.overview || "",
                isTmdbAnime: true,
                targetUrl: `/anime/tmdb-${item.id}`,
                target_url: `/anime/tmdb-${item.id}`,
              });
            }
            continue;
          }

          tmdbResults.push({
            id: item.id,
            media_type: itemType,
            title: item.title || item.name || "",
            name: item.name || item.title || "",
            poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "",
            backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : "",
            release_date: item.release_date || item.first_air_date || "",
            vote_average: item.vote_average ? Number(item.vote_average.toFixed(1)) : 0,
            overview: item.overview || "",
            isTmdbAnime: false,
            targetUrl: `/${itemType}/${item.id}`,
            target_url: `/${itemType}/${item.id}`,
          });
        }
      }
    }

    // Merge results smartly:
    // If the top AniList anime title matches the user query closely, place anime first.
    // Otherwise, place TMDB results first.
    const cleanQ = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const animeHasExactMatch = aniResults.some((a) => {
      const aTitle = (a.title || a.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return aTitle === cleanQ || aTitle.startsWith(cleanQ) || cleanQ.startsWith(aTitle);
    });

    if (animeHasExactMatch || mediaType === "anime") {
      results.push(...aniResults, ...tmdbResults);
    } else {
      results.push(...tmdbResults, ...aniResults);
    }

    // Deduplicate raw search results:
    // If an anime title was already returned from AniList/Kitsu, don't duplicate it with tmdb-
    const uniqueList: any[] = [];
    const seenKeys = new Set<string>();
    for (const item of results) {
      const normTitle = (item.title || item.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const titleKey = `${item.media_type}_${normTitle}`;
      const idKey = `${item.media_type}_${item.id}`;
      if (!seenKeys.has(idKey) && !seenKeys.has(titleKey)) {
        seenKeys.add(idKey);
        seenKeys.add(titleKey);
        uniqueList.push(item);
      }
    }

    const { enrichMediaListWithOverrides } = await import("@/lib/media-overrides");
    const processedResults = await enrichMediaListWithOverrides(uniqueList);

    return NextResponse.json({ results: processedResults.slice(0, 24) }, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Media Search API] Error:", error);
    return NextResponse.json({ results: [] });
  }
}
