export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest } from "next/server";

const OS_API_BASE = "https://api.opensubtitles.com/api/v1";

function getApiKey(): string {
  return process.env.OPENSUBTITLES_API_KEY || "";
}

function parseTimestamp(timeStr: string): number {
  const cleaned = timeStr.replace(",", ".").trim();
  const parts = cleaned.split(":");
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return 0;
}

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseSrtOrVtt(rawText: string): { cues: SubtitleCue[]; vtt: string } {
  const cues: SubtitleCue[] = [];
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let timeLine = "";
    const textLines: string[] = [];

    for (const line of lines) {
      if (line.includes("-->")) {
        timeLine = line;
      } else if (timeLine && line.trim().length > 0) {
        textLines.push(line.trim());
      }
    }

    if (timeLine) {
      const parts = timeLine.split("-->").map((s) => s.trim());
      if (parts.length >= 2) {
        const start = parseTimestamp(parts[0]);
        const end = parseTimestamp(parts[1]);
        const cleanText = textLines.join("\n").replace(/<[^>]+>/g, "").trim();
        if (end > start && cleanText) {
          cues.push({ start, end, text: cleanText });
        }
      }
    }
  }

  // Convert to clean standard WebVTT format
  let vtt = "WEBVTT\n\n";
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    const formatSec = (sec: number) => {
      const h = Math.floor(sec / 3600).toString().padStart(2, "0");
      const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
      const s = (sec % 60).toFixed(3).padStart(6, "0");
      return `${h}:${m}:${s}`;
    };
    vtt += `${i + 1}\n${formatSec(c.start)} --> ${formatSec(c.end)}\n${c.text}\n\n`;
  }

  return { cues, vtt };
}

// Requests a direct download URL for a subtitle file from OpenSubtitles,
// fetches the content, and returns parsed cues + WebVTT text for reliable cross-origin playback.
export async function POST(request: NextRequest) {
  const { fileId } = await request.json().catch(() => ({ fileId: null }));

  if (!fileId) {
    return Response.json({ error: "Missing fileId" }, { status: 400 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json({
      error: "No OpenSubtitles API key configured",
      link: null,
      cues: [],
    }, { status: 200 });
  }

  try {
    const res = await fetch(`${OS_API_BASE}/download`, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "User-Agent": "CineStream v1.0",
      },
      body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[OpenSubtitles Download] Failed:", res.status, errText);
      return Response.json({ link: null, error: `Download request failed: ${res.status}` }, { status: 200 });
    }

    const data = await res.json();
    const downloadLink = data?.link || null;

    let cues: SubtitleCue[] = [];
    let vttText = "";

    if (downloadLink) {
      try {
        const subContentRes = await fetch(downloadLink, {
          signal: AbortSignal.timeout(6000),
        });
        if (subContentRes.ok) {
          const rawSub = await subContentRes.text();
          const parsed = parseSrtOrVtt(rawSub);
          cues = parsed.cues;
          vttText = parsed.vtt;
        }
      } catch (fetchSubErr) {
        console.warn("[OpenSubtitles Download] Subtitle content fetch failed:", fetchSubErr);
      }
    }

    return Response.json({
      link: downloadLink,
      fileName: data?.file_name || null,
      remainingDownloads: data?.remaining || null,
      cues,
      vtt: vttText,
    });
  } catch (err) {
    console.error("[OpenSubtitles Download] Error:", err);
    return Response.json({ link: null, error: "Failed to get download link", cues: [] }, { status: 200 });
  }
}
