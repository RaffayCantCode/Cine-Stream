export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customThemes } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const themes = await db.query.customThemes.findMany({
      where: eq(customThemes.enabled, true),
      orderBy: [desc(customThemes.createdAt)],
    });

    return NextResponse.json(
      {
        success: true,
        themes,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("[Themes API] GET Error:", error);
    return NextResponse.json({ success: false, themes: [] }, { status: 500 });
  }
}
