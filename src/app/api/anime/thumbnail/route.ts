export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { fetchEpisodeThumbnail } from "@/lib/anime-fetch";

const ALLOWED_THUMBNAIL_DOMAINS = ["myanimelist.net"];

function isValidThumbnailUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!ALLOWED_THUMBNAIL_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith("." + d))) return null;
  return parsed.href;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  const url = rawUrl ? isValidThumbnailUrl(rawUrl) : null;
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
