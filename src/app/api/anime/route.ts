import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") || "home";

  try {
    let data: any;

    if (category === "home" || category === "spotlight") {
      // Try home endpoint first, fallback to search
      try {
        data = await fetchAnimeApi("/home", { next: { revalidate: 300 } });
      } catch {
        // Fallback to search
        data = await fetchAnimeApi("/api/search?keyword=trending", { next: { revalidate: 300 } });
        // Transform to unified structure
        const animes = data.data || [];
        data = {
          success: true,
          data: {
            spotlightAnimes: animes.slice(0, 6),
            latestEpisodeAnimes: animes.slice(6, 12),
            newReleases: animes.slice(12, 18),
          },
        };
      }
      return Response.json(data);
    } else if (category === "new-releases" || category === "latest") {
      data = await fetchAnimeApi("/api/search?keyword=2024", { next: { revalidate: 300 } });
      const animes = data.data || [];
      return Response.json({
        success: true,
        data: {
          spotlightAnimes: animes.slice(0, 6),
          latestEpisodeAnimes: animes.slice(6, 12),
          newReleases: animes.slice(12, 18),
        },
      });
    } else if (category === "popular") {
      data = await fetchAnimeApi("/api/search?keyword=popular", { next: { revalidate: 300 } });
      const animes = data.data || [];
      return Response.json({
        success: true,
        data: {
          spotlightAnimes: animes.slice(0, 6),
          latestEpisodeAnimes: animes.slice(6, 12),
          newReleases: animes.slice(12, 18),
        },
      });
    } else {
      // Default: fetch all anime
      data = await fetchAnimeApi("/api/search?keyword=a", { next: { revalidate: 300 } });
      const animes = data.data || [];
      return Response.json({
        success: true,
        data: {
          spotlightAnimes: animes.slice(0, 6),
          latestEpisodeAnimes: animes.slice(6, 12),
          newReleases: animes.slice(12, 18),
        },
      });
    }
  } catch (error) {
    console.error("[Anime API Route Error]:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to fetch anime content";
    return Response.json({ error: message, success: false }, { status: 500 });
  }
}
