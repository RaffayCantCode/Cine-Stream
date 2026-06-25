export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get("page") || "1";

  try {
    const data = await tmdbFetch("/tv/airing_today", { page });
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to fetch airing today" }, { status: 500 });
  }
}