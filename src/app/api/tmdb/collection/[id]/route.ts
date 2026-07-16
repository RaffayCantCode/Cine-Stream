export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
import { FRANCHISES } from "@/lib/franchises";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const franchise = FRANCHISES.find(f => f.id === id);

    if (!franchise) {
      return NextResponse.json({ error: "Franchise not found" }, { status: 404, headers: noStoreHeaders });
    }

    type FranchiseRouteItem = {
      id: number;
      media_type: string;
      tmdb_type?: string;
      anilist_id?: number;
      title?: string;
      release_date?: string;
      poster_path?: string;
    };

    const fallbackItem = (item: FranchiseRouteItem) => ({
      id: item.anilist_id || item.id,
      media_type: item.media_type,
      title: item.title || `${item.media_type === "tv" ? "TV" : item.media_type === "anime" ? "Anime" : "Movie"} ${item.id}`,
      name: item.title || `${item.media_type === "tv" ? "TV" : item.media_type === "anime" ? "Anime" : "Movie"} ${item.id}`,
      overview: "",
      poster_path: item.poster_path || null,
      backdrop_path: null,
      vote_average: null,
      release_date: item.release_date || "",
    });

    const fetchSearchFallback = async (item: FranchiseRouteItem, tmdbType: string) => {
      if (!item.title) return null;

      try {
        const searchPath = tmdbType === "tv" ? "/search/tv" : "/search/movie";
        const searchData = await tmdbFetch(
          searchPath,
          {
            query: item.title,
            include_adult: "false",
            page: "1",
          },
          { noCache: true }
        ) as { results?: any[] };

        const normalizedTitle = item.title.toLowerCase();
        const results = searchData.results || [];
        return (
          results.find(result => (result.title || result.name || "").toLowerCase() === normalizedTitle && result.poster_path) ||
          results.find(result => result.poster_path) ||
          null
        );
      } catch {
        return null;
      }
    };

    const fetchItem = async (item: FranchiseRouteItem) => {
      try {
        const tmdbType = item.tmdb_type || (item.media_type === "movie" ? "movie" : "tv");
        const data = await tmdbFetch(
          `/${tmdbType}/${item.id}`,
          { language: "en-US" },
          { noCache: true }
        ) as any;
        const searchFallback = !data.poster_path && !item.poster_path
          ? await fetchSearchFallback(item, tmdbType)
          : null;

        let poster_path = item.poster_path || data.poster_path || searchFallback?.poster_path || null;
        const backdrop_path = data.backdrop_path || searchFallback?.backdrop_path || null;

        if (!item.poster_path && item.media_type === "anime" && item.anilist_id) {
          try {
            const query = `query ($id: Int) { Media(id: $id, type: ANIME) { coverImage { extraLarge large } } }`;
            const alRes = await fetch("https://graphql.anilist.co", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query, variables: { id: item.anilist_id } }),
              next: { revalidate: 86400 }
            });
            if (alRes.ok) {
              const alJson = await alRes.json();
              const cover = alJson.data?.Media?.coverImage;
              if (cover?.extraLarge || cover?.large) {
                poster_path = cover.extraLarge || cover.large;
              }
            }
          } catch (e) {}
        }

        return {
          id: item.anilist_id || data.id,
          media_type: item.media_type,
          title: item.title || data.title || data.name || searchFallback?.title || searchFallback?.name,
          name: item.title || data.title || data.name || searchFallback?.title || searchFallback?.name,
          overview: data.overview || searchFallback?.overview || "",
          poster_path: poster_path,
          backdrop_path,
          vote_average: data.vote_average || searchFallback?.vote_average || null,
          release_date: item.release_date || data.release_date || data.first_air_date || searchFallback?.release_date || searchFallback?.first_air_date || "",
        };
      } catch (err) {
        const tmdbType = item.tmdb_type || (item.media_type === "movie" ? "movie" : "tv");
        const searchFallback = await fetchSearchFallback(item, tmdbType);
        if (!searchFallback) return fallbackItem(item);

        return {
          ...fallbackItem(item),
          id: item.anilist_id || searchFallback.id || item.id,
          title: item.title || searchFallback.title || searchFallback.name,
          name: item.title || searchFallback.title || searchFallback.name,
          overview: searchFallback.overview || "",
          poster_path: item.poster_path || searchFallback.poster_path || null,
          backdrop_path: searchFallback.backdrop_path || null,
          vote_average: searchFallback.vote_average || null,
          release_date: item.release_date || searchFallback.release_date || searchFallback.first_air_date || "",
        };
      }
    };

    let resolvedParts: any[] = [];
    let resolvedGroups: { name: string; parts: any[] }[] = [];

    async function batchFetch(items: any[]): Promise<any[]> {
      const results: any[] = [];
      for (let i = 0; i < items.length; i += 15) {
        const batch = items.slice(i, i + 15);
        const batchResults = await Promise.allSettled(batch.map(fetchItem));
        results.push(...batchResults.map((r, idx) => r.status === "fulfilled" ? r.value : fallbackItem(batch[idx])));
      }
      return results;
    }

    if (franchise.items) {
      resolvedParts = await batchFetch(franchise.items);
    }

    if (franchise.groups) {
      for (const group of franchise.groups) {
        const parts = await batchFetch(group.items);
        resolvedGroups.push({ name: group.name, parts });
      }
    }

    const response = {
      id: franchise.id,
      name: franchise.name,
      overview: franchise.overview,
      backdrop_path: franchise.backdrop_path,
      poster_path: franchise.poster_path,
      parts: resolvedParts,
      groups: resolvedGroups.length > 0 ? resolvedGroups : undefined,
    };

    return NextResponse.json(response, {
      headers: {
        ...noStoreHeaders,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
