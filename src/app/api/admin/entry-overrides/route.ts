export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { mediaOverrides, type MediaOverride } from "@/lib/db/schema";
import { normalizeOverrideId, extractCandidateMediaIds, invalidateMediaOverridesCache } from "@/lib/media-overrides";
import { invalidateAnimeDetailsCache } from "@/lib/anime-fetch";
import { desc, eq, and, or, ilike, inArray } from "drizzle-orm";
import { tmdbFetch } from "@/lib/tmdb";

async function resolveMediaTitleAndPoster(mediaType: string, mediaId: string): Promise<{ title?: string; poster?: string }> {
  try {
    const cleanType = mediaType.toLowerCase().trim();
    const cleanId = String(mediaId).trim();

    if (cleanType === "anime") {
      if (cleanId.startsWith("kitsu-")) {
        const kitsuId = cleanId.replace("kitsu-", "");
        const res = await fetch(`https://kitsu.app/api/edge/anime/${kitsuId}`, {
          headers: { Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json" },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const json = await res.json();
          const attr = json?.data?.attributes;
          const title = attr?.canonicalTitle || attr?.titles?.en || attr?.titles?.en_jp || attr?.titles?.ja_jp;
          const poster = attr?.posterImage?.large || attr?.posterImage?.original || attr?.posterImage?.medium;
          if (title) return { title, poster };
        }
      } else {
        const anilistId = cleanId.startsWith("mal-") ? null : Number(cleanId);
        const malId = cleanId.startsWith("mal-") ? Number(cleanId.replace("mal-", "")) : null;
        const query = `query ($id: Int, $idMal: Int) {
          Media(id: $id, idMal: $idMal, type: ANIME) {
            title { english romaji native }
            coverImage { large extraLarge }
          }
        }`;
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables: { id: anilistId, idMal: malId } }),
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const json = await res.json();
          const media = json?.data?.Media;
          if (media) {
            const title = media.title?.english || media.title?.romaji || media.title?.native;
            const poster = media.coverImage?.extraLarge || media.coverImage?.large;
            if (title) return { title, poster };
          }
        }
      }
    } else if (cleanType === "movie") {
      const res: any = await tmdbFetch(`/movie/${cleanId}`, {}, { noCache: false });
      if (res && res.title) {
        return {
          title: res.title,
          poster: res.poster_path ? `https://image.tmdb.org/t/p/w500${res.poster_path}` : undefined,
        };
      }
    } else if (cleanType === "tv") {
      const res: any = await tmdbFetch(`/tv/${cleanId}`, {}, { noCache: false });
      if (res && res.name) {
        return {
          title: res.name,
          poster: res.poster_path ? `https://image.tmdb.org/t/p/w500${res.poster_path}` : undefined,
        };
      }
    }
  } catch (e) {
    console.warn(`[resolveMediaTitleAndPoster] Failed for ${mediaType} ${mediaId}:`, e);
  }
  return {};
}

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

    // Auto-resolve missing or corrupted placeholder titles/posters in parallel for all returned rows
    const enriched = await Promise.all(
      filtered.map(async (r) => {
        let title = r.customTitle;
        let poster = r.customPoster;

        // Clean display mediaId if it has redundant type prefix
        const cleanType = r.mediaType.toLowerCase().trim();
        let displayMediaId = String(r.mediaId || "").trim();
        const prefix = `${cleanType}-`;
        while (displayMediaId.toLowerCase().startsWith(prefix)) {
          displayMediaId = displayMediaId.slice(prefix.length);
        }

        // If title is missing or corrupted placeholder like "Title (anime anime-kitsu-50629)"
        if (!title || title.startsWith("Title (") || !poster) {
          const resolved = await resolveMediaTitleAndPoster(cleanType, displayMediaId);
          if ((!title || title.startsWith("Title (")) && resolved.title) title = resolved.title;
          if (!poster && resolved.poster) poster = resolved.poster;
        }

        return {
          ...r,
          id: normalizeOverrideId(cleanType, displayMediaId),
          mediaId: displayMediaId,
          customTitle: title || r.customTitle,
          customPoster: poster || r.customPoster,
          defaultTitle: title,
          defaultPoster: poster,
        };
      })
    );

    let finalResults = enriched;

    if (q) {
      const qLower = q.toLowerCase();
      finalResults = enriched.filter(
        (r) =>
          r.mediaId.toLowerCase().includes(qLower) ||
          r.id.toLowerCase().includes(qLower) ||
          (r.customTitle && r.customTitle.toLowerCase().includes(qLower)) ||
          (r.customDescription && r.customDescription.toLowerCase().includes(qLower))
      );
    }

    return NextResponse.json({
      success: true,
      overrides: finalResults,
      total: finalResults.length,
    }, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      },
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
    let cleanId = String(mediaId).trim();
    const typePrefix = `${cleanType}-`;
    while (cleanId.toLowerCase().startsWith(typePrefix)) {
      cleanId = cleanId.slice(typePrefix.length);
    }
    const id = normalizeOverrideId(cleanType, cleanId);

    // Auto-resolve missing title or poster so database always stores the real title
    let resolvedTitle = customTitle && typeof customTitle === "string" && customTitle.trim() && !customTitle.startsWith("Title (") ? customTitle.trim() : null;
    let resolvedPoster = customPoster && typeof customPoster === "string" && customPoster.trim() ? customPoster.trim() : null;

    if (!resolvedTitle || !resolvedPoster) {
      const resolved = await resolveMediaTitleAndPoster(cleanType, cleanId);
      if (!resolvedTitle && resolved.title) resolvedTitle = resolved.title;
      if (!resolvedPoster && resolved.poster) resolvedPoster = resolved.poster;
    }

    if (!resolvedTitle) {
      resolvedTitle = customTitle || `Title (${cleanType} ${cleanId})`;
    }

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
      customTitle: resolvedTitle,
      customDescription: customDescription && typeof customDescription === "string" && customDescription.trim() ? customDescription.trim() : null,
      customGenres: Array.isArray(customGenres) ? customGenres.filter(Boolean) : [],
      customReleaseDate: customReleaseDate && typeof customReleaseDate === "string" && customReleaseDate.trim() ? customReleaseDate.trim() : null,
      customPoster: resolvedPoster,
      customBackdrop: customBackdrop && typeof customBackdrop === "string" && customBackdrop.trim() ? customBackdrop.trim() : null,
      customTags: Array.isArray(customTags) ? customTags.filter(Boolean) : [],
      notes: notes && typeof notes === "string" && notes.trim() ? notes.trim() : null,
      updatedBy: auth.user?.name || auth.user?.email || "Admin",
      updatedAt: new Date(),
    };

    // Find and clean up any existing duplicate/legacy rows
    const { candidateIds, candidateMediaIds } = extractCandidateMediaIds(cleanType, cleanId);
    const existing = await db.query.mediaOverrides.findFirst({
      where: or(
        eq(mediaOverrides.id, id),
        inArray(mediaOverrides.id, candidateIds),
        inArray(mediaOverrides.mediaId, candidateMediaIds)
      ),
    });

    let savedOverride;
    if (existing) {
      const [updated] = await db
        .update(mediaOverrides)
        .set(payload)
        .where(eq(mediaOverrides.id, existing.id))
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

    invalidateMediaOverridesCache();
    invalidateAnimeDetailsCache(cleanId);
    invalidateAnimeDetailsCache(id);

    return NextResponse.json({
      success: true,
      override: savedOverride,
    }, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      },
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

    const cleanType = String(mediaType || "movie").toLowerCase().trim();
    let cleanId = String(mediaId || id || "").trim();
    const typePrefix = `${cleanType}-`;
    while (cleanId.toLowerCase().startsWith(typePrefix)) {
      cleanId = cleanId.slice(typePrefix.length);
    }

    const { candidateIds, candidateMediaIds } = extractCandidateMediaIds(cleanType, cleanId);
    const allIds = Array.from(new Set([id, normalizeOverrideId(cleanType, cleanId), ...candidateIds])).filter(Boolean) as string[];
    const allMediaIds = Array.from(new Set([cleanId, ...candidateMediaIds])).filter(Boolean) as string[];

    await db.delete(mediaOverrides).where(
      or(
        inArray(mediaOverrides.id, allIds),
        inArray(mediaOverrides.mediaId, allMediaIds)
      )
    );

    invalidateMediaOverridesCache();
    invalidateAnimeDetailsCache(cleanId);
    if (id) invalidateAnimeDetailsCache(id);

    return NextResponse.json({
      success: true,
      deletedId: id || cleanId,
    }, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Admin Entry Overrides API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to reset media override" }, { status: 500 });
  }
}
