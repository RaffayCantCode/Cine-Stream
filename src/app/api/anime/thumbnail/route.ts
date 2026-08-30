export const runtime = 'edge';
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

const thumbnailCache = new Map<string, { thumbnail: string | null; expiresAt: number }>();
const THUMBNAIL_CACHE_MAX = 1000;
const THUMBNAIL_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const THUMBNAIL_HEADERS = {
  "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
  "CDN-Cache-Control": "public, max-age=604800",
  "Cloudflare-CDN-Cache-Control": "public, max-age=604800",
} as const;

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  const url = rawUrl ? isValidThumbnailUrl(rawUrl) : null;
  if (!url) {
    return Response.json({ success: false, thumbnail: null }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const now = Date.now();
  const cached = thumbnailCache.get(url);
  if (cached && cached.expiresAt > now) {
    return Response.json({ success: !!cached.thumbnail, thumbnail: cached.thumbnail }, { headers: THUMBNAIL_HEADERS });
  }

  try {
    const thumbnail = await fetchEpisodeThumbnail(url);

    if (thumbnailCache.size >= THUMBNAIL_CACHE_MAX) {
      const oldestKey = thumbnailCache.keys().next().value;
      if (oldestKey) thumbnailCache.delete(oldestKey);
    }
    thumbnailCache.set(url, { thumbnail, expiresAt: now + THUMBNAIL_CACHE_TTL });

    return Response.json({ success: !!thumbnail, thumbnail }, { headers: THUMBNAIL_HEADERS });
  } catch {
    return Response.json({ success: false, thumbnail: null }, { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
