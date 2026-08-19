import { getDb } from "@/lib/db";
import { mediaOverrides, type MediaOverride } from "@/lib/db/schema";
import { eq, or, and, desc } from "drizzle-orm";

export function normalizeOverrideId(mediaType: string, mediaId: string | number): string {
  const cleanType = (mediaType || "movie").toLowerCase().trim();
  const cleanId = String(mediaId).trim();
  return `${cleanType}-${cleanId}`;
}

export async function getMediaOverride(
  mediaType: string,
  mediaId: string | number
): Promise<MediaOverride | null> {
  if (!mediaType || !mediaId) return null;
  try {
    const db = getDb();
    const id = normalizeOverrideId(mediaType, mediaId);
    const cleanId = String(mediaId).trim();
    const cleanType = mediaType.toLowerCase().trim();

    const override = await db.query.mediaOverrides.findFirst({
      where: or(
        eq(mediaOverrides.id, id),
        and(
          eq(mediaOverrides.mediaType, cleanType),
          eq(mediaOverrides.mediaId, cleanId)
        )
      ),
    });

    return override || null;
  } catch (error) {
    console.error("[Media Overrides] getMediaOverride Error:", error);
    return null;
  }
}

export async function getAllMediaOverrides(): Promise<MediaOverride[]> {
  try {
    const db = getDb();
    return await db.query.mediaOverrides.findMany({
      orderBy: [desc(mediaOverrides.updatedAt)],
    });
  } catch (error) {
    console.error("[Media Overrides] getAllMediaOverrides Error:", error);
    return [];
  }
}

/**
 * Non-destructively overlays admin overrides on top of raw/default media data.
 */
export function applyMediaOverride<T extends Record<string, any>>(
  item: T | null | undefined,
  override: MediaOverride | null | undefined
): T | null {
  if (!item && !override) return null;

  // If item is null/failed from API, but an override exists (e.g. Upcoming/Unavailable entry that 404s on TMDB)
  if (!item && override) {
    const syntheticTitle = override.customTitle || `Title (${override.mediaType} ${override.mediaId})`;
    const syntheticItem = {
      id: isNaN(Number(override.mediaId)) ? override.mediaId : Number(override.mediaId),
      media_type: override.mediaType,
      type: override.mediaType,
      title: syntheticTitle,
      name: syntheticTitle,
      overview: override.customDescription || "",
      description: override.customDescription || "",
      poster_path: override.customPoster || null,
      poster: override.customPoster || null,
      backdrop_path: override.customBackdrop || null,
      bannerImage: override.customBackdrop || null,
      release_date: override.customReleaseDate || null,
      first_air_date: override.customReleaseDate || null,
      genres: (override.customGenres || []).map((g, i) => ({ id: i + 1, name: g })),
      status: override.status,
      isUpcoming: override.isUpcoming || override.status === "upcoming",
      isUnavailable: override.isUnavailable || override.status === "unavailable",
      isHidden: override.isHidden || override.status === "hidden",
      _override: override,
    } as unknown as T;
    return syntheticItem;
  }

  if (!override) return item || null;

  const res = { ...item } as any;

  // Override Title
  if (override.customTitle && override.customTitle.trim()) {
    const t = override.customTitle.trim();
    res.title = t;
    res.name = t;
    if ("canonicalTitle" in res) res.canonicalTitle = t;
  }

  // Override Description
  if (override.customDescription && override.customDescription.trim()) {
    const d = override.customDescription.trim();
    res.overview = d;
    res.description = d;
    if ("synopsis" in res) res.synopsis = d;
  }

  // Override Genres
  if (Array.isArray(override.customGenres) && override.customGenres.length > 0) {
    if (Array.isArray(res.genres)) {
      if (res.genres.length > 0 && typeof res.genres[0] === "object") {
        res.genres = override.customGenres.map((g, i) => ({ id: i + 1, name: g }));
      } else {
        res.genres = [...override.customGenres];
      }
    } else {
      res.genres = override.customGenres.map((g, i) => ({ id: i + 1, name: g }));
    }
  }

  // Override Poster
  if (override.customPoster && override.customPoster.trim()) {
    const p = override.customPoster.trim();
    res.poster_path = p;
    res.poster = p;
    if ("coverImage" in res && typeof res.coverImage === "object") {
      res.coverImage = { ...res.coverImage, extraLarge: p, large: p };
    }
  }

  // Override Backdrop
  if (override.customBackdrop && override.customBackdrop.trim()) {
    const b = override.customBackdrop.trim();
    res.backdrop_path = b;
    res.backdrop = b;
    res.bannerImage = b;
  }

  // Override Release Date
  if (override.customReleaseDate && override.customReleaseDate.trim()) {
    const rd = override.customReleaseDate.trim();
    res.release_date = rd;
    res.first_air_date = rd;
    res.startDate = rd;
  }

  // Status flags
  const isUpcoming = Boolean(override.isUpcoming || override.status === "upcoming");
  const isUnavailable = Boolean(override.isUnavailable || override.status === "unavailable");
  const isHidden = Boolean(override.isHidden || override.status === "hidden");

  res.isUpcoming = isUpcoming;
  res.isUnavailable = isUnavailable;
  res.isHidden = isHidden;
  res.status = override.status || res.status;
  res.overrideStatus = override.status;
  res._override = override;

  return res as T;
}
