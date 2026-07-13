export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
import { FRANCHISES } from "@/lib/franchises";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Find the custom franchise
    const franchise = FRANCHISES.find(f => f.id === id);
    
    if (!franchise) {
      return NextResponse.json({ error: "Franchise not found" }, { status: 404 });
    }

    // Helper function to fetch item details
    const fetchItem = async (item: { id: number; media_type: string; tmdb_type?: string; anilist_id?: number; title?: string; release_date?: string; poster_path?: string }) => {
      try {
        const tmdbType = item.tmdb_type || (item.media_type === "movie" ? "movie" : "tv");
        const endpoint = `/${tmdbType}/${item.id}`;
        const data = await tmdbFetch(`${endpoint}?language=en-US`) as any;
        
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
          } catch (e) {
            // ignore anilist fetch error and fallback to tmdb
          }
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
        console.error(`Failed to fetch ${item.media_type} ${item.id}`, err);
        return null;
      }
    };

    let resolvedParts: any[] = [];
    let resolvedGroups: { name: string; parts: any[] }[] = [];

    async function batchFetch(items: any[]): Promise<any[]> {
      const results: any[] = [];
      for (let i = 0; i < items.length; i += 50) {
        const batch = items.slice(i, i + 50);
        const batchResults = await Promise.all(batch.map(fetchItem));
        results.push(...batchResults);
      }
      return results.filter(Boolean);
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

    // Format the response to match the TMDB Collection structure expected by the frontend
    const response = {
      id: franchise.id,
      name: franchise.name,
      overview: franchise.overview,
      backdrop_path: franchise.backdrop_path,
      poster_path: franchise.poster_path,
      parts: resolvedParts,
      groups: resolvedGroups.length > 0 ? resolvedGroups : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Collection ${await params.then(p => p.id)} error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}
