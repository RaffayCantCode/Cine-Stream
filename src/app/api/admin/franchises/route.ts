export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { customFranchises } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const franchises = await db.query.customFranchises.findMany({
      orderBy: [desc(customFranchises.createdAt)],
    });

    return NextResponse.json({
      success: true,
      franchises,
    });
  } catch (error) {
    console.error("[Admin Franchises API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch custom franchises" }, { status: 500 });
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
    const { name, overview = "", posterPath = "", backdropPath = "", parts = [], enabled = true } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Franchise collection name is required" }, { status: 400 });
    }

    const [newFranchise] = await db
      .insert(customFranchises)
      .values({
        name: name.trim(),
        overview: overview && typeof overview === "string" ? overview.trim() : null,
        posterPath: posterPath && typeof posterPath === "string" ? posterPath.trim() : null,
        backdropPath: backdropPath && typeof backdropPath === "string" ? backdropPath.trim() : null,
        parts: Array.isArray(parts) ? parts : [],
        enabled: Boolean(enabled),
      })
      .returning();

    return NextResponse.json({
      success: true,
      franchise: newFranchise,
    });
  } catch (error) {
    console.error("[Admin Franchises API] POST Error:", error);
    return NextResponse.json({ error: "Failed to create custom franchise" }, { status: 500 });
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

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (overview !== undefined) updates.overview = overview ? String(overview).trim() : null;
    if (posterPath !== undefined) updates.posterPath = posterPath ? String(posterPath).trim() : null;
    if (backdropPath !== undefined) updates.backdropPath = backdropPath ? String(backdropPath).trim() : null;
    if (Array.isArray(parts)) updates.parts = parts;
    if (enabled !== undefined) updates.enabled = Boolean(enabled);

    const [updatedFranchise] = await db
      .update(customFranchises)
      .set(updates)
      .where(eq(customFranchises.id, id))
      .returning();

    if (!updatedFranchise) {
      return NextResponse.json({ error: "Franchise not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      franchise: updatedFranchise,
    });
  } catch (error) {
    console.error("[Admin Franchises API] PUT Error:", error);
    return NextResponse.json({ error: "Failed to update custom franchise" }, { status: 500 });
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

    await db.delete(customFranchises).where(eq(customFranchises.id, id));

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("[Admin Franchises API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete custom franchise" }, { status: 500 });
  }
}
