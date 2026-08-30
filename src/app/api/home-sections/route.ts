export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customHomeSections } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { getCachedHomeSections, setCachedHomeSections } from "@/lib/server-cache";

export async function GET() {
  const cached = getCachedHomeSections();
  if (cached) {
    return NextResponse.json(
      {
        success: true,
        sections: cached,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  }

  try {
    const db = getDb();
    const sections = await db.query.customHomeSections.findMany({
      where: eq(customHomeSections.enabled, true),
      orderBy: [asc(customHomeSections.orderIndex), asc(customHomeSections.createdAt)],
    });

    const mapped = sections.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      icon: s.icon,
      items: Array.isArray(s.items) ? s.items : [],
    }));

    setCachedHomeSections(mapped);

    return NextResponse.json(
      {
        success: true,
        sections: mapped,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[Home Sections API] GET Error:", error);
    return NextResponse.json({ success: false, sections: [] }, { status: 500 });
  }
}
