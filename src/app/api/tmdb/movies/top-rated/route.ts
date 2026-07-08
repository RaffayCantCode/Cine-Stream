export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get("page") || "1";

  try {
    const data = await tmdbFetch("/movie/top_rated", { page });
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to fetch top-rated movies" }, { status: 500 });
  }
}
