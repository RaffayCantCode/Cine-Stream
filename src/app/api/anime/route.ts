import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") || "home";

  try {
    let endpoint: string;

    if (category === "home") {
      endpoint = "/home";
    } else if (category === "new-releases") {
      endpoint = "/category/new-release?page=1";
    } else if (category === "popular") {
      endpoint = "/category/most-viewed?page=1";
    } else if (category === "latest") {
      endpoint = "/category/latest-updated?page=1";
    } else {
      endpoint = "/home";
    }

    const data = await fetchAnimeApi(endpoint, { next: { revalidate: 300 } });
    return Response.json(data);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to fetch anime content";
    return Response.json({ error: message }, { status: 500 });
  }
}
