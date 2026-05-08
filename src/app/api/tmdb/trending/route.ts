import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "all";
  const timeWindow = searchParams.get("timeWindow") || "week";
  const page = searchParams.get("page") || "1";

  try {
    const data = await tmdbFetch(`/trending/${type}/${timeWindow}`, {
      page,
    });
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch trending content" },
      { status: 500 }
    );
  }
}
