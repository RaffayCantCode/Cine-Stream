import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");

  if (!query) {
    return Response.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    const data = await fetchAnimeApi(`/search?q=${encodeURIComponent(query)}&page=1`, {
      next: { revalidate: 300 },
    });
    return Response.json(data);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to search anime";
    return Response.json({ error: message }, { status: 500 });
  }
}
