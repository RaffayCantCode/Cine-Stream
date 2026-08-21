import { getDb } from "@/lib/db";
import { mediaOverrides, type MediaOverride } from "@/lib/db/schema";
import { eq, or, and, desc, inArray } from "drizzle-orm";

export function normalizeOverrideId(mediaType: string, mediaId: string | number): string {
  const cleanType = (mediaType || "movie").toLowerCase().trim();
  let cleanId = String(mediaId || "").trim();

  // Strip all leading redundant type prefixes (e.g. "anime-anime-kitsu-123" -> "kitsu-123")
  const typePrefix = `${cleanType}-`;
  while (cleanId.toLowerCase().startsWith(typePrefix)) {
    cleanId = cleanId.slice(typePrefix.length);
  }

  return `${cleanType}-${cleanId}`;
}

export function extractCandidateMediaIds(mediaType: string, mediaId: string | number): {
  candidateIds: string[];
  candidateMediaIds: string[];
} {
  const cleanType = (mediaType || "movie").toLowerCase().trim();
  const rawIdStr = String(mediaId || "").trim();
  const lowerRaw = rawIdStr.toLowerCase();

  const candidateIds = new Set<string>();
  const candidateMediaIds = new Set<string>();

  if (!rawIdStr) {
    return { candidateIds: [], candidateMediaIds: [] };
  }

  // Base raw entries
  candidateIds.add(`${cleanType}-${rawIdStr}`);
  candidateIds.add(`${cleanType}-${lowerRaw}`);
  candidateIds.add(`${cleanType}-${cleanType}-${lowerRaw}`); // legacy double prefix
  candidateIds.add(lowerRaw);
  candidateIds.add(rawIdStr);
  candidateMediaIds.add(rawIdStr);
  candidateMediaIds.add(lowerRaw);

  // Clean stripped ID
  let strippedType = lowerRaw;
  while (strippedType.startsWith(`${cleanType}-`)) {
    strippedType = strippedType.slice(`${cleanType}-`.length);
  }
  if (strippedType) {
    candidateIds.add(`${cleanType}-${strippedType}`);
    candidateIds.add(`${cleanType}-${cleanType}-${strippedType}`);
    candidateIds.add(strippedType);
    candidateMediaIds.add(strippedType);
    candidateMediaIds.add(`${cleanType}-${strippedType}`);
  }

  // Normalized ID
  const norm = normalizeOverrideId(cleanType, rawIdStr);
  candidateIds.add(norm);
  candidateIds.add(norm.toLowerCase());

  // Stripped provider prefixes: kitsu-123, mal-123, tmdb-123, anime-123, tv-123, movie-123
  const prefixes = ["kitsu-", "mal-", "tmdb-", "anime-", "tv-", "movie-"];
  for (const p of prefixes) {
    if (strippedType.startsWith(p)) {
      const pureNum = strippedType.slice(p.length);
      if (pureNum) {
        candidateMediaIds.add(pureNum);
        candidateIds.add(`${cleanType}-${pureNum}`);
        candidateIds.add(pureNum);
      }
    }
  }

  // If ID is purely numeric (e.g. 50629), also check with kitsu- / mal- / tmdb-
  if (/^\d+$/.test(strippedType)) {
    candidateMediaIds.add(`kitsu-${strippedType}`);
    candidateMediaIds.add(`mal-${strippedType}`);
    candidateMediaIds.add(`tmdb-${strippedType}`);
    candidateIds.add(`${cleanType}-kitsu-${strippedType}`);
    candidateIds.add(`${cleanType}-mal-${strippedType}`);
    candidateIds.add(`${cleanType}-tmdb-${strippedType}`);
  }

  // Cross-mediaType fallback between anime and tv
  if (cleanType === "anime" || cleanType === "tv") {
    const otherType = cleanType === "anime" ? "tv" : "anime";
    for (const mId of Array.from(candidateMediaIds)) {
      candidateIds.add(`${otherType}-${mId}`);
    }
  }

  return {
    candidateIds: Array.from(candidateIds),
    candidateMediaIds: Array.from(candidateMediaIds),
  };
}

export async function getMediaOverride(
  mediaType: string,
  mediaId: string | number
): Promise<MediaOverride | null> {
  if (!mediaType || !mediaId) return null;
  try {
    const db = getDb();
    const { candidateIds, candidateMediaIds } = extractCandidateMediaIds(mediaType, mediaId);

    if (candidateIds.length === 0) return null;

    const override = await db.query.mediaOverrides.findFirst({
      where: or(
        inArray(mediaOverrides.id, candidateIds),
        inArray(mediaOverrides.mediaId, candidateMediaIds)
      ),
    });

    return override || null;
  } catch (error) {
    console.error("[Media Overrides] getMediaOverride Error:", error);
    return null;
  }
}

