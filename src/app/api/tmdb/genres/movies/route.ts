import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export async function GET() {
  try {
    const data = await tmdbFetch("/genre/movie/list");
    return Response.json(data, { headers: cacheHeaders(86400) });
  } catch (error) {
    return Response.json({ error: "Failed to fetch genres" }, { status: 500 });
  }
}
