export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { customThemes } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const themes = await db.query.customThemes.findMany({
      orderBy: [desc(customThemes.createdAt)],
    });

    return NextResponse.json({
      success: true,
      themes,
    });
  } catch (error) {
    console.error("[Admin Themes API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch custom themes" }, { status: 500 });
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
      label, 
      tagline = "Custom", 
      description = "", 
      background = "#080C14", 
      card = "#141C2B", 
      primary = "#38BDF8", 
      accent = "#F43F5E", 
      foreground = "#E2E8F0",
      enabled = true 
    } = body;

    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ error: "Theme label/name is required" }, { status: 400 });
    }

    const themeId = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20)}_${Date.now().toString(36)}`;
    const preview = `linear-gradient(135deg, ${background} 0%, ${card} 45%, ${primary} 85%, ${accent} 100%)`;

    const [newTheme] = await db
      .insert(customThemes)
      .values({
        id: themeId,
        label: label.trim(),
        tagline: tagline.trim() || "Custom",
        description: description.trim() || null,
        background: background.trim(),
        card: card.trim(),
        primary: primary.trim(),
        accent: accent.trim(),
        foreground: foreground.trim(),
        preview,
        enabled: Boolean(enabled),
        updatedAt: new Date(),
      })
      .returning();

    const { invalidateThemesCache } = await import("@/lib/server-cache");
    invalidateThemesCache();

    return NextResponse.json({
      success: true,
      theme: newTheme,
    });
  } catch (error) {
    console.error("[Admin Themes API] POST Error:", error);
    return NextResponse.json({ error: "Failed to create custom theme" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const body = await request.json().catch(() => ({}));
    const { id, label, tagline, description, background, card, primary, accent, foreground, enabled } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Theme ID is required" }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (label !== undefined) updates.label = String(label).trim();
    if (tagline !== undefined) updates.tagline = String(tagline).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (background !== undefined) updates.background = String(background).trim();
    if (card !== undefined) updates.card = String(card).trim();
    if (primary !== undefined) updates.primary = String(primary).trim();
    if (accent !== undefined) updates.accent = String(accent).trim();
    if (foreground !== undefined) updates.foreground = String(foreground).trim();
    if (enabled !== undefined) updates.enabled = Boolean(enabled);

    if (updates.background || updates.card || updates.primary || updates.accent) {
      const existing = await db.query.customThemes.findFirst({ where: eq(customThemes.id, id) });
      const bg = updates.background || existing?.background || "#080C14";
      const cd = updates.card || existing?.card || "#141C2B";
      const pr = updates.primary || existing?.primary || "#38BDF8";
      const ac = updates.accent || existing?.accent || "#F43F5E";
      updates.preview = `linear-gradient(135deg, ${bg} 0%, ${cd} 45%, ${pr} 85%, ${ac} 100%)`;
    }

    const [updated] = await db
      .update(customThemes)
      .set(updates)
      .where(eq(customThemes.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    const { invalidateThemesCache } = await import("@/lib/server-cache");
    invalidateThemesCache();

    return NextResponse.json({
      success: true,
      theme: updated,
    });
  } catch (error) {
    console.error("[Admin Themes API] PUT Error:", error);
    return NextResponse.json({ error: "Failed to update custom theme" }, { status: 500 });
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
      return NextResponse.json({ error: "Theme ID is required" }, { status: 400 });
    }

    await db.delete(customThemes).where(eq(customThemes.id, id));

    const { invalidateThemesCache } = await import("@/lib/server-cache");
    invalidateThemesCache();

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("[Admin Themes API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete custom theme" }, { status: 500 });
  }
}
