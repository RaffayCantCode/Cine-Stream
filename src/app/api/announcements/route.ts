export const runtime = 'edge';
export const dynamic = "force-dynamic";

import { getDb } from "@/lib/db";
import { siteAnnouncements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const announcement = await db.query.siteAnnouncements.findFirst({
      where: eq(siteAnnouncements.id, "current"),
    });

    return Response.json(
      {
        success: true,
        data: {
          message: announcement?.message?.trim() ? announcement.message.trim() : null,
          updatedAt: announcement?.updatedAt ? announcement.updatedAt.toISOString() : null,
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[API] Failed to fetch announcements:", error);
    return Response.json(
      {
        success: false,
        data: { message: null, updatedAt: null },
      },
      { status: 500 }
    );
  }
}
