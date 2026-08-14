export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const settings = await db.query.siteSettings.findFirst({
      where: eq(siteSettings.id, "current"),
    });

    return NextResponse.json({
      success: true,
      settings: settings || {
        id: "current",
        accentColor: "#7288AE",
        heroStyle: "cinematic",
        tagline: "Movies. TV. Anime. All in one place.",
      },
    });
  } catch (error) {
    console.error("[Admin Settings API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch appearance settings" }, { status: 500 });
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
    const { accentColor = "#7288AE", heroStyle = "cinematic", tagline = "Movies. TV. Anime. All in one place." } = body;

    const [saved] = await db
      .insert(siteSettings)
      .values({
        id: "current",
        accentColor: String(accentColor).trim(),
        heroStyle: String(heroStyle).trim(),
        tagline: String(tagline).trim(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: {
          accentColor: String(accentColor).trim(),
          heroStyle: String(heroStyle).trim(),
          tagline: String(tagline).trim(),
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      settings: saved,
    });
  } catch (error) {
    console.error("[Admin Settings API] POST Error:", error);
    return NextResponse.json({ error: "Failed to save appearance settings" }, { status: 500 });
  }
}
