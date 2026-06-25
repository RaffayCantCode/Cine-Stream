export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get("page") || "1";

  try {
    const data = await tmdbFetch("/tv/top_rated", { page });
    return Response.json(data, { headers: cacheHeaders(1800) });
  } catch (error) {
    return Response.json({ error: "Failed to fetch top-rated TV shows" }, { status: 500 });
  }
}
