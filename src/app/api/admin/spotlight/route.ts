export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { siteSpotlight } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const spotlight = await db.query.siteSpotlight.findFirst({
      where: eq(siteSpotlight.id, "current"),
    });

    return NextResponse.json({
      success: true,
      spotlight: spotlight || {
        id: "current",
        enabled: false,
        title: "",
        tagline: "",
        description: "",
        backdropPath: "",
        posterPath: "",
        targetUrl: "",
        mediaType: "movie",
        badge: "Special Spotlight",
      },
    });
  } catch (error) {
    console.error("[Admin Spotlight API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch spotlight settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const body = await request.json().catch(() => ({}));
    const { 
      enabled = false, 
      title = "", 
      tagline = "", 
      description = "", 
      backdropPath = "", 
      posterPath = "", 
      targetUrl = "", 
      mediaType = "movie",
      badge = "Spotlight"
    } = body;

    const [saved] = await db
      .insert(siteSpotlight)
      .values({
        id: "current",
        enabled: Boolean(enabled),
        title: String(title).trim(),
        tagline: String(tagline).trim(),
        description: String(description).trim(),
        backdropPath: String(backdropPath).trim(),
        posterPath: String(posterPath).trim(),
        targetUrl: String(targetUrl).trim(),
        mediaType: String(mediaType || "movie"),
        badge: String(badge || "Spotlight"),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteSpotlight.id,
        set: {
          enabled: Boolean(enabled),
          title: String(title).trim(),
          tagline: String(tagline).trim(),
          description: String(description).trim(),
          backdropPath: String(backdropPath).trim(),
          posterPath: String(posterPath).trim(),
          targetUrl: String(targetUrl).trim(),
          mediaType: String(mediaType || "movie"),
          badge: String(badge || "Spotlight"),
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      spotlight: saved,
    });
  } catch (error) {
    console.error("[Admin Spotlight API] POST Error:", error);
    return NextResponse.json({ error: "Failed to save spotlight banner" }, { status: 500 });
  }
}