let cachedOverridesList: { list: MediaOverride[]; expiresAt: number } | null = null;
let cachedHiddenSet: { set: Set<string>; expiresAt: number } | null = null;

export function invalidateMediaOverridesCache(): void {
  cachedOverridesList = null;
  cachedHiddenSet = null;
}

export async function getAllMediaOverrides(): Promise<MediaOverride[]> {
  const now = Date.now();
  if (cachedOverridesList && cachedOverridesList.expiresAt > now) {
    return cachedOverridesList.list;
  }

  try {
    const db = getDb();
    const list = await db.query.mediaOverrides.findMany({
      orderBy: [desc(mediaOverrides.updatedAt)],
    });
    cachedOverridesList = { list, expiresAt: now + 5000 }; // 5s TTL memory cache
    return list;
  } catch (error) {
    console.error("[Media Overrides] getAllMediaOverrides Error:", error);
    return [];
  }
}

export async function getHiddenMediaSet(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedHiddenSet && cachedHiddenSet.expiresAt > now) {
    return cachedHiddenSet.set;
  }

  try {
    const db = getDb();
    const rows = await db.query.mediaOverrides.findMany({
      where: or(
        eq(mediaOverrides.isHidden, true),
        eq(mediaOverrides.status, "hidden")
      ),
      columns: {
        id: true,
        mediaType: true,
        mediaId: true,
      },
    });

    const set = new Set<string>();
    for (const r of rows) {
      if (r.id) set.add(r.id.toLowerCase().trim());
      if (r.mediaType && r.mediaId) {
        const cleanType = r.mediaType.toLowerCase().trim();
        const cleanId = String(r.mediaId).toLowerCase().trim();
        set.add(`${cleanType}-${cleanId}`);
        set.add(cleanId);
        if (cleanId.startsWith("kitsu-")) {
          set.add(cleanId.replace("kitsu-", ""));
        }
        if (cleanId.startsWith("mal-")) {
          set.add(cleanId.replace("mal-", ""));
        }
      }
    }

    cachedHiddenSet = { set, expiresAt: now + 5000 }; // 5s TTL cache
    return set;
  } catch (error) {
    console.error("[Media Overrides] getHiddenMediaSet Error:", error);
    return new Set<string>();
  }
}

export function isMediaItemHidden(
  item: { id?: string | number; media_type?: string; mediaType?: string; type?: string } | null | undefined,
  hiddenSet: Set<string>
): boolean {
  if (!item || !item.id || hiddenSet.size === 0) return false;
  const idStr = String(item.id).toLowerCase().trim();
  const mType = (item.media_type || item.mediaType || item.type || "movie").toLowerCase().trim();
  const compoundId = `${mType}-${idStr}`;

  if (hiddenSet.has(compoundId) || hiddenSet.has(idStr)) return true;
  if (idStr.startsWith("kitsu-") && hiddenSet.has(idStr.replace("kitsu-", ""))) return true;
  if (idStr.startsWith("mal-") && hiddenSet.has(idStr.replace("mal-", ""))) return true;
  return false;
}

export function filterHiddenItems<T extends { id?: string | number; media_type?: string; mediaType?: string; type?: string }>(
  items: T[],
  hiddenSet: Set<string>
): T[] {
  if (!Array.isArray(items) || hiddenSet.size === 0) return items;
  return items.filter((item) => !isMediaItemHidden(item, hiddenSet));
}

/**
 * Non-destructively overlays admin overrides on top of raw/default media data.
 */
