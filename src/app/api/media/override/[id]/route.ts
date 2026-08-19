export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getMediaOverride, normalizeOverrideId } from "@/lib/media-overrides";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type") || "";

    let mediaType = typeParam;
    let mediaId = id;

    if (id.includes("-")) {
      const parts = id.split("-");
      if (["movie", "tv", "anime"].includes(parts[0].toLowerCase())) {
        mediaType = parts[0];
        mediaId = parts.slice(1).join("-");
      }
    }

    if (!mediaType) {
      mediaType = "movie";
    }

    const override = await getMediaOverride(mediaType, mediaId);

    return NextResponse.json(
      {
        success: true,
        override,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[Public Media Override API] Error:", error);
    return NextResponse.json({ success: true, override: null }, { status: 200 });
  }
}
