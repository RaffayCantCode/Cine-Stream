export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { siteSpotlight } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const spotlight = await db.query.siteSpotlight.findFirst({
      where: eq(siteSpotlight.id, "current"),
    });

    if (!spotlight || !spotlight.enabled || !spotlight.title) {
      return NextResponse.json({ success: true, enabled: false, spotlight: null }, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60" },
      });
    }

    return NextResponse.json({
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
    }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[Spotlight API] GET Error:", error);
    return NextResponse.json({ success: false, enabled: false, spotlight: null }, { status: 500 });
  }
}
