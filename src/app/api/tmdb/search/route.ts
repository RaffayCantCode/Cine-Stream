export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const type = searchParams.get("type") || "multi";
  const page = searchParams.get("page") || "1";

  if (!query) {
    return Response.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const data = await tmdbFetch(`/search/${type}`, { query, page, include_adult: "true" });
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to search" }, { status: 500 });
  }
}
