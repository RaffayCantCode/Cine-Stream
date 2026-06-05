import { NextRequest } from "next/server";
import { fetchEpisodeThumbnail } from "@/lib/anime-fetch";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return Response.json({ success: false, thumbnail: null });
  }
  try {
    const thumbnail = await fetchEpisodeThumbnail(url);
    return Response.json({ success: !!thumbnail, thumbnail });
  } catch {
    return Response.json({ success: false, thumbnail: null });
  }
}
