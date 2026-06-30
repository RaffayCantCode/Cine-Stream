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

    // Fetch details for all items in parallel
    const itemPromises = franchise.items.map(async (item) => {
      try {
        const endpoint = item.media_type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`;
        const data = await tmdbFetch(`${endpoint}?language=en-US`) as any;
        
        // Return the item formatted for our frontend
        return {
          id: data.id,
          media_type: item.media_type,
          title: data.title || data.name,
          name: data.title || data.name,
          overview: data.overview,
          poster_path: data.poster_path,
          backdrop_path: data.backdrop_path,
          vote_average: data.vote_average,
          release_date: data.release_date || data.first_air_date,
        };
      } catch (err) {
        console.error(`Failed to fetch ${item.media_type} ${item.id}`, err);
        return null;
      }
    });

    const results = await Promise.all(itemPromises);
    const validItems = results.filter(Boolean);

    // Format the response to match the TMDB Collection structure expected by the frontend
    const response = {
      id: franchise.id,
      name: franchise.name,
      overview: franchise.overview,
      backdrop_path: franchise.backdrop_path,
      poster_path: franchise.poster_path,
      parts: validItems, // Preserve the order from the definition
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
