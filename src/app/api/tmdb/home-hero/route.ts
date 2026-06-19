import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

async function fetchPage(endpoint: string, page: number) {
  const data = await tmdbFetch(endpoint, { page: String(page) }) as { results?: unknown[] };
  return data?.results ?? [];
}

export async function GET(_request: NextRequest) {
  try {
    const [trending, popular] = await Promise.all([
      fetchPage("/trending/all/week", 1),
      fetchPage("/movie/popular", 1),
    ]);

    return Response.json({
      trending: { results: trending },
      popular: { results: popular },
    });
  } catch (error) {
    console.error("[TMDB Home Hero API Error]:", error);
    return Response.json({ error: "Failed to fetch hero media" }, { status: 500 });
  }
}
