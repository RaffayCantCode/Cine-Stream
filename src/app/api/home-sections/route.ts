export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customHomeSections } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const sections = await db.query.customHomeSections.findMany({
      where: eq(customHomeSections.enabled, true),
      orderBy: [asc(customHomeSections.orderIndex), asc(customHomeSections.createdAt)],
    });

    return NextResponse.json(
      {
        success: true,
        sections: sections.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          icon: s.icon,
          items: Array.isArray(s.items) ? s.items : [],
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Home Sections API] GET Error:", error);
    return NextResponse.json({ success: false, sections: [] }, { status: 500 });
  }
}
