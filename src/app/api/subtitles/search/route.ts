export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest } from "next/server";

const OS_API_BASE = "https://api.opensubtitles.com/api/v1";

// Uses OPENSUBTITLES_API_KEY env var — get a free one at:
// https://www.opensubtitles.com/en/consumers (free plan = 5 req/s, 100 downloads/day)
function getApiKey(): string {
  return process.env.OPENSUBTITLES_API_KEY || "";
}

export interface OpenSubtitlesTrack {
  id: string;
  lang: string;
  langName: string;
  label: string;
  downloadUrl: string | null;
  fileId: number;
  uploadedAt: string;
  downloadCount: number;
  isHearingImpaired: boolean;
  isTrusted: boolean;
  encoding: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const imdbId = searchParams.get("imdbId");
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");
  const languages = searchParams.get("langs") || "en";
  const query = searchParams.get("q");

  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json({
      error: "No OpenSubtitles API key configured. Add OPENSUBTITLES_API_KEY to .env.local",
      subtitles: [],
    }, { status: 200 });
  }

  try {
    const params = new URLSearchParams();
    params.set("languages", languages);
    params.set("order_by", "download_count");
    params.set("order_direction", "desc");

    if (tmdbId) {
      params.set("tmdb_id", tmdbId);
    } else if (imdbId) {
      params.set("imdb_id", imdbId.replace(/^tt/, ""));
    }

    if (season) params.set("season_number", season);
    if (episode) params.set("episode_number", episode);
    if (query) params.set("query", query);

    const res = await fetch(`${OS_API_BASE}/subtitles?${params.toString()}`, {
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "CineStream v1.0",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[OpenSubtitles] Search failed:", res.status, errorText);
      return Response.json({ subtitles: [], error: `Search failed: ${res.status}` }, { status: 200 });
    }

    const data = await res.json();
    const items = data?.data || [];

    const tracks: OpenSubtitlesTrack[] = items.slice(0, 20).map((item: any) => {
      const attrs = item.attributes || {};
      const files = attrs.files || [];
      return {
        id: item.id,
        lang: attrs.language || "und",
        langName: attrs.language_name || attrs.language || "Unknown",
        label: `${attrs.language_name || attrs.language} — ${attrs.release || attrs.feature_details?.title || ""}`.trim(),
        downloadUrl: null, // Populated client-side on demand via /api/subtitles/download
        fileId: files[0]?.file_id || 0,
        uploadedAt: attrs.upload_date || "",
        downloadCount: attrs.download_count || 0,
        isHearingImpaired: attrs.hearing_impaired || false,
        isTrusted: attrs.from_trusted || false,
        encoding: attrs.encoding || "UTF-8",
      };
    });

    return Response.json({ subtitles: tracks }, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("[OpenSubtitles] Error:", err);
    return Response.json({ subtitles: [], error: "Failed to fetch subtitles" }, { status: 200 });
  }
}