export function applyMediaOverride<T extends Record<string, any>>(
  item: T | null | undefined,
  override: MediaOverride | null | undefined
): T | null {
  if (!item && !override) return null;

  // If item is null/failed from API, but an override exists (e.g. Upcoming/Unavailable synthetic entry)
  if (!item && override) {
    const syntheticTitle = override.customTitle || `Title (${override.mediaType} ${override.mediaId})`;
    const customTags = Array.isArray(override.customTags) ? override.customTags : [];
    const isUpcoming = Boolean(override.isUpcoming || override.status === "upcoming");
    const isUnavailable = Boolean(override.isUnavailable || override.status === "unavailable");
    const isHidden = Boolean(override.isHidden || override.status === "hidden");

    const syntheticItem = {
      id: isNaN(Number(override.mediaId)) ? override.mediaId : Number(override.mediaId),
      media_type: override.mediaType,
      mediaType: override.mediaType,
      type: override.mediaType,
      title: syntheticTitle,
      name: syntheticTitle,
      canonicalTitle: syntheticTitle,
      overview: override.customDescription || "",
      description: override.customDescription || "",
      synopsis: override.customDescription || "",
      poster_path: override.customPoster || null,
      poster: override.customPoster || null,
      backdrop_path: override.customBackdrop || null,
      backdrop: override.customBackdrop || null,
      bannerImage: override.customBackdrop || null,
      release_date: override.customReleaseDate || null,
      first_air_date: override.customReleaseDate || null,
      startDate: override.customReleaseDate || null,
      seasonYear: override.customReleaseDate ? parseInt(override.customReleaseDate.slice(0, 4), 10) || null : null,
      genres: (override.customGenres || []).map((g, i) => ({ id: i + 1, name: g })),
      customTags,
      tags: customTags,
      status: override.status || (isUpcoming ? "upcoming" : "default"),
      isUpcoming,
      isUnavailable,
      isHidden,
      notes: override.notes || null,
      totalEpisodes: 0,
      seasons: [],
      episodes: [],
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
    res.canonicalTitle = t;
  }

  // Override Description
  if (override.customDescription && override.customDescription.trim()) {
    const d = override.customDescription.trim();
    res.overview = d;
    res.description = d;
    res.synopsis = d;
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
    const yearParsed = parseInt(rd.slice(0, 4), 10);
    if (!isNaN(yearParsed)) {
      res.seasonYear = yearParsed;
    }
  }

  // Custom Tags / Badges
  const customTags = Array.isArray(override.customTags) ? override.customTags.filter(Boolean) : [];
  res.customTags = customTags;
  res.tags = customTags;

  // Status flags
  const isUpcoming = Boolean(override.isUpcoming || override.status === "upcoming");
  const isUnavailable = Boolean(override.isUnavailable || override.status === "unavailable");
  const isHidden = Boolean(override.isHidden || override.status === "hidden");

  res.isUpcoming = isUpcoming;
  res.isUnavailable = isUnavailable;
  res.isHidden = isHidden;
  res.status = override.status || res.status;
  res.overrideStatus = override.status;
  res.notes = override.notes || res.notes || null;
  res._override = override;

  return res as T;
}

/**
 * Batch-enriches a list of media items with overrides and removes hidden items.
 */
export async function enrichMediaListWithOverrides<T extends { id?: string | number; media_type?: string; mediaType?: string; type?: string }>(
  items: T[]
): Promise<T[]> {
  if (!Array.isArray(items) || items.length === 0) return items;

  try {
    const [overrides, hiddenSet] = await Promise.all([
      getAllMediaOverrides(),
      getHiddenMediaSet(),
    ]);

    if (overrides.length === 0 && hiddenSet.size === 0) {
      return items;
    }

    const overrideMap = new Map<string, MediaOverride>();
    for (const o of overrides) {
      if (o.id) overrideMap.set(o.id.toLowerCase().trim(), o);
      if (o.mediaType && o.mediaId) {
        const cleanType = o.mediaType.toLowerCase().trim();
        const cleanId = String(o.mediaId).toLowerCase().trim();
        overrideMap.set(`${cleanType}-${cleanId}`, o);
        overrideMap.set(cleanId, o);
        if (cleanId.startsWith("kitsu-")) overrideMap.set(cleanId.replace("kitsu-", ""), o);
        if (cleanId.startsWith("mal-")) overrideMap.set(cleanId.replace("mal-", ""), o);
      }
    }

    const results: T[] = [];
    for (const item of items) {
      if (isMediaItemHidden(item, hiddenSet)) continue;

      const mType = (item.media_type || item.mediaType || item.type || "movie").toLowerCase().trim();
      const idStr = String(item.id || "").toLowerCase().trim();
      const compoundKey = `${mType}-${idStr}`;
      const rawStripped = idStr.replace(/^(kitsu-|mal-|tmdb-|anime-|tv-|movie-)/, "");

      const ov =
        overrideMap.get(compoundKey) ||
        overrideMap.get(idStr) ||
        (rawStripped ? overrideMap.get(`${mType}-${rawStripped}`) || overrideMap.get(rawStripped) : null);

      if (ov?.isHidden || ov?.status === "hidden") continue;

      const enriched = ov ? (applyMediaOverride(item as any, ov) as T) : item;
      results.push(enriched);
    }

    return results;
  } catch (err) {
    console.error("[Media Overrides] enrichMediaListWithOverrides Error:", err);
    return items;
  }
}

