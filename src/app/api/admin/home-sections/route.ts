export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { customHomeSections } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const sections = await db.query.customHomeSections.findMany({
      orderBy: [asc(customHomeSections.orderIndex), asc(customHomeSections.createdAt)],
    });

    return NextResponse.json({
      success: true,
      sections,
    });
  } catch (error) {
    console.error("[Admin Home Sections API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch custom sections" }, { status: 500 });
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
    const { title, subtitle, icon, items = [], enabled = true, orderIndex = 0 } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Section title is required" }, { status: 400 });
    }

    const [newSection] = await db
      .insert(customHomeSections)
      .values({
        title: title.trim(),
        subtitle: subtitle && typeof subtitle === "string" ? subtitle.trim() : null,
        icon: icon && typeof icon === "string" ? icon.trim() : null,
        items: Array.isArray(items) ? items : [],
        enabled: Boolean(enabled),
        orderIndex: Number(orderIndex) || 0,
      })
      .returning();

    return NextResponse.json({
      success: true,
      section: newSection,
    });
  } catch (error) {
    console.error("[Admin Home Sections API] POST Error:", error);
    return NextResponse.json({ error: "Failed to create custom section" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const rawBody = await request.json().catch(() => ({}));
    
    // Bulk reordering of sections
    if (Array.isArray(rawBody.sections)) {
      for (const sec of rawBody.sections) {
        if (sec.id) {
          await db
            .update(customHomeSections)
            .set({ orderIndex: Number(sec.orderIndex) || 0, updatedAt: new Date() })
            .where(eq(customHomeSections.id, sec.id));
        }
      }
      return NextResponse.json({ success: true });
    }

    const payload = rawBody.section ? rawBody.section : rawBody;
    const { id, title, subtitle, description, icon, items, enabled, orderIndex } = payload;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Section ID is required" }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (typeof title === "string" && title.trim()) updates.title = title.trim();
    const finalSubtitle = subtitle !== undefined ? subtitle : description;
    if (finalSubtitle !== undefined) updates.subtitle = finalSubtitle ? String(finalSubtitle).trim() : null;
    if (icon !== undefined) updates.icon = icon ? String(icon).trim() : null;
    if (Array.isArray(items)) updates.items = items;
    if (enabled !== undefined) updates.enabled = Boolean(enabled);
    if (orderIndex !== undefined) updates.orderIndex = Number(orderIndex);

    const [updatedSection] = await db
      .update(customHomeSections)
      .set(updates)
      .where(eq(customHomeSections.id, id))
      .returning();

    if (!updatedSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      section: updatedSection,
    });
  } catch (error) {
    console.error("[Admin Home Sections API] PUT Error:", error);
    return NextResponse.json({ error: "Failed to update custom section" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const { id } = await request.json().catch(() => ({}));

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Section ID is required" }, { status: 400 });
    }

    await db.delete(customHomeSections).where(eq(customHomeSections.id, id));

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("[Admin Home Sections API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete custom section" }, { status: 500 });
  }
}
