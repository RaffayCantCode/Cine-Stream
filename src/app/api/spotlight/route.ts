export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { siteSpotlight } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCachedSpotlight, setCachedSpotlight } from "@/lib/server-cache";

export async function GET() {
  const cached = getCachedSpotlight();
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  try {
    const db = getDb();
    const spotlight = await db.query.siteSpotlight.findFirst({
      where: eq(siteSpotlight.id, "current"),
    });

    if (!spotlight || !spotlight.enabled || !spotlight.title) {
      const emptyPayload = { success: true, enabled: false, spotlight: null };
      setCachedSpotlight(emptyPayload);
      return NextResponse.json(emptyPayload, {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    const payload = {
      success: true,
      enabled: true,
      spotlight: {
        id: spotlight.id,
        title: spotlight.title,
        tagline: spotlight.tagline,
        description: spotlight.description,
        backdrop_path: spotlight.backdropPath,
        poster_path: spotlight.posterPath,
        target_url: spotlight.targetUrl,
        media_type: spotlight.mediaType,
        badge: spotlight.badge,
      },
    };

    setCachedSpotlight(payload);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("[Spotlight API] GET Error:", error);
    return NextResponse.json({ success: false, enabled: false, spotlight: null }, { status: 500 });
  }
}
