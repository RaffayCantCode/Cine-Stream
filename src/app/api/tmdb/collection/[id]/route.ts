export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
import { FRANCHISES } from "@/lib/franchises";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const franchise = FRANCHISES.find(f => f.id === id);

    if (!franchise) {
      return Response.json({ error: "Franchise not found" }, { status: 404 });
    }

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
        return null;
      }
    };

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const meta = {
            id: franchise.id,
            name: franchise.name,
            overview: franchise.overview,
            backdrop_path: franchise.backdrop_path,
            poster_path: franchise.poster_path,
            parts: [],
            groups: [] as { name: string; parts: any[] }[],
          };

          controller.enqueue(encoder.encode(JSON.stringify({ type: "meta", data: meta }) + "\n"));

          if (franchise.items) {
            for (let i = 0; i < franchise.items.length; i += 25) {
              const batch = franchise.items.slice(i, i + 25);
              const batchResults = await Promise.allSettled(batch.map(fetchItem));
              const parts = batchResults.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
              controller.enqueue(encoder.encode(JSON.stringify({ type: "parts", data: parts }) + "\n"));
            }
          }

          if (franchise.groups) {
            for (const group of franchise.groups) {
              const groupParts: any[] = [];
              for (let i = 0; i < group.items.length; i += 25) {
                const batch = group.items.slice(i, i + 25);
                const batchResults = await Promise.allSettled(batch.map(fetchItem));
                groupParts.push(...batchResults.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean));
              }
              controller.enqueue(encoder.encode(JSON.stringify({ type: "group", data: { name: group.name, parts: groupParts } }) + "\n"));
            }
          }

          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", data: "Failed to fetch collection" }) + "\n"));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}
