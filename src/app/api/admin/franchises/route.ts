export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { customFranchises } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { FRANCHISES } from "@/lib/franchises";

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const dbFranchises = await db.query.customFranchises.findMany({
      orderBy: [desc(customFranchises.createdAt)],
    });

    const dbMap = new Map<string, any>();
    for (const f of dbFranchises) {
      dbMap.set(f.id, f);
    }

    // Build unified list of all franchises (Presets + DB Custom/Overrides)
    const presetIds = new Set(FRANCHISES.map(f => f.id));

    const presets = FRANCHISES.map((preset) => {
      const dbOverride = dbMap.get(preset.id);
      if (dbOverride) {
        return {
          id: preset.id,
          name: dbOverride.name || preset.name,
          overview: dbOverride.overview ?? preset.overview,
          posterPath: dbOverride.posterPath ?? preset.poster_path,
          backdropPath: dbOverride.backdropPath ?? preset.backdrop_path,
          parts: Array.isArray(dbOverride.parts) && dbOverride.parts.length > 0 ? dbOverride.parts : (preset.items || []),
          enabled: dbOverride.enabled ?? true,
          isPreset: true,
          isOverridden: true,
          createdAt: dbOverride.createdAt,
          updatedAt: dbOverride.updatedAt,
        };
      }

      return {
        id: preset.id,
        name: preset.name,
        overview: preset.overview || "",
        posterPath: preset.poster_path || "",
        backdropPath: preset.backdrop_path || "",
        parts: preset.items || [],
        enabled: true,
        isPreset: true,
        isOverridden: false,
      };
    });

    const customList = dbFranchises
      .filter((f) => !presetIds.has(f.id))
      .map((f) => ({
        ...f,
        isPreset: false,
        isOverridden: false,
      }));

    const unifiedFranchises = [...customList, ...presets];

    return NextResponse.json({
      success: true,
      franchises: unifiedFranchises,
    });
  } catch (error) {
    console.error("[Admin Franchises API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch franchises" }, { status: 500 });
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
    const { id, name, overview = "", posterPath = "", backdropPath = "", parts = [], enabled = true } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Franchise collection name is required" }, { status: 400 });
    }

    const cleanId = id && typeof id === "string" && id.trim() ? id.trim() : crypto.randomUUID();

    // Check if row already exists (e.g. for preset override)
    const existing = await db.query.customFranchises.findFirst({
      where: eq(customFranchises.id, cleanId),
    });

    let savedFranchise;
    if (existing) {
      const [updated] = await db
        .update(customFranchises)
        .set({
          name: name.trim(),
          overview: overview && typeof overview === "string" ? overview.trim() : null,
          posterPath: posterPath && typeof posterPath === "string" ? posterPath.trim() : null,
          backdropPath: backdropPath && typeof backdropPath === "string" ? backdropPath.trim() : null,
          parts: Array.isArray(parts) ? parts : [],
          enabled: Boolean(enabled),
          updatedAt: new Date(),
        })
        .where(eq(customFranchises.id, cleanId))
        .returning();
      savedFranchise = updated;
    } else {
      const [inserted] = await db
        .insert(customFranchises)
        .values({
          id: cleanId,
          name: name.trim(),
          overview: overview && typeof overview === "string" ? overview.trim() : null,
          posterPath: posterPath && typeof posterPath === "string" ? posterPath.trim() : null,
          backdropPath: backdropPath && typeof backdropPath === "string" ? backdropPath.trim() : null,
          parts: Array.isArray(parts) ? parts : [],
          enabled: Boolean(enabled),
        })
        .returning();
      savedFranchise = inserted;
    }

    return NextResponse.json({
      success: true,
      franchise: savedFranchise,
    });
  } catch (error) {
    console.error("[Admin Franchises API] POST Error:", error);
    return NextResponse.json({ error: "Failed to save franchise" }, { status: 500 });
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
    const { id, name, overview, posterPath, backdropPath, parts, enabled } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Franchise ID is required" }, { status: 400 });
    }

    const cleanId = id.trim();

    // Check if franchise exists in DB
    const existing = await db.query.customFranchises.findFirst({
      where: eq(customFranchises.id, cleanId),
    });

    let savedFranchise;
    if (existing) {
      const updates: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (typeof name === "string" && name.trim()) updates.name = name.trim();
      if (overview !== undefined) updates.overview = overview ? String(overview).trim() : null;
      if (posterPath !== undefined) updates.posterPath = posterPath ? String(posterPath).trim() : null;
      if (backdropPath !== undefined) updates.backdropPath = backdropPath ? String(backdropPath).trim() : null;
      if (Array.isArray(parts)) updates.parts = parts;
      if (enabled !== undefined) updates.enabled = Boolean(enabled);

      const [updated] = await db
        .update(customFranchises)
        .set(updates)
        .where(eq(customFranchises.id, cleanId))
        .returning();
      savedFranchise = updated;
    } else {
      // First time saving an override for a preset franchise
      const preset = FRANCHISES.find(f => f.id === cleanId);
      const [inserted] = await db
        .insert(customFranchises)
        .values({
          id: cleanId,
          name: typeof name === "string" && name.trim() ? name.trim() : (preset?.name || cleanId),
          overview: overview !== undefined ? (overview ? String(overview).trim() : null) : (preset?.overview || null),
          posterPath: posterPath !== undefined ? (posterPath ? String(posterPath).trim() : null) : (preset?.poster_path || null),
          backdropPath: backdropPath !== undefined ? (backdropPath ? String(backdropPath).trim() : null) : (preset?.backdrop_path || null),
          parts: Array.isArray(parts) ? parts : (preset?.items || []),
          enabled: enabled !== undefined ? Boolean(enabled) : true,
        })
        .returning();
      savedFranchise = inserted;
    }

    return NextResponse.json({
      success: true,
      franchise: savedFranchise,
    });
  } catch (error) {
    console.error("[Admin Franchises API] PUT Error:", error);
    return NextResponse.json({ error: "Failed to update franchise" }, { status: 500 });
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
      return NextResponse.json({ error: "Franchise ID is required" }, { status: 400 });
    }

    await db.delete(customFranchises).where(eq(customFranchises.id, id.trim()));

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("[Admin Franchises API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete/reset franchise" }, { status: 500 });
  }
}
