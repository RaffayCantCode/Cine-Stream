export const dynamic = "force-dynamic";
export const runtime = "edge";
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";
import { filterReleasedSafeContent, filterExcludeAnime } from "@/lib/utils";

// Map Movie Genre IDs <-> TV Genre IDs so cross-media discovery stays tightly aligned
const MOVIE_TO_TV_GENRES: Record<number, number[]> = {
  28: [10759], // Action -> Action & Adventure
  12: [10759], // Adventure -> Action & Adventure
  878: [10765], // Sci-Fi -> Sci-Fi & Fantasy
  14: [10765], // Fantasy -> Sci-Fi & Fantasy
  10752: [10768], // War -> War & Politics
  53: [9648, 80], // Thriller -> Mystery, Crime
  27: [9648, 10765], // Horror -> Mystery, Sci-Fi & Fantasy
};

const TV_TO_MOVIE_GENRES: Record<number, number[]> = {
  10759: [28, 12], // Action & Adventure -> Action, Adventure
  10765: [878, 14], // Sci-Fi & Fantasy -> Sci-Fi, Fantasy
  10768: [10752, 36], // War & Politics -> War, History
};

function mapGenresToOppositeMedia(genreIds: number[], fromType: "movie" | "tv"): number[] {
  const map = fromType === "movie" ? MOVIE_TO_TV_GENRES : TV_TO_MOVIE_GENRES;
  const out = new Set<number>();
  for (const id of genreIds) {
    if (map[id]) {
      for (const mapped of map[id]) out.add(mapped);
    } else {
      out.add(id);
    }
  }
  return Array.from(out);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawMediaId = searchParams.get("mediaId");
  const rawMediaType = searchParams.get("mediaType");
  const titleQuery = searchParams.get("title")?.trim() || "";
  const mixMedia = searchParams.get("mix") === "true" || searchParams.get("mix") === "1";

  if (!rawMediaId && !titleQuery) {
    return Response.json({ error: "Missing mediaId or title" }, { status: 400 });
  }

  try {
    let baseId = rawMediaId || "";
    let baseType: "movie" | "tv" = rawMediaType === "movie" ? "movie" : "tv";
    const isAnimeSeed = rawMediaType === "anime";

    // If the seed is an anime (which may use an AniList ID or slug) or non-numeric ID,
    // resolve the matching TMDB entry by title or verify the numeric ID first.
    if (isAnimeSeed || !/^\d+$/.test(baseId)) {
      if (titleQuery) {
        const searchData: any = await tmdbFetch(
          `/search/multi?query=${encodeURIComponent(titleQuery)}&include_adult=false`
        ).catch(() => null);
        const match = (searchData?.results || []).find(
          (r: any) => (r.media_type === "tv" || r.media_type === "movie") && r.poster_path
        );
        if (match) {
          baseId = String(match.id);
          baseType = match.media_type === "movie" ? "movie" : "tv";
        }
      }
    }

    if (!/^\d+$/.test(baseId)) {
      return Response.json({ results: [] }, { headers: cacheHeaders(3600) });
    }

    if (!mixMedia) {
      const data = await tmdbFetch(`/${baseType}/${baseId}/recommendations`);
      const results = filterExcludeAnime(
        filterReleasedSafeContent((data as any)?.results || []).map((i: any) => ({
          ...i,
          media_type: baseType,
        }))
      );
      return Response.json({ results }, { headers: cacheHeaders(86400) });
    }

    // Fetch seed details + recommendations + similar + keywords in a single TMDB call
    let seedDetails: any = await tmdbFetch(
      `/${baseType}/${baseId}?append_to_response=recommendations,similar,keywords`
    ).catch(() => null);

    // If an anime numeric ID was an AniList ID rather than TMDB ID and matched the wrong show or 404'd,
    // resolve via title search when titleQuery is provided.
    if (titleQuery && (!seedDetails || isAnimeSeed)) {
      const seedTitleLower = (seedDetails?.title || seedDetails?.name || "").toLowerCase();
      const queryLower = titleQuery.toLowerCase();
      const titleMismatch =
        !seedDetails ||
        (isAnimeSeed &&
          seedTitleLower &&
          !seedTitleLower.includes(queryLower.slice(0, Math.min(8, queryLower.length))) &&
          !queryLower.includes(seedTitleLower.slice(0, Math.min(8, seedTitleLower.length))));

      if (titleMismatch) {
        const searchData: any = await tmdbFetch(
          `/search/multi?query=${encodeURIComponent(titleQuery)}&include_adult=false`
        ).catch(() => null);
        const match = (searchData?.results || []).find(
          (r: any) => (r.media_type === "tv" || r.media_type === "movie") && r.poster_path
        );
        if (match && (String(match.id) !== baseId || match.media_type !== baseType)) {
          baseId = String(match.id);
          baseType = match.media_type === "movie" ? "movie" : "tv";
          seedDetails = await tmdbFetch(
            `/${baseType}/${baseId}?append_to_response=recommendations,similar,keywords`
          ).catch(() => seedDetails);
        }
      }
    }

    const seedGenres: number[] = Array.isArray(seedDetails?.genres)
      ? seedDetails.genres.map((g: any) => Number(g.id)).filter(Boolean)
      : [];
    const rawKeywords: { id: number; name: string }[] =
      seedDetails?.keywords?.keywords || seedDetails?.keywords?.results || [];
    const topKeywordIds = rawKeywords.slice(0, 4).map((k) => k.id);

    const oppositeType: "movie" | "tv" = baseType === "movie" ? "tv" : "movie";
    const oppositeGenres = mapGenresToOppositeMedia(seedGenres, baseType);
    const primaryOppositeGenres = oppositeGenres.slice(0, 2).join(",");
    const primarySameGenres = seedGenres.slice(0, 2).join(",");

    // Build cross-media discovery calls so we get both Movies and TV shows that share the exact vibe
    const crossPromises: Promise<any>[] = [];

    // 1. Opposite media with matching keywords + primary genre
    if (topKeywordIds.length > 0) {
      const kwQuery = topKeywordIds.join("|");
      crossPromises.push(
        tmdbFetch(
          `/discover/${oppositeType}?with_keywords=${kwQuery}${
             oppositeGenres[0] ? `&with_genres=${oppositeGenres[0]}` : ""
          }&sort_by=popularity.desc&vote_count.gte=50`
        ).catch(() => null)
      );
      // Same media with matching keywords for deep thematic similarity
      crossPromises.push(
        tmdbFetch(
          `/discover/${baseType}?with_keywords=${kwQuery}${
            seedGenres[0] ? `&with_genres=${seedGenres[0]}` : ""
          }&sort_by=popularity.desc&vote_count.gte=50`
        ).catch(() => null)
      );
    }

    // 2. Opposite media with matching core genres (top rated / high popularity)
    if (primaryOppositeGenres) {
      crossPromises.push(
        tmdbFetch(
          `/discover/${oppositeType}?with_genres=${primaryOppositeGenres}&sort_by=popularity.desc&vote_count.gte=150&vote_average.gte=6.8`
        ).catch(() => null)
      );
    }

    // 3. Also grab recommendations of the #1 opposite-media match if available via multi-search on seed title
    const crossResults = await Promise.all(crossPromises);

    const sameTypeRecs = ((seedDetails?.recommendations?.results || []) as any[]).map((item) => ({
      ...item,
      media_type: item.media_type || baseType,
      _sourceWeight: 45,
    }));

    const sameTypeSimilar = ((seedDetails?.similar?.results || []) as any[]).map((item) => ({
      ...item,
      media_type: item.media_type || baseType,
      _sourceWeight: 32,
    }));

    const discoveredItems: any[] = [];
    crossResults.forEach((res, idx) => {
      const list = (res?.results || []) as any[];
      const inferredType =
        idx === 0 ? oppositeType : idx === 1 ? baseType : oppositeType;
      const weight = idx <= 1 ? 38 : 26;
      for (const item of list) {
        discoveredItems.push({
          ...item,
          media_type: item.media_type || inferredType,
          _sourceWeight: weight,
        });
      }
    });

    const combinedRaw = [...sameTypeRecs, ...discoveredItems, ...sameTypeSimilar];
    const safeItems = filterReleasedSafeContent(combinedRaw);
    // Keep live-action and western animation, or if the seed was anime, still allow high-similarity movies/shows
    const filteredItems = isAnimeSeed ? safeItems : filterExcludeAnime(safeItems);

    const seen = new Set<string>([`${baseType}-${baseId}`]);
    if (rawMediaId) {
      seen.add(`movie-${rawMediaId}`);
      seen.add(`tv-${rawMediaId}`);
    }

    const scored: { item: any; score: number; mediaType: "movie" | "tv" }[] = [];

    for (const item of filteredItems) {
      const mType: "movie" | "tv" = item.media_type === "movie" ? "movie" : "tv";
      const key = `${mType}-${item.id}`;
      if (seen.has(key)) continue;
      if (!item.poster_path) continue;
      seen.add(key);

      const itemGenres: number[] = Array.isArray(item.genre_ids) ? item.genre_ids : [];
      const targetGenreSet = new Set(
        mType === baseType ? seedGenres : oppositeGenres
      );

      let sharedGenres = 0;
      for (const g of itemGenres) {
        if (targetGenreSet.has(g)) sharedGenres++;
      }

      // Require at least 1 shared genre when seed has genres, unless it came directly from TMDB's recommendations
      if (targetGenreSet.size > 0 && sharedGenres === 0 && (item._sourceWeight || 0) < 40) {
        continue;
      }

      const genreScore = sharedGenres * 18;
      const ratingScore = Math.min(10, Number(item.vote_average || 0)) * 2.5;
      const popScore = Math.min(15, Math.log10(Math.max(1, Number(item.popularity || 1))) * 5);
      const totalScore = (item._sourceWeight || 20) + genreScore + ratingScore + popScore;

      const { _sourceWeight, ...cleanItem } = item;
      scored.push({
        item: { ...cleanItem, media_type: mType },
        score: totalScore,
        mediaType: mType,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    // Interleave high-scoring Movies and TV shows so the row always presents a rich mix of both
    const movies = scored.filter((s) => s.mediaType === "movie").map((s) => s.item);
    const shows = scored.filter((s) => s.mediaType === "tv").map((s) => s.item);

    const mixed: any[] = [];
    let mIdx = 0;
    let tIdx = 0;
    while ((mIdx < movies.length || tIdx < shows.length) && mixed.length < 24) {
      if (baseType === "tv") {
        if (tIdx < shows.length) mixed.push(shows[tIdx++]);
        if (mIdx < movies.length && mixed.length < 24) mixed.push(movies[mIdx++]);
      } else {
        if (mIdx < movies.length) mixed.push(movies[mIdx++]);
        if (tIdx < shows.length && mixed.length < 24) mixed.push(shows[tIdx++]);
      }
    }

    return Response.json(
      {
        results: mixed,
        seed: {
          id: baseId,
          mediaType: baseType,
          title: seedDetails?.title || seedDetails?.name || titleQuery,
        },
      },
      { headers: cacheHeaders(3600) }
    );
  } catch (error) {
    console.error("[TMDB Recommendations API Error]:", error);
    return Response.json(
      { error: "Failed to fetch recommendations", results: [] },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
