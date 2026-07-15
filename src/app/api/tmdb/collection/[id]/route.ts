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

    const fallbackItem = (item: { id: number; media_type: string; tmdb_type?: string; anilist_id?: number; title?: string; release_date?: string; poster_path?: string }) => ({
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

    const fetchItem = async (item: { id: number; media_type: string; tmdb_type?: string; anilist_id?: number; title?: string; release_date?: string; poster_path?: string }) => {
      try {
        const tmdbType = item.tmdb_type || (item.media_type === "movie" ? "movie" : "tv");
        const data = await tmdbFetch(`/${tmdbType}/${item.id}?language=en-US`) as any;

        let poster_path = item.poster_path || data.poster_path;

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
          title: item.title || data.title || data.name,
          name: item.title || data.title || data.name,
          overview: data.overview,
          poster_path: poster_path,
          backdrop_path: data.backdrop_path,
          vote_average: data.vote_average,
          release_date: item.release_date || data.release_date || data.first_air_date,
        };
      } catch (err) {
        return fallbackItem(item);
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
