export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest } from "next/server";

export interface StreamResolutionResult {
  success: boolean;
  streamUrl?: string | null;
  quality?: string;
  subtitles?: {
    id?: number;
    label: string;
    lang: string;
    url: string;
  }[];
  audioTracks?: {
    id: number;
    label: string;
    lang: string;
  }[];
  provider?: string;
  fallbackUrl: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "movie";
  const id = searchParams.get("id");
  const season = searchParams.get("season") || "1";
  const episode = searchParams.get("episode") || "1";

  if (!id) {
    return Response.json({ error: "Missing media ID" }, { status: 400 });
  }

  const defaultEmbed =
    type === "movie"
      ? `https://vidsrc.me/embed/movie?tmdb=${id}`
      : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;

  // ── Strategy 1: VidLink Stream Resolver ──
  try {
    const vidlinkApi =
      type === "movie"
        ? `https://vidlink.pro/api/b/movie/${id}`
        : `https://vidlink.pro/api/b/tv/${id}/${season}/${episode}`;

    const res = await fetch(vidlinkApi, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://vidlink.pro/",
      },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      const streamUrl = data?.stream?.playlist || data?.stream?.qualities?.auto?.url || data?.sources?.[0]?.url;
      if (streamUrl && (streamUrl.includes(".m3u8") || streamUrl.includes(".mp4"))) {
        const subtitles = Array.isArray(data?.stream?.tracks || data?.tracks)
          ? (data.stream?.tracks || data.tracks).map((t: any, i: number) => ({
              id: i + 1,
              label: t.label || t.name || t.language || "Subtitle",
              lang: t.lang || t.language || "en",
              url: t.file || t.url,
            }))
          : [];

        return Response.json({
          success: true,
          streamUrl,
          quality: "1080p",
          subtitles,
          provider: "vidlink",
          fallbackUrl: defaultEmbed,
        });
      }
    }
  } catch {}

  // ── Strategy 2: EmbedMaster Stream Resolver ──
  try {
    const embedMasterApi =
      type === "movie"
        ? `https://embedmaster.link/api/stream?tmdb=${id}`
        : `https://embedmaster.link/api/stream?tmdb=${id}&season=${season}&episode=${episode}`;

    const res = await fetch(embedMasterApi, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://embedmaster.link/",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      const streamUrl = data?.playlist || data?.url || data?.stream;
      if (streamUrl && (streamUrl.includes(".m3u8") || streamUrl.includes(".mp4"))) {
        return Response.json({
          success: true,
          streamUrl,
          quality: data?.quality || "1080p",
          subtitles: data?.subtitles || [],
          provider: "embedmaster",
          fallbackUrl: defaultEmbed,
        });
      }
    }
  } catch {}

  // ── Strategy 3: VixSrc Stream Resolver ──
  try {
    const vixApi =
      type === "movie"
        ? `https://vixsrc.to/api/stream/movie/${id}`
        : `https://vixsrc.to/api/stream/tv/${id}/${season}/${episode}`;

    const res = await fetch(vixApi, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://vixsrc.to/",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.streamUrl && (data.streamUrl.includes(".m3u8") || data.streamUrl.includes(".mp4"))) {
        return Response.json({
          success: true,
          streamUrl: data.streamUrl,
          quality: "1080p",
          subtitles: data.subtitles || [],
          provider: "vixsrc",
          fallbackUrl: defaultEmbed,
        });
      }
    }
  } catch {}

  // ── Fallback: Provide clean iframe embed URL ──
  return Response.json({
    success: false,
    streamUrl: null,
    fallbackUrl: defaultEmbed,
  });
}
