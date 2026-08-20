export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { fetchAnimeApi } from "@/lib/anime-fetch";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");

  if (!query) {
    return Response.json(
      { error: "Missing query parameter", success: false },
      { status: 400, headers: noStoreHeaders }
    );
  }

  try {
    const data = await fetchAnimeApi(
      `/api/search?keyword=${encodeURIComponent(query)}`
    );

    const rawAnimes = data?.data;
    const animes = Array.isArray(rawAnimes) ? rawAnimes : (rawAnimes?.animes || []);

    // Filter hidden items
    const { getHiddenMediaSet, isMediaItemHidden } = await import("@/lib/media-overrides");
    const hiddenSet = await getHiddenMediaSet();
    const visibleAnimes = animes.filter((a: any) => !isMediaItemHidden({ id: a.id || a.animeId, mediaType: "anime" }, hiddenSet));

    return Response.json({
      success: true,
      data: { animes: visibleAnimes },
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[Anime Search Error]:", error);
    return Response.json({ error: "Failed to search anime", success: false }, { status: 500, headers: noStoreHeaders });
  }
}
