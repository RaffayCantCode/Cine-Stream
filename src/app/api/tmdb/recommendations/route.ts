export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
import { filterReleasedSafeContent } from "@/lib/utils";

export const revalidate = 0; // Don't cache personalized recommendations

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mediaId = searchParams.get("mediaId");
  const mediaType = searchParams.get("mediaType");

  if (!mediaId || !mediaType) {
    return Response.json({ error: "Missing mediaId or mediaType" }, { status: 400 });
  }

  try {
    const data = await tmdbFetch(`/${mediaType}/${mediaId}/recommendations`);
    const results = filterReleasedSafeContent((data as any)?.results || []).map((i: any) => ({
      ...i,
      media_type: mediaType,
    }));
    return Response.json({ results });
  } catch (error) {
    console.error("[TMDB Recommendations API Error]:", error);
    return Response.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
