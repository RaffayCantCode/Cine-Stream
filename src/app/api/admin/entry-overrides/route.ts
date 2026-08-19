export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { mediaOverrides, type MediaOverride } from "@/lib/db/schema";
import { normalizeOverrideId } from "@/lib/media-overrides";
import { desc, eq, and, or, ilike } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const typeFilter = searchParams.get("type")?.trim().toLowerCase() || "";
    const statusFilter = searchParams.get("status")?.trim().toLowerCase() || "";

    const rows = await db.query.mediaOverrides.findMany({
      orderBy: [desc(mediaOverrides.updatedAt)],
    });

    let filtered = rows;

    if (typeFilter && typeFilter !== "all") {
      filtered = filtered.filter((r) => r.mediaType.toLowerCase() === typeFilter);
    }

    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "upcoming") {
        filtered = filtered.filter((r) => r.isUpcoming || r.status === "upcoming");
      } else if (statusFilter === "unavailable") {
        filtered = filtered.filter((r) => r.isUnavailable || r.status === "unavailable");
      } else if (statusFilter === "hidden") {
        filtered = filtered.filter((r) => r.isHidden || r.status === "hidden");
      } else if (statusFilter === "customized") {
        filtered = filtered.filter(
          (r) =>
            Boolean(r.customTitle || r.customDescription || (r.customGenres && r.customGenres.length > 0) || r.customPoster || r.customBackdrop)
        );
      }
    }

    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.mediaId.toLowerCase().includes(qLower) ||
          r.id.toLowerCase().includes(qLower) ||
          (r.customTitle && r.customTitle.toLowerCase().includes(qLower)) ||
          (r.customDescription && r.customDescription.toLowerCase().includes(qLower))
      );
    }

    return NextResponse.json({
      success: true,
      overrides: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error("[Admin Entry Overrides API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch media overrides" }, { status: 500 });
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
      mediaType,
      mediaId,
      status = "default",
      isHidden = false,
      isUpcoming = false,
      isUnavailable = false,
      customTitle = null,
      customDescription = null,
      customGenres = [],
      customReleaseDate = null,
      customPoster = null,
      customBackdrop = null,
      customTags = [],
      notes = null,
    } = body;

    if (!mediaType || !mediaId) {
      return NextResponse.json({ error: "Media type and ID are required" }, { status: 400 });
    }

    const cleanType = String(mediaType).trim().toLowerCase();
    const cleanId = String(mediaId).trim();
    const id = normalizeOverrideId(cleanType, cleanId);

    // Determine clean status string
    let effectiveStatus = String(status || "default").toLowerCase();
    if (isHidden) effectiveStatus = "hidden";
    else if (isUpcoming) effectiveStatus = "upcoming";
    else if (isUnavailable) effectiveStatus = "unavailable";

    const payload = {
      id,
      mediaType: cleanType,
      mediaId: cleanId,
      status: effectiveStatus,
      isHidden: Boolean(isHidden || effectiveStatus === "hidden"),
      isUpcoming: Boolean(isUpcoming || effectiveStatus === "upcoming"),
      isUnavailable: Boolean(isUnavailable || effectiveStatus === "unavailable"),
      customTitle: customTitle && typeof customTitle === "string" && customTitle.trim() ? customTitle.trim() : null,
      customDescription: customDescription && typeof customDescription === "string" && customDescription.trim() ? customDescription.trim() : null,
      customGenres: Array.isArray(customGenres) ? customGenres.filter(Boolean) : [],
      customReleaseDate: customReleaseDate && typeof customReleaseDate === "string" && customReleaseDate.trim() ? customReleaseDate.trim() : null,
      customPoster: customPoster && typeof customPoster === "string" && customPoster.trim() ? customPoster.trim() : null,
      customBackdrop: customBackdrop && typeof customBackdrop === "string" && customBackdrop.trim() ? customBackdrop.trim() : null,
      customTags: Array.isArray(customTags) ? customTags.filter(Boolean) : [],
      notes: notes && typeof notes === "string" && notes.trim() ? notes.trim() : null,
      updatedBy: auth.user?.name || auth.user?.email || "Admin",
      updatedAt: new Date(),
    };

    const existing = await db.query.mediaOverrides.findFirst({
      where: eq(mediaOverrides.id, id),
    });

    let savedOverride;
    if (existing) {
      const [updated] = await db
        .update(mediaOverrides)
        .set(payload)
        .where(eq(mediaOverrides.id, id))
        .returning();
      savedOverride = updated;
    } else {
      const [inserted] = await db
        .insert(mediaOverrides)
        .values({
          ...payload,
          createdAt: new Date(),
        })
        .returning();
      savedOverride = inserted;
    }

    return NextResponse.json({
      success: true,
      override: savedOverride,
    });
  } catch (error) {
    console.error("[Admin Entry Overrides API] POST Error:", error);
    return NextResponse.json({ error: "Failed to save media override" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const body = await request.json().catch(() => ({}));
    const { id, mediaType, mediaId } = body;

    let targetId = id;
    if (!targetId && mediaType && mediaId) {
      targetId = normalizeOverrideId(mediaType, mediaId);
    }

    if (!targetId || typeof targetId !== "string") {
      return NextResponse.json({ error: "Override ID or mediaType & mediaId required" }, { status: 400 });
    }

    await db.delete(mediaOverrides).where(eq(mediaOverrides.id, targetId.trim()));

    return NextResponse.json({
      success: true,
      deletedId: targetId,
    });
  } catch (error) {
    console.error("[Admin Entry Overrides API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to reset media override" }, { status: 500 });
  }
}
