export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { browseAnime } from "@/lib/anime/anilist";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (!query) {
    return Response.json(
      { error: "Missing query parameter", success: false },
      { status: 400, headers: noStoreHeaders }
    );
  }

  try {
    const result = await browseAnime("search", 1, "", query);
    return Response.json(
      { success: true, data: { animes: result.items } },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error("[Anime Search Error]:", error);
    return Response.json(
      { error: "Failed to search anime", success: false },
      { status: 500, headers: noStoreHeaders }
    );
  }
}