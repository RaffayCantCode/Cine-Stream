export const runtime = 'edge';
export const dynamic = "force-dynamic";

import { verifyAdminSession } from "@/lib/auth/admin";
import { siteAnnouncements } from "@/lib/db/schema";
import { supabase } from "@/lib/supabase";

// GET - Retrieve real-time announcement directly from DB for Admin Panel (bypasses public cache)
export async function GET() {
  try {
    const authResult = await verifyAdminSession();
    if (authResult.error || !authResult.user || !authResult.db) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const db = authResult.db;
    const announcement = await db.query.siteAnnouncements.findFirst({
      where: (table, { eq }) => eq(table.id, "current"),
    });

    return Response.json(
      {
        success: true,
        data: {
          message: announcement?.message?.trim() ? announcement.message.trim() : null,
          updatedAt: announcement?.updatedAt ? announcement.updatedAt.toISOString() : null,
          updatedBy: announcement?.updatedBy || null,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[Admin Announcement] Error fetching announcement:", error);
    return Response.json(
      { error: "Failed to fetch announcement" },
      { status: 500 }
    );
  }
}

// POST - Save or update announcement
export async function POST(request: Request) {
  try {
    const authResult = await verifyAdminSession();
    if (authResult.error || !authResult.user || !authResult.db) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
    const cleanMessage = rawMessage.length > 0 ? rawMessage : null;

    const db = authResult.db;
    const now = new Date();

    const [saved] = await db
      .insert(siteAnnouncements)
      .values({
        id: "current",
        message: cleanMessage,
        updatedBy: authResult.user.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: siteAnnouncements.id,
        set: {
          message: cleanMessage,
          updatedBy: authResult.user.id,
          updatedAt: now,
        },
      })
      .returning();

    const payload = {
      message: saved.message,
      updatedAt: saved.updatedAt.toISOString(),
    };

    // Attempt to broadcast via Supabase Realtime channel
    try {
      const channel = supabase.channel("site-announcements");
      await channel.send({
        type: "broadcast",
        event: "announcement_update",
        payload,
      });
    } catch (realtimeErr) {
      console.warn("[Admin Announcement] Supabase broadcast failed:", realtimeErr);
    }

    return Response.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("[Admin Announcement] Error updating announcement:", error);
    return Response.json(
      { error: "Failed to update announcement" },
      { status: 500 }
    );
  }
}

// DELETE - Clear announcement
export async function DELETE() {
  try {
    const authResult = await verifyAdminSession();
    if (authResult.error || !authResult.user || !authResult.db) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const db = authResult.db;
    const now = new Date();

    const [saved] = await db
      .insert(siteAnnouncements)
      .values({
        id: "current",
        message: null,
        updatedBy: authResult.user.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: siteAnnouncements.id,
        set: {
          message: null,
          updatedBy: authResult.user.id,
          updatedAt: now,
        },
      })
      .returning();

    const payload = {
      message: null,
      updatedAt: saved.updatedAt.toISOString(),
    };

    // Attempt to broadcast via Supabase Realtime channel
    try {
      const channel = supabase.channel("site-announcements");
      await channel.send({
        type: "broadcast",
        event: "announcement_update",
        payload,
      });
    } catch (realtimeErr) {
      console.warn("[Admin Announcement] Supabase broadcast failed:", realtimeErr);
    }

    return Response.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("[Admin Announcement] Error clearing announcement:", error);
    return Response.json(
      { error: "Failed to clear announcement" },
      { status: 500 }
    );
  }
}
