export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { fetchEpisodesFromJikan, fetchEpisodesFromJikanPage, getAnimeDetails, fetchEpisodesFromAniZip, fetchEpisodesFromTatakai, fetchEpisodesFromKitsu, fetchFillerLookupFromAnimeFillerList, resolveTmdbMappingFromAniZip, DEFAULT_FETCH_USER_AGENT } from "@/lib/anime-fetch";
import { tmdbFetch, fetchTmdbEpisodeData, searchTmdbShow } from "@/lib/tmdb";

// An episode only counts as "real" if it carries actual metadata — a specific
// title (not the generic "Episode N"), thumbnail, description, or MAL url.
// Some fallbacks (Kitsu) return bare episode-number cards for brand-new shows,
// which are effectively placeholders and should NOT block the TMDB fallback.
function episodeHasRealMetadata(ep: any): boolean {
  if (!ep) return false;
  if (ep.isPlaceholder) return false;
  if (ep.malUrl || ep.thumbnail || ep.description) return true;
  if (ep.title && ep.title !== `Episode ${ep.episodeNum}`) return true;
  return false;
}

interface TmdbSeasonMin {
  season_number: number;
  episode_count: number;
}

function mapRelativeToTmdb(
  relativeEpNum: number,
  startSeasonNum: number,
  tmdbSeasonsList: TmdbSeasonMin[]
): { seasonNumber: number; episodeNumber: number } {
  // If the start season doesn't exist in TMDB, use it directly
  // rather than accidentally counting from the first TMDB season.
  const hasStartSeason = tmdbSeasonsList.some(s => s.season_number === startSeasonNum);
  if (!hasStartSeason) {
    return { seasonNumber: startSeasonNum, episodeNumber: relativeEpNum };
  }

  let remaining = relativeEpNum;
  let foundStart = false;

  for (const s of tmdbSeasonsList) {
    if (s.season_number === startSeasonNum) {
      foundStart = true;
    }
    if (!foundStart) continue;

    const count = s.episode_count || 0;
    if (remaining <= count) {
      return { seasonNumber: s.season_number, episodeNumber: remaining };
    }
    remaining -= count;
  }

  if (tmdbSeasonsList.length > 0) {
    const last = tmdbSeasonsList[tmdbSeasonsList.length - 1];
    return { seasonNumber: last.season_number, episodeNumber: remaining + (last.episode_count || 0) };
  }

  return { seasonNumber: startSeasonNum, episodeNumber: relativeEpNum };
}

function parseSeasonAndOffsetFromTitle(title: string): { tmdbSeason: number; episodeOffset: number } {
  if (!title) return { tmdbSeason: 1, episodeOffset: 0 };
  const lower = title.toLowerCase();

  // 1. Detect Season number from generic patterns: "Season X", "SX", "Xth Season", "Final Season"
  let seasonNum = 1;
  const seasonMatch = 
    lower.match(/(?:season|s)\s*(\d+)/i) || 
    lower.match(/(\d+)(?:st|nd|rd|th)\s*season/i);

  if (seasonMatch && seasonMatch[1]) {
    seasonNum = parseInt(seasonMatch[1], 10) || 1;
  } else if (lower.includes("final season")) {
    seasonNum = 4;
  }

  // 2. Detect Part / Cour / Arc numbers: "Part X", "Cour X"
  const partMatch = lower.match(/(?:part|cour)\s*(\d+)/i);
  let partNum = partMatch && partMatch[1] ? parseInt(partMatch[1], 10) : 1;

  // 3. If NO "Season X" was in the title but "Part X" / "Cour X" WAS in the title:
  // The Part/Cour number acts as the TMDB Season number (e.g. Part 2 = S2, Part 3 = S3, Part 4 = S4)
  if (!seasonMatch && !lower.includes("final season") && partMatch && partNum > 1) {
    seasonNum = partNum;
    partNum = 1;
  }

  // 4. Calculate episode offset for multi-part single seasons (e.g. Season 3 Part 2)
  let episodeOffset = 0;
  if (partNum > 1) {
    if (seasonNum === 4 && partNum === 2) {
      episodeOffset = 16;
    } else if (seasonNum === 4 && partNum >= 3) {
      episodeOffset = partNum === 3 ? 28 : 29;
    } else {
      episodeOffset = (partNum - 1) * 12;
    }
  }

  return { tmdbSeason: seasonNum, episodeOffset };
}

function enrichEpisodeReleaseStatus(episodes: any[], meta: any, season?: any): any[] {
  const nowMs = Date.now();
  const currentYear = new Date().getFullYear();

  const isSeasonFinished = season?.status === "FINISHED" || season?.status === "FINISHED_AIRING" || meta?.anime?.status === "FINISHED";
  const nextAiringEpNum = !isSeasonFinished ? (meta?.anime?.nextAiringEpisode?.episode || null) : null;
  const isNotYetReleased = !isSeasonFinished && (meta?.anime?.status === "NOT_YET_RELEASED" || season?.status === "NOT_YET_RELEASED");

  let seasonIsUpcoming = isNotYetReleased || Boolean(!isSeasonFinished && season?.seasonYear && season.seasonYear > currentYear);

  let encounteredUnreleased = false;
  return episodes.map((ep: any) => {
    let isReleased = ep.isReleased !== false;

    if (isSeasonFinished) {
      isReleased = true;
    } else if (seasonIsUpcoming) {
      isReleased = false;
    } else if (nextAiringEpNum && typeof ep.episodeNum === "number" && ep.episodeNum >= nextAiringEpNum) {
      isReleased = false;
    } else if (ep.releasedDate) {
      const epDateMs = new Date(ep.releasedDate).getTime();
      if (!isNaN(epDateMs) && epDateMs > nowMs) {
        isReleased = false;
      }
    }

    if (encounteredUnreleased) {
      isReleased = false;
    }

    if (!isReleased) {
      encounteredUnreleased = true;
    }

    return {
      ...ep,
      isReleased,
    };
  });
}

function isAnimeSeasonFinished(season: any, meta?: any): boolean {
  // Primary: explicit FINISHED status on the anime record from AniList
  if (meta?.anime?.status === "FINISHED" || meta?.anime?.status === "FINISHED_AIRING") return true;
  // Secondary: season-level status (not always populated, but check anyway)
  if (season?.status === "FINISHED" || season?.status === "FINISHED_AIRING") return true;
  // Tertiary: if AniList totalEpisodes is set AND the season has a non-airing status
  const status = (meta?.anime?.status || "").toUpperCase();
  const isAiringNow = status === "RELEASING" || status === "AIRING" || status === "NOT_YET_RELEASED";
  if (!isAiringNow && season?.totalEpisodes && season.totalEpisodes > 0 && season.totalEpisodes < 1499) {
    // Season has a known finite episode count and is not currently airing
    return true;
  }
  return false;
}

function cleanAndCapSeasonEpisodes(episodes: any[], season: any, meta?: any): any[] {
  if (!episodes || episodes.length === 0) return [];

  const isMovie = (season?.seasonLabel || "").startsWith("Movie") ||
    meta?.anime?.format === "MOVIE" || meta?.anime?.type === "MOVIE" || meta?.anime?.subtype === "MOVIE";

  if (isMovie) {
    const firstEp = episodes[0];
    return [{
      ...firstEp,
      episodeNum: 1,
      title: (firstEp.title && firstEp.title !== "Episode 1") ? firstEp.title : (season?.name || meta?.anime?.name || "Complete Movie"),
      description: firstEp.description || meta?.anime?.description || null,
      thumbnail: firstEp.thumbnail || meta?.anime?.poster || null,
    }];
  }

  // knownEpisodeCount: the DEFINITIVE episode count for this specific season from AniList.
  // This is the single source of truth — if it's set, NOTHING else overrides it.
  const knownEpisodeCount = season?.totalEpisodes && season.totalEpisodes > 0 && season.totalEpisodes < 1499 ? season.totalEpisodes : null;
  const isSpecial = ["OVA", "Special"].some(t =>
    (season?.seasonLabel || "").startsWith(t) || (season?.name || "").includes(t)
  );
  const isFinished = isAnimeSeasonFinished(season, meta);

  let result = [...episodes];

  // RULE A: If we have a definitive episode count, always cap to it.
  // This is the PRIMARY defense against season bleeding.
  if (knownEpisodeCount && knownEpisodeCount > 0) {
    result = result.filter((ep: any) => ep.episodeNum <= knownEpisodeCount);
  } else if (isSpecial) {
    // Specials: default to 1 unless an explicit count was specified
    result = result.filter((ep: any) => ep.episodeNum <= 1);
  }

  // RULE C+E: For finished seasons, also purge any placeholder episodes beyond real episodes.
  // A finished season should NEVER show placeholder cards.
  if (isFinished) {
    // Identify episodes that have actual metadata (title, thumbnail, description, date, or malUrl)
    const realEps = result.filter((ep: any) =>
      !ep.isPlaceholder &&
      (ep.releasedDate ||
        (ep.title && ep.title !== `Episode ${ep.episodeNum}`) ||
        ep.thumbnail ||
        ep.description ||
        ep.malUrl)
    );
    if (realEps.length > 0) {
      const maxRealEpNum = Math.max(...realEps.map((e: any) => e.episodeNum));
      // maxAllowed: never exceed knownEpisodeCount, but also never exceed last real episode
      const maxAllowed = knownEpisodeCount
        ? Math.min(knownEpisodeCount, maxRealEpNum)
        : maxRealEpNum;
      result = result.filter((ep: any) => ep.episodeNum <= maxAllowed);
    } else if (knownEpisodeCount) {
      // No real episodes found at all but we know how many exist — keep up to known count
      // (don't strip everything; the season may just have no external metadata yet)
      result = result.filter((ep: any) => ep.episodeNum <= knownEpisodeCount);
    }
  }

  return result;
}

// Robust helper to consolidate and enrich episode lists from AniZip, Jikan, Tatakai, and Kitsu
async function getEnrichedEpisodesList(
  seasonId: string,
  seasonName: string,
  totalEpisodes: number,
  idMal: number | string | null
): Promise<any[]> {
  let seasonEps: any[] = [];

  // Strip parenthetical suffixes (e.g. "(Japanese Dub)") from the season name so that
  // the filler slug matches animefillerlist.com correctly. This suffix is appended by
  // curated franchise definitions and is not part of the real anime title.
  const cleanSeasonName = seasonName.replace(/\s*\([^)]*\)\s*/g, "").trim() || seasonName;

  // Resolve MAL ID if not provided — needed for Jikan API filler data
  if (!idMal) {
    try {
      const azRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${seasonId}`, {
        signal: AbortSignal.timeout(2000),
        headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
        next: { revalidate: 86400 } as any,
      });
      if (azRes.ok) {
        const azData = await azRes.json();
        if (azData?.mappings?.mal_id) {
          idMal = azData.mappings.mal_id;
        }
      }
    } catch {}
  }

  // 1, 2 & 3. Try AniZip, Jikan, and Tatakai in parallel.
  // Filler lookup is deliberately NOT awaited here — it scrapes a 3rd party website
  // (animefillerlist.com) which is slow and unreliable. Running it in parallel with
  // a short timeout ensures it never blocks episode delivery.
  const fillerTimeout = new Promise<null>(r => setTimeout(() => r(null), 1200));
  const fillerFetchPromise = fetchFillerLookupFromAnimeFillerList(cleanSeasonName);

  const [aniZipEpsRes, jikanEpsRes, tatakaiEpsRes] = await Promise.allSettled([
    fetchEpisodesFromAniZip(seasonId, totalEpisodes),
    idMal ? fetchEpisodesFromJikan(idMal, seasonId, totalEpisodes) : Promise.resolve([]),
    fetchEpisodesFromTatakai(seasonId, totalEpisodes),
  ]);

  const aniZipEps = aniZipEpsRes.status === 'fulfilled' ? aniZipEpsRes.value : [];
  const jikanEps = jikanEpsRes.status === 'fulfilled' ? jikanEpsRes.value : [];
  const tatakaiEps = tatakaiEpsRes.status === 'fulfilled' ? tatakaiEpsRes.value : [];

  if (aniZipEps && aniZipEps.length > 0) {
    seasonEps = aniZipEps;
  } else if (jikanEps && jikanEps.length > 0) {
    seasonEps = jikanEps;
  } else if (tatakaiEps && tatakaiEps.length > 0) {
    seasonEps = tatakaiEps;
  }

  // Kitsu fallback — only if primary sources failed
  if (seasonEps.length === 0) {
    try {
      const kitsuEps = await fetchEpisodesFromKitsu(seasonName, totalEpisodes);
      if (kitsuEps && kitsuEps.length > 0) {
        seasonEps = kitsuEps;
        console.log(`[EpisodesList] Kitsu fallback succeeded for "${seasonName}" with ${kitsuEps.length} episodes`);
      }
    } catch { /* kitsu failed too */ }
  }

  // Collect the filler result (race against timeout so we don't block)
  const fillerLookup = await Promise.race([fillerFetchPromise, fillerTimeout]);

  // Cross-merge thumbnails, descriptions, and titles across sources
  const primarySrcName = seasonEps === aniZipEps ? aniZipEps
    : seasonEps === jikanEps ? jikanEps
    : seasonEps === tatakaiEps ? tatakaiEps
    : null;
  const secondarySources = [jikanEps, tatakaiEps, aniZipEps]
    .filter((s): s is any[] => Array.isArray(s) && s.length > 0 && s !== primarySrcName);
  if (seasonEps.length > 0) {
    // Merge metadata from secondary sources
    for (const src of secondarySources) {
      seasonEps = seasonEps.map((ep) => {
        const match = src.find(s => s && s.episodeNum === ep.episodeNum);
        const isGenericTitle = !ep.title || ep.title === `Episode ${ep.episodeNum}`;
        const epThumbIsCover = ep.thumbnail && (ep.thumbnail.includes("/cover/") || ep.thumbnail.includes("/banner/") || /\/bx\d+[-]/.test(ep.thumbnail));
        const matchThumbIsCover = match?.thumbnail && (match.thumbnail.includes("/cover/") || match.thumbnail.includes("/banner/") || /\/bx\d+[-]/.test(match.thumbnail));
        const epThumb = !epThumbIsCover ? ep.thumbnail : null;
        const matchThumb = !matchThumbIsCover ? match?.thumbnail : null;
        return {
          ...ep,
          title: isGenericTitle && match?.title ? match.title : ep.title,
          thumbnail: epThumb || matchThumb || null,
          description: ep.description || match?.description || null,
          isFiller: ep.isFiller || match?.isFiller || false,
        };
      });
    }
    // Apply filler lookup as a final pass so it can set filler on episodes that
    // no API source flagged (e.g., AniZip doesn't provide filler data at all).
    const fillerLookupValid = fillerLookup != null &&
      (fillerLookup.filler.size + fillerLookup.mixed.size) >= Math.max(totalEpisodes * 0.1, 3);
    if (fillerLookupValid) {
      seasonEps = seasonEps.map((ep) => ({
        ...ep,
        isFiller: ep.isFiller || fillerLookup.filler.has(ep.episodeNum),
      }));
    }
  }

  // LAST RESORT: only generate placeholder episodes if every real source failed
  if (!seasonEps || seasonEps.length === 0) {
    console.warn(`[EpisodesList] All sources failed for "${seasonName}" (id=${seasonId}). Using placeholder episodes as last resort.`);
    const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => seasonName?.includes(t));
    const count = isSpecialFormat ? 1 : (totalEpisodes && totalEpisodes > 0 ? totalEpisodes : 3);
    for (let i = 1; i <= count; i++) {
      seasonEps.push({
        episodeId: `${seasonId}-${i}`,
        episodeNum: i,
        title: i === 1 && isSpecialFormat ? seasonName : `Episode ${i}`,
        description: null,
        thumbnail: null,
        malUrl: null,
        isFiller: false,
        releasedDate: null,
        isPlaceholder: true, // Flag so client knows this is fallback data
        seasonId: seasonId,
        seasonName: seasonName,
        seasonMalId: idMal || null,
      });
    }
  }

  return seasonEps;
}

import { getMediaOverride } from "@/lib/media-overrides";

interface EpisodesCacheEntry {
  data: { episodes: any[]; totalEpisodes: number };
  timestamp: number;
}
const EPISODES_CACHE = new Map<string, EpisodesCacheEntry>();
const EPISODES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function invalidateEpisodesCache(animeId?: string | number): void {
  if (!animeId) {
    EPISODES_CACHE.clear();
  } else {
    const idStr = String(animeId).toLowerCase();
    for (const key of Array.from(EPISODES_CACHE.keys())) {
      if (key.toLowerCase().includes(idStr)) {
        EPISODES_CACHE.delete(key);
      }
    }
  }
}

const animeCacheHeaders = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  "Cloudflare-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const seasonMalId = searchParams.get("seasonMalId") || null;
  const seasonId = searchParams.get("seasonId") || null;
  const seasonNumParam = parseInt(searchParams.get("seasonNum") || "", 10);
  const batchSize = 100;

  try {
    const targetOverrideId = seasonId || id;
    const override = await getMediaOverride("anime", targetOverrideId).catch(() => null);
    if (override?.isHidden || override?.status === "hidden") {
      return Response.json({ success: true, data: { episodes: [], isHidden: true } }, { headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" } });
    }
    if (override?.isUpcoming || override?.status === "upcoming") {
      return Response.json({ success: true, data: { episodes: [], isUpcoming: true, status: "upcoming" } }, { headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" } });
    }
    if (override?.isUnavailable || override?.status === "unavailable") {
      return Response.json({ success: true, data: { episodes: [], isUnavailable: true, status: "unavailable" } }, { headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" } });
    }

    const cacheKey = `${id}-${seasonId || "root"}-${page}-${searchParams.toString()}`;
    const cached = EPISODES_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < EPISODES_CACHE_TTL) {
      return Response.json({ success: true, data: cached.data }, { headers: animeCacheHeaders });
    }

    let season: any = null;
    let meta: any = null;
    let seasonNumFromList = 1;

    // ── Lazy-load more episodes for a season (pagination) ──────────────────
    if (seasonMalId && page > 1) {
      const newEps = await fetchEpisodesFromJikanPage(seasonMalId, seasonId || id, page, batchSize);
      const resPayload = {
        success: true,
        data: { episodes: newEps, totalEpisodes: 0 },
      };
      return Response.json(resPayload, { headers: animeCacheHeaders });
    }


    // ── Fetch a specific season's episodes by its AniList ID ───────────────
    if (seasonId) {
      const tmdbIdParam = searchParams.get("tmdbId");
      const tmdbSeasonParam = searchParams.get("tmdbSeason");
      const episodeOffsetParam = searchParams.get("episodeOffset");

      // Parse client params — note: tmdbSeason=1 and episodeOffset=0 are valid and must NOT be skipped!
      const clientTmdbId = tmdbIdParam != null ? parseInt(tmdbIdParam, 10) : null;
      const clientTmdbSeasonNum = tmdbSeasonParam != null ? parseInt(tmdbSeasonParam, 10) : null;
      const clientEpisodeOffset = episodeOffsetParam != null ? parseInt(episodeOffsetParam, 10) : null;

      // When all mapping params are provided by client, we don't need to derive them from meta.
      // This is the fast path and avoids the AniZip cold-start race condition on Cloudflare edge.
      const allParamsProvided = clientTmdbId != null && !isNaN(clientTmdbId) &&
                                clientTmdbSeasonNum != null && !isNaN(clientTmdbSeasonNum) &&
                                clientEpisodeOffset != null && !isNaN(clientEpisodeOffset);

      if (allParamsProvided) {
        // Fast path: trust client params, fetch meta only for supplementary data (name, idMal, totalEpisodes)
        console.log(`[Episodes API] Fast path: all params provided. seasonId=${seasonId}, tmdbId=${clientTmdbId}, tmdbSeason=${clientTmdbSeasonNum}, offset=${clientEpisodeOffset}`);
        meta = await getAnimeDetails(seasonId, 1500, true).catch(() => null);
        if (!meta) {
          meta = await getAnimeDetails(id, 1500, true).catch(() => null);
        }

        const foundInMeta = meta?.seasons?.find((s: any) => s.id === seasonId);
        season = {
          id: seasonId,
          name: foundInMeta?.name || meta?.anime?.name || "Unknown",
          seasonLabel: foundInMeta?.seasonLabel || "Episodes",
          totalEpisodes: foundInMeta?.totalEpisodes || meta?.totalEpisodes || 12,
          isCurrent: true,
          idMal: foundInMeta?.idMal ?? (meta?.anime?.idMal ? parseInt(meta.anime.idMal, 10) : null),
          tmdbId: clientTmdbId,
          tmdbSeasonNumber: clientTmdbSeasonNum,
          episodeOffset: clientEpisodeOffset,
        };

        if (meta?.seasons) {
          const idx = meta.seasons.findIndex((s: any) => s.id === seasonId);
          seasonNumFromList = idx >= 0 ? idx + 1 : 1;
        }
      } else {
        // Slow path: derive mapping data from meta lookup.
        // KEY FIX: When seasonId is provided AND differs from the page id,
        // fetch the season's OWN details directly (avoids full franchise BFS
        // traversal from the parent id and prevents wrong-season mapping on
        // Cloudflare cold starts).
        console.log(`[Episodes API] Slow path: fetching full meta for seasonId=${seasonId}, anime id=${id}`);
        
        // First try to get the season's own metadata directly
        let directSeasonMeta: any = null;
        if (seasonId && seasonId !== id) {
          console.log(`[Episodes API] Fetching direct season meta for seasonId=${seasonId}`);
          directSeasonMeta = await getAnimeDetails(seasonId, 1500, true).catch(() => null);
        }

        meta = directSeasonMeta || await getAnimeDetails(id, 1500, true);
        if (!meta) {
          console.error(`[Episodes API] getAnimeDetails returned null for id=${id}`);
          throw new Error("Anime not found");
        }

        // Look for the season in the meta — prefer direct season meta first
        season = meta.seasons?.find((s: any) => String(s.id) === String(seasonId));
        
        // If still not found and we have a direct season meta, use its first season
        if (!season && directSeasonMeta) {
          const directSeason = directSeasonMeta.seasons?.find((s: any) => String(s.id) === String(seasonId))
            || directSeasonMeta.seasons?.[0];
          if (directSeason) season = directSeason;
        }

        // Fuzzy match if seasonId has a prefix like kitsu- or mal-
        if (!season && meta.seasons && meta.seasons.length > 0) {
          const cleanTarget = String(seasonId).replace(/^(kitsu-|mal-|tmdb-)/, "");
          season = meta.seasons.find((s: any) => String(s.id).replace(/^(kitsu-|mal-|tmdb-)/, "") === cleanTarget)
            || meta.seasons.find((s: any) => s.isCurrent)
            || meta.seasons[0];
        }
        
        console.log(`[Episodes API] Season lookup: found=${!!season}, seasons:`, meta.seasons?.map((s: any) => ({ id: s.id, label: s.seasonLabel, tmdbSeason: s.tmdbSeasonNumber, offset: s.episodeOffset })));

        if (!season) {
          console.warn(`[Episodes API] Season ${seasonId} not found in any meta result`);
          return Response.json({ success: true, data: { episodes: [], totalEpisodes: 0 } }, { headers: animeCacheHeaders });
        }

        const idx = meta.seasons.findIndex((s: any) => String(s.id) === String(season.id));
        seasonNumFromList = idx >= 0 ? idx + 1 : 1;
      }

      // Client params always win over server-derived values
      let tmdbId = clientTmdbId ?? (season as any).tmdbId;
      let tmdbSeasonNum = clientTmdbSeasonNum ?? season.tmdbSeasonNumber;
      let episodeOffset = clientEpisodeOffset ?? (season as any).episodeOffset ?? 0;

      // Slow-path TMDB recovery: when the meta lookup came back without TMDB
      // mapping (e.g. AniList unreachable on Cloudflare edge → Jikan fallback),
      // resolve the mapping directly from AniZip so TMDB stays the primary
      // thumbnail source. AniZip is reliable on the edge, and its ep-1 mapping
      // gives us the TMDB season + offset for the whole season.
      if (tmdbId == null || tmdbSeasonNum == null || isNaN(tmdbSeasonNum)) {
        try {
          const resolved = await resolveTmdbMappingFromAniZip(season.id);
          if (resolved) {
            console.log(`[Episodes API] Recovered TMDB mapping from AniZip for seasonId=${season.id}: tmdbId=${resolved.tmdbId}, tmdbSeason=${resolved.tmdbSeason}, offset=${resolved.episodeOffset}`);
            if (tmdbId == null) tmdbId = resolved.tmdbId;
            if (tmdbSeasonNum == null || isNaN(tmdbSeasonNum)) tmdbSeasonNum = resolved.tmdbSeason;
            if (clientEpisodeOffset == null && ((season as any).episodeOffset == null || (season as any).episodeOffset === undefined)) {
              episodeOffset = resolved.episodeOffset;
            }
          }
        } catch { /* keep whatever we have */ }
      }

      // Smart season & offset title parsing override — fixes season mismatching
      if ((!tmdbSeasonNum || tmdbSeasonNum === 1) && (season.name || meta?.anime?.name)) {
        const titleToParse = season.name || meta?.anime?.name || "";
        const parsed = parseSeasonAndOffsetFromTitle(titleToParse);
        if (parsed.tmdbSeason > 1 || parsed.episodeOffset > 0) {
          tmdbSeasonNum = parsed.tmdbSeason;
          episodeOffset = parsed.episodeOffset;
          console.log(`[Episodes API] Overrode TMDB mapping from title "${titleToParse}": tmdbSeason=${tmdbSeasonNum}, offset=${episodeOffset}`);
        }
      }

      console.log(`[Episodes API] Using mapping details: tmdbId=${tmdbId}, tmdbSeasonNum=${tmdbSeasonNum}, episodeOffset=${episodeOffset}`);

      const isTMDBReady = tmdbId != null && !isNaN(tmdbId) && tmdbSeasonNum != null && !isNaN(tmdbSeasonNum);

      let seasonEps: any[] = [];
      let seasonOverview: string | null = null;

      const isMovieOrSpecial = ["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t)) ||
        meta?.anime?.format === "MOVIE" || meta?.anime?.type === "MOVIE" ||
        meta?.anime?.subtype === "MOVIE" || (season?.totalEpisodes === 1 && season.seasonLabel?.toLowerCase().includes("movie"));
      const safeTotalEpisodes = isMovieOrSpecial ? 1 : Math.max(season.totalEpisodes && season.totalEpisodes < 1499 ? season.totalEpisodes : 0, 1);

      console.log(`[Episodes API] TMDB ready: ${isTMDBReady}, tmdbId: ${tmdbId}, tmdbSeasonNum: ${tmdbSeasonNum}, totalEpisodes: ${safeTotalEpisodes}, isMovieOrSpecial: ${isMovieOrSpecial}`);

      if (isTMDBReady && !isMovieOrSpecial) {
        // ── TMDB is the source of truth for episodes ─────────────────────
        const tmdbShowPromise = tmdbFetch(`/tv/${tmdbId}`).catch(e => {
          console.error(`[Episodes API] TMDB show fetch failed for tmdbId=${tmdbId}:`, e);
          return null;
        });

        // Get overlay data using our enriched helper in parallel
        const overlayEpsPromise = getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes, season.idMal || null);

        const showData = await tmdbShowPromise;

        let tmdbSeasonsList: TmdbSeasonMin[] = [];
        if ((showData as any)?.seasons) {
          tmdbSeasonsList = (showData as any).seasons
            .filter((s: any) => s.season_number > 0)
            .sort((a: any, b: any) => a.season_number - b.season_number);
          console.log(`[Episodes API] TMDB show seasons:`, tmdbSeasonsList);
        } else if (showData === undefined || showData === null) {
          // fetch failed, caught above
        } else {
          console.warn(`[Episodes API] TMDB show data has no seasons for tmdbId=${tmdbId}`);
        }

        // Calculate needed TMDB seasons early based on mapRelativeToTmdb
        let dynamicTotalEpisodes = isMovieOrSpecial ? 1 : safeTotalEpisodes;
        // True episode count from AniList (null if unknown/airing with no count)
        const knownEpisodeCount = season.totalEpisodes && season.totalEpisodes < 1499 ? season.totalEpisodes : null;
        // Is this season finished (FINISHED status)?
        const isSeasonFinished = season.status === "FINISHED" || (meta?.anime?.status === "FINISHED");
        if (tmdbSeasonsList.length > 0) {
          const currentTmdbSeason = tmdbSeasonsList.find((s: any) => s.season_number === (tmdbSeasonNum || 1));
          const nextSeasonInTMDB = (meta?.seasons || []).find((s: any) =>
            s.tmdbSeasonNumber === (tmdbSeasonNum || 1) &&
            (s.episodeOffset || 0) > episodeOffset &&
            s.totalEpisodes > 2 // Ignore OVAs and specials when clamping
          );

          // CRITICAL FIX: Only count episodes in the CURRENT TMDB season, minus our offset.
          const currentTmdbSeasonEpCount = currentTmdbSeason ? Math.max((currentTmdbSeason.episode_count || 0) - episodeOffset, 0) : 0;

          if (knownEpisodeCount) {
            // AniList has a definitive count — this is always the ceiling, PERIOD.
            dynamicTotalEpisodes = knownEpisodeCount;
          } else if (nextSeasonInTMDB) {
            // The next AniList season also maps to the same TMDB season — clamp to that boundary
            dynamicTotalEpisodes = (nextSeasonInTMDB.episodeOffset || 0) - episodeOffset;
          } else if (currentTmdbSeasonEpCount > 0) {
            // Use only the current TMDB season's episode count
            dynamicTotalEpisodes = Math.max(currentTmdbSeasonEpCount, safeTotalEpisodes);
          }
          // Absolute safety cap: never return more than 1500 episodes at once
          dynamicTotalEpisodes = Math.min(Math.max(dynamicTotalEpisodes, 1), 1500);
        }

        const neededSeasons = new Set<number>();
        // Always start mapping from the tmdbSeasonNum for this AniList season.
        // episodeOffset is the 0-based index of this season's first episode WITHIN the TMDB season
        // (e.g., AoT S3P2 ep1 = TMDB S3E13, so episodeOffset=12, tmdbSeasonNum=3).
        // Starting from TMDB season 1 would incorrectly count from the very beginning of the show.
        const startSeason = tmdbSeasonNum || 1;
        for (let i = 1; i <= dynamicTotalEpisodes; i++) {
          const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
          neededSeasons.add(mapped.seasonNumber);
        }

        const seasonNumbers = Array.from(neededSeasons);
        console.log(`[Episodes API] Needed TMDB seasons:`, seasonNumbers);
        
        // Fetch TMDB episodes in parallel with the still-running overlayEpsPromise
        const tmdbEpisodesPromise = seasonNumbers.length > 0
          ? fetchTmdbEpisodeData(tmdbId, seasonNumbers)
          : Promise.resolve(new Map<string, any>());

        const [overlayEps, tmdbEpisodes] = await Promise.all([overlayEpsPromise, tmdbEpisodesPromise]);
        
        console.log(`[Episodes API] Overlay episodes count: ${overlayEps.length}`);
        console.log(`[Episodes API] TMDB episodes fetched count: ${tmdbEpisodes.size}`);

        // If TMDB returned no data, fall back to overlay episodes
        if (tmdbEpisodes.size === 0) {
          console.warn(`[Episodes API] TMDB returned no episodes, falling back to overlay data`);
          
          // Fallback retry block (only runs when TMDB fails)
          if (overlayEps.length === 0 && safeTotalEpisodes > 0) {
            console.log(`[Episodes API] Overlay also empty! Retrying AniZip/Jikan...`);
            // NOTE: No sleep here — 2-second sleeps waste Cloudflare edge time budget.
            try {
              const aniZipEps = await fetchEpisodesFromAniZip(season.id, safeTotalEpisodes);
              if (aniZipEps && aniZipEps.length > 0) overlayEps.push(...aniZipEps);
            } catch { /* ignore */ }

            // Resolve the MAL ID for Jikan — season.idMal can be null when getAnimeDetails
            // timed out during a Cloudflare Edge cold start (AniZip 3s timeout fires).
            // In that case, fetch the AniZip mapping directly here to recover mal_id.
            let effectiveMalId: number | string | null = season.idMal;
            if (overlayEps.length === 0 && !effectiveMalId) {
              try {
                const azMapRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${season.id}`, {
                  signal: AbortSignal.timeout(8000),
                  headers: { "User-Agent": DEFAULT_FETCH_USER_AGENT },
                });
                if (azMapRes.ok) {
                  const azMap = await azMapRes.json();
                  if (azMap?.mappings?.mal_id) {
                    effectiveMalId = azMap.mappings.mal_id;
                    console.log(`[Episodes API] Recovered mal_id=${effectiveMalId} from AniZip for seasonId=${season.id}`);
                  }
                }
              } catch { /* ignore */ }
            }

            if (overlayEps.length === 0 && effectiveMalId) {
              try {
                const jikanEps = await fetchEpisodesFromJikan(effectiveMalId, season.id, safeTotalEpisodes);
                if (jikanEps && jikanEps.length > 0) overlayEps.push(...jikanEps);
              } catch { /* ignore */ }
            }

            if (overlayEps.length === 0) {
              try {
                const tatakaiEps = await fetchEpisodesFromTatakai(season.id, safeTotalEpisodes);
                if (tatakaiEps && tatakaiEps.length > 0) overlayEps.push(...tatakaiEps);
              } catch { /* ignore */ }
            }
          }
          
          // Kitsu fallback block (only runs if AniZip/Jikan still lack thumbnails or are empty)
          const stillLacksMetadata = overlayEps.length === 0 || overlayEps.some(e => !e.thumbnail || !e.description);
          if (stillLacksMetadata) {
            try {
              const kitsuEps = await fetchEpisodesFromKitsu(season.name, safeTotalEpisodes);
              if (kitsuEps && kitsuEps.length > 0) {
                if (overlayEps.length === 0) {
                   overlayEps.push(...kitsuEps);
                } else {
                   overlayEps.forEach(ep => {
                     const kEp = kitsuEps.find(ke => ke.episodeNum === ep.episodeNum);
                     if (kEp) {
                       ep.thumbnail = ep.thumbnail || kEp.thumbnail || null;
                       ep.description = ep.description || kEp.description || null;
                     }
                   });
                }
              }
            } catch { /* ignore */ }
          }
          
          if (overlayEps.length > 0) {
          seasonEps = overlayEps.map((ep) => ({
            episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
            episodeNum: ep.episodeNum,
            title: ep.title || `Episode ${ep.episodeNum}`,
            thumbnail: ep.thumbnail || null,
            malUrl: ep.malUrl || null,
            isFiller: ep.isFiller || false,
            releasedDate: ep.releasedDate || null,
            description: ep.description || null,
            seasonNum: seasonNumFromList,
            seasonId: season.id,
            seasonMalId: season.idMal || null,
          }));
          }
        }

        // Build episodes from TMDB, overlay AniZip/Jikan data (only if TMDB data was available)
        if (tmdbEpisodes.size > 0) {
          for (let i = 1; i <= dynamicTotalEpisodes; i++) {
            const matchEp = overlayEps.find(j => j.episodeNum === i);
            
            const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
            const tmdbSeason = mapped.seasonNumber;
            const tmdbEpisode = mapped.episodeNumber;

            const tmdbEp = tmdbEpisodes.get(`${tmdbSeason}-${tmdbEpisode}`)
              || tmdbEpisodes.get(`abs-${episodeOffset + i}`)
              || tmdbEpisodes.get(`abs-${i}`)
              || tmdbEpisodes.get(`${tmdbSeason}-rel-${tmdbEpisode}`);
            
            const isMatchThumbCover = matchEp?.thumbnail && (matchEp.thumbnail.includes("/cover/") || matchEp.thumbnail.includes("/banner/") || /\/bx\d+[-]/.test(matchEp.thumbnail));
            const validMatchThumb = !isMatchThumbCover ? matchEp?.thumbnail : null;

            seasonEps.push({
              episodeId: matchEp?.episodeId || `${season.id}-${i}`,
              episodeNum: i,
              title: tmdbEp?.title || matchEp?.title || `Episode ${i}`,
              thumbnail: tmdbEp?.thumbnail || validMatchThumb || null,
              malUrl: matchEp?.malUrl || null,
              isFiller: matchEp?.isFiller || false,
              releasedDate: tmdbEp?.air_date || matchEp?.releasedDate || null,
              description: tmdbEp?.description || matchEp?.description || null,
              vote_average: tmdbEp?.vote_average,
              vote_count: tmdbEp?.vote_count,
              runtime: tmdbEp?.runtime,
              seasonNum: seasonNumFromList,
              seasonId: season.id,
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
          }

          // If overlayEps (AniZip/Jikan/Tatakai) contains extra episodes beyond TMDB count, append them (strictly capped to knownEpisodeCount or 1 for specials)
          if (overlayEps && overlayEps.length > 0) {
            const capLimit = knownEpisodeCount && knownEpisodeCount > 0 ? knownEpisodeCount : (isMovieOrSpecial ? 1 : 1500);
            const maxOverlayNum = Math.min(Math.max(...overlayEps.map(e => e.episodeNum || 0)), capLimit);
            const currentMaxNum = seasonEps.length;
            if (maxOverlayNum > currentMaxNum) {
              for (let i = currentMaxNum + 1; i <= maxOverlayNum; i++) {
                const matchEp = overlayEps.find(j => j.episodeNum === i);
                if (matchEp) {
                  seasonEps.push({
                    episodeId: matchEp.episodeId || `${season.id}-${i}`,
                    episodeNum: i,
                    title: matchEp.title || `Episode ${i}`,
                    thumbnail: matchEp.thumbnail || null,
                    malUrl: matchEp.malUrl || null,
                    isFiller: matchEp.isFiller || false,
                    releasedDate: matchEp.releasedDate || null,
                    description: matchEp.description || null,
                    seasonNum: seasonNumFromList,
                    seasonId: season.id,
                    seasonName: season.name,
                    seasonMalId: season.idMal || null,
                  });
                }
              }
            }
          }
        }

        // Fetch TMDB season overview (only if we have TMDB data to show)
        if (tmdbEpisodes.size > 0) {
          try {
            const tmdbSeasonData = await tmdbFetch(`/tv/${tmdbId}/season/${tmdbSeasonNum}`) as { overview?: string };
            if (tmdbSeasonData) seasonOverview = tmdbSeasonData.overview || null;
          } catch { /* no overview */ }
        }
      } else {
        // ── No TMDB mapping: use enriched episodes ────────────────────────────
        // getEnrichedEpisodesList already tries AniZip → Jikan → Tatakai → Kitsu in order.
        let enrichedEps = await getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes, season.idMal || null);
        const lacksRealEpisodes = !enrichedEps || enrichedEps.length === 0 || enrichedEps.every((e: any) => !episodeHasRealMetadata(e));

        // Fallback: If primary sources failed/placeholders on edge, search TMDB by title!
        // NOTE: This only runs for anime where every primary source returned bare
        // placeholder cards (no title/thumbnail/description). Real TMDB episode data
        // becomes the source so such titles at least display properly.
        if (lacksRealEpisodes && season.name) {
          try {
            const parsed = parseSeasonAndOffsetFromTitle(season.name);
            const targetTmdbSeason = parsed.tmdbSeason || 1;
            const targetOffset = parsed.episodeOffset || 0;

            const searchedTmdbId = await searchTmdbShow(season.name, meta?.anime?.seasonYear || undefined);
            if (searchedTmdbId) {
              console.log(`[Episodes API] TMDB Title Search found tmdbId=${searchedTmdbId} for "${season.name}". Fetching TMDB Season ${targetTmdbSeason}, offset ${targetOffset}`);
              const tmdbSeasonData = await tmdbFetch(`/tv/${searchedTmdbId}/season/${targetTmdbSeason}`).catch(() => null) as any;
              if (tmdbSeasonData?.episodes && tmdbSeasonData.episodes.length > 0) {
                const rawEps = tmdbSeasonData.episodes.slice(targetOffset);
                if (rawEps.length > 0) {
                  enrichedEps = rawEps.map((ep: any, idx: number) => ({
                    episodeId: `${season.id}-${idx + 1}`,
                    episodeNum: idx + 1,
                    title: ep.name || `Episode ${idx + 1}`,
                    thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
                    description: ep.overview || null,
                    releasedDate: ep.air_date || null,
                    isFiller: false,
                    isReleased: true,
                    seasonNum: seasonNumFromList,
                    seasonId: season.id,
                    seasonName: season.name,
                    seasonMalId: season.idMal || null,
                  }));
                  seasonOverview = tmdbSeasonData.overview || null;
                }
              }
            }
          } catch { /* ignore */ }
        }

        seasonEps = enrichedEps.map((ep) => ({
          ...ep,
          episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
          seasonNum: seasonNumFromList,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));

        // Gap-fill: add missing episode numbers that no source returned.
        // Only do this if we got at least SOME real episodes — otherwise we'd
        // just be duplicating the placeholders already generated above.
        const hasRealEpisodes = seasonEps.some((e: any) => !e.isPlaceholder);
        if (hasRealEpisodes) {
          const covered = new Set(seasonEps.map((e: any) => e.episodeNum));
          const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => season.seasonLabel.startsWith(t));
          const knownCount = season.totalEpisodes && season.totalEpisodes < 1499 ? season.totalEpisodes : null;
          const nextAiringEp = meta?.anime?.nextAiringEpisode?.episode || null;
          const maxReleased = seasonEps.reduce((max: number, e: any) => {
            const isRel = e.releasedDate ? new Date(e.releasedDate).getTime() <= Date.now() + 86400000 : (e.title && e.title !== `Episode ${e.episodeNum}`);
            return isRel ? Math.max(max, e.episodeNum) : max;
          }, 0);

          const isSeasonFinished = season.status === "FINISHED" || (meta?.anime?.status === "FINISHED");
          const maxCap = isSpecialFormat
            ? 1
            : knownCount
              ? knownCount
              : isSeasonFinished
                ? Math.max(maxReleased, seasonEps.length, 1)
                : Math.max(maxReleased + 1, nextAiringEp || 1);

          for (let i = 1; i <= maxCap; i++) {
            if (!covered.has(i)) {
              seasonEps.push({
                episodeId: `${season.id}-${i}`,
                episodeNum: i,
                title: isSpecialFormat ? season.name : `Episode ${i}`,
                thumbnail: isSpecialFormat ? meta.anime.poster || null : null,
                malUrl: null, isFiller: false,
                releasedDate: null,
                description: isSpecialFormat ? meta.anime.description || null : null,
                runtime: isSpecialFormat ? meta.anime.duration || null : null,
                seasonNum: seasonNumFromList,
                seasonId: season.id,
                seasonName: season.name,
                seasonMalId: season.idMal || null,
              });
            }
          }
        }
      } // end else (no TMDB)

      // Absolute last resort: if all real sources failed and seasonEps is empty, generate fallbacks
      if (seasonEps.length === 0) {
        console.warn(`[Episodes API] All sources returned 0 episodes for seasonId=${seasonId}. Generating fallback placeholders as last resort.`);
        const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t));
        const knownCount = season.totalEpisodes && season.totalEpisodes < 1499 ? season.totalEpisodes : 12;
        const count = isSpecialFormat ? 1 : knownCount;
        for (let i = 1; i <= count; i++) {
          seasonEps.push({
            episodeId: `${season.id}-${i}`,
            episodeNum: i,
            title: isSpecialFormat ? season.name : `Episode ${i}`,
            thumbnail: isSpecialFormat ? meta?.anime?.poster || null : null,
            malUrl: null,
            isFiller: false,
            releasedDate: null,
            isPlaceholder: true,
            seasonNum: seasonNumFromList,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          });
        }
      }

      seasonEps.sort((a: any, b: any) => a.episodeNum - b.episodeNum);
      seasonEps = enrichEpisodeReleaseStatus(seasonEps, meta, season);
      seasonEps = cleanAndCapSeasonEpisodes(seasonEps, season, meta);

      // ABSOLUTE FINAL HARD CEILING: Apply knownEpisodeCount cap one last time
      // regardless of any code path taken above. This is the last line of defense
      // against edge-cache stale data or any path that bypassed the cap logic.
      const isMovieFormatFinal = (season?.seasonLabel || "").startsWith("Movie") || meta?.anime?.format === "MOVIE" || meta?.anime?.type === "MOVIE";
      const isMovieOrSpecialFinal = ["Movie", "OVA", "Special"].some(t => (season?.seasonLabel || "").startsWith(t)) || isMovieFormatFinal;
      const finalKnownCount = isMovieFormatFinal ? 1 : (season?.totalEpisodes && season.totalEpisodes > 0 && season.totalEpisodes < 1499 ? season.totalEpisodes : null);
      const finalCap = isMovieFormatFinal ? 1 : (finalKnownCount && finalKnownCount > 0 ? finalKnownCount : (isMovieOrSpecialFinal ? 1 : null));
      if (finalCap && finalCap > 0) {
        seasonEps = seasonEps.filter((ep: any) => ep.episodeNum <= finalCap);
      }

      console.log(`[Episodes API] Built ${seasonEps.length} episodes for seasonId=${seasonId} (knownCount=${finalKnownCount})`);

      const resPayload = {
        success: true,
        data: {
          episodes: seasonEps,
          totalEpisodes: meta.totalEpisodes,
          seasonOverview,
        },
      };

      return Response.json(resPayload, { headers: animeCacheHeaders });
    }


    // ── Fallback: fetch by season index (backward compat) ──────────────────
    if (!isNaN(seasonNumParam) && seasonNumParam > 0) {
      const meta = await getAnimeDetails(id, 100, true);
      if (!meta) throw new Error("Anime not found");
      const seasons = meta.seasons;
      const seasonIdx = seasonNumParam - 1;
      const season = seasons[seasonIdx];
      let seasonEps: any[] = [];

      if (season) {
        const safeTotalEpisodes = Math.max(season.totalEpisodes || 12, 1);
        const tmdbId = (season as any).tmdbId;
        const tmdbSeasonNum = season.tmdbSeasonNumber;
        const episodeOffset = (season as any).episodeOffset || 0;
        const isTMDBReady = tmdbId && tmdbSeasonNum !== undefined && tmdbSeasonNum !== null;

        if (isTMDBReady) {
          let tmdbSeasonsList: TmdbSeasonMin[] = [];
          try {
            const showData = await tmdbFetch(`/tv/${tmdbId}`) as { seasons?: TmdbSeasonMin[] };
            if (showData?.seasons) {
              tmdbSeasonsList = showData.seasons
                .filter(s => s.season_number > 0)
                .sort((a, b) => a.season_number - b.season_number);
            }
          } catch { /* ignore */ }

          // Get overlay data using our enriched helper
          const overlayEps = await getEnrichedEpisodesList(String(season.id), season.name, safeTotalEpisodes, season.idMal || null);

          const neededSeasons = new Set<number>();
          overlayEps.forEach(ep => {
            if (ep.seasonNumber) neededSeasons.add(ep.seasonNumber);
          });
          const startSeason = tmdbSeasonNum || 1;
          for (let i = 1; i <= safeTotalEpisodes; i++) {
            const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
            neededSeasons.add(mapped.seasonNumber);
          }

          const seasonNumbers = Array.from(neededSeasons);
          const tmdbEpisodes = seasonNumbers.length > 0
            ? await fetchTmdbEpisodeData(tmdbId, seasonNumbers)
            : new Map<string, any>();

          for (let i = 1; i <= safeTotalEpisodes; i++) {
            const matchEp = overlayEps.find(j => j.episodeNum === i);
            
            let tmdbSeason = matchEp?.seasonNumber || null;
            let tmdbEpisode = matchEp?.episodeNumber || null;

            if (!tmdbSeason || !tmdbEpisode) {
              const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
              tmdbSeason = mapped.seasonNumber;
              tmdbEpisode = mapped.episodeNumber;
            }

            const tmdbEp = tmdbEpisodes.get(`${tmdbSeason}-${tmdbEpisode}`)
              || tmdbEpisodes.get(`${tmdbSeason}-rel-${tmdbEpisode}`);

            seasonEps.push({
              episodeId: matchEp?.episodeId || `${season.id}-${i}`,
              episodeNum: i,
              title: tmdbEp?.title || matchEp?.title || `Episode ${i}`,
              thumbnail: tmdbEp?.thumbnail || matchEp?.thumbnail || null,
              malUrl: matchEp?.malUrl || null,
              isFiller: matchEp?.isFiller || false,
              releasedDate: tmdbEp?.air_date || matchEp?.releasedDate || null,
              description: tmdbEp?.description || matchEp?.description || null,
              vote_average: tmdbEp?.vote_average,
              vote_count: tmdbEp?.vote_count,
              runtime: tmdbEp?.runtime,
              seasonNum: seasonNumParam,
              seasonId: String(season.id),
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
          }
        } else {
          // Use our enriched helper directly
          const enrichedEps = await getEnrichedEpisodesList(String(season.id), season.name, safeTotalEpisodes, season.idMal || null);
          seasonEps = enrichedEps.map((ep) => ({
            ...ep,
            episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
            seasonNum: seasonNumParam,
            seasonId: String(season.id),
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          }));

          const covered = new Set(seasonEps.map((e: any) => e.episodeNum));
          const isSpecial = ["Movie", "OVA", "Special"].some(t => season.seasonLabel.startsWith(t));
          const count = isSpecial ? 1 : safeTotalEpisodes;
          for (let i = 1; i <= count; i++) {
            if (!covered.has(i)) {
              seasonEps.push({
                episodeId: `${season.id}-${i}`, episodeNum: i,
                title: isSpecial ? season.name : `Episode ${i}`,
                thumbnail: isSpecial ? meta.anime.poster || null : null,
                malUrl: null, isFiller: false, releasedDate: null,
                description: isSpecial ? meta.anime.description || null : null,
                runtime: isSpecial ? meta.anime.duration || null : null,
                seasonNum: seasonNumParam,
                seasonId: String(season.id), seasonName: season.name,
                seasonMalId: season.idMal || null,
              });
            }
          }
        }
        seasonEps.sort((a: any, b: any) => a.episodeNum - b.episodeNum);
        seasonEps = enrichEpisodeReleaseStatus(seasonEps, meta, season);
        seasonEps = cleanAndCapSeasonEpisodes(seasonEps, season, meta);
      }

      return Response.json({
        success: true,
        data: { episodes: seasonEps, totalEpisodes: meta.totalEpisodes },
      }, { headers: animeCacheHeaders });
    }

    // ── Default: fetch ALL seasons' episodes ───────────────────────────────
      if (!meta) meta = await getAnimeDetails(id, 100, true);
      if (!meta) throw new Error("Anime not found");

    let episodes: any[] = [];
    
    // Group and fetch episodes for each mapped season
    for (const season of meta.seasons) {
      const tmdbId = (season as any).tmdbId;
      const tmdbSeasonNum = season.tmdbSeasonNumber;
      const episodeOffset = (season as any).episodeOffset || 0;
      const isTMDBReady = tmdbId && tmdbSeasonNum !== undefined && tmdbSeasonNum !== null;
      const seasonIdx = meta.seasons.indexOf(season) + 1;
      const safeTotalEpisodes = Math.max(season.totalEpisodes || 12, 1);

      if (isTMDBReady) {
        let tmdbSeasonsList: TmdbSeasonMin[] = [];
        try {
          const showData = await tmdbFetch(`/tv/${tmdbId}`) as { seasons?: TmdbSeasonMin[] };
          if (showData?.seasons) {
            tmdbSeasonsList = showData.seasons
              .filter(s => s.season_number > 0)
              .sort((a, b) => a.season_number - b.season_number);
          }
        } catch { /* ignore */ }

        // Get overlay data using our enriched helper
        const overlayEps = await getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes, season.idMal || null);

        const neededSeasons = new Set<number>();
        overlayEps.forEach(ep => {
          if (ep.seasonNumber) neededSeasons.add(ep.seasonNumber);
        });
        const startSeason = tmdbSeasonNum || 1;
        for (let i = 1; i <= safeTotalEpisodes; i++) {
          const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
          neededSeasons.add(mapped.seasonNumber);
        }

        const seasonNumbers = Array.from(neededSeasons);
        const tmdbEpisodes = seasonNumbers.length > 0
          ? await fetchTmdbEpisodeData(tmdbId, seasonNumbers)
          : new Map<string, any>();

        for (let i = 1; i <= safeTotalEpisodes; i++) {
          // Build episodes from TMDB, overlay AniZip/Jikan data
          const matchEp = overlayEps.find(j => j.episodeNum === i);
          
          let tmdbSeason = matchEp?.seasonNumber || null;
          let tmdbEpisode = matchEp?.episodeNumber || null;

          if (!tmdbSeason || !tmdbEpisode) {
            const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
            tmdbSeason = mapped.seasonNumber;
            tmdbEpisode = mapped.episodeNumber;
          }

          const tmdbEp = tmdbEpisodes.get(`${tmdbSeason}-${tmdbEpisode}`)
            || tmdbEpisodes.get(`${tmdbSeason}-rel-${tmdbEpisode}`);
          episodes.push({
            episodeId: matchEp?.episodeId || `${season.id}-${i}`,
            episodeNum: i,
            title: tmdbEp?.title || matchEp?.title || `Episode ${i}`,
            thumbnail: tmdbEp?.thumbnail || matchEp?.thumbnail || null,
            malUrl: matchEp?.malUrl || null,
            isFiller: matchEp?.isFiller || false,
            releasedDate: tmdbEp?.air_date || matchEp?.releasedDate || null,
            description: tmdbEp?.description || matchEp?.description || null,
            vote_average: tmdbEp?.vote_average,
              vote_count: tmdbEp?.vote_count,
            runtime: tmdbEp?.runtime,
            seasonNum: seasonIdx,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
            tmdbSeasonNumber: tmdbSeason,
            tmdbEpisodeNumber: tmdbEpisode,
          });
        }
      } else {
        // Use our enriched helper directly
        const enrichedEps = await getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes, season.idMal || null);
        let seasonEps: any[] = enrichedEps.map((ep) => ({
          ...ep,
          episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
          seasonNum: seasonIdx,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));

        if (!seasonEps || seasonEps.length === 0) {
          const metaEpsForSeason = (meta?.episodes || []).filter((e: any) => e.seasonId === season.id);
          seasonEps = metaEpsForSeason.map((ep: any) => ({
            episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
            episodeNum: Number(ep.episodeNum || 1),
            title: ep.title || (["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t)) ? season.name : `Episode ${ep.episodeNum || 1}`),
            thumbnail: ep.thumbnail || (["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t)) ? meta.anime.poster || null : null),
            malUrl: ep.malUrl || null,
            isFiller: ep.isFiller || false,
            releasedDate: ep.releasedDate || null,
            description: ep.description || null,
            runtime: ep.runtime || (["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t)) ? meta.anime.duration || null : null),
            seasonNum: seasonNumFromList,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          }));
        }

        if (!seasonEps || seasonEps.length === 0) {
          const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t));
          const epCount = isSpecialFormat ? 1 : safeTotalEpisodes;
          for (let i = 1; i <= epCount; i++) {
            seasonEps.push({
              episodeId: `${season.id}-${i}`,
              episodeNum: i,
              title: i === 1 && isSpecialFormat ? season.name : `Episode ${i}`,
              description: null,
              thumbnail: isSpecialFormat ? meta?.anime?.poster || null : null,
              malUrl: null,
              isFiller: false,
              releasedDate: null,
              seasonNum: seasonNumFromList,
              seasonId: season.id,
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
          }
        }
        episodes.push(...cleanAndCapSeasonEpisodes(seasonEps, season, meta));
      }
    }

    if (episodes.length === 0 && meta?.anime) {
      const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => meta.anime.format?.includes(t));
      const epCount = isSpecialFormat ? 1 : Math.max(meta.anime.totalEpisodes || 12, 1);
      for (let i = 1; i <= epCount; i++) {
        episodes.push({
          episodeId: `${id}-${i}`,
          episodeNum: i,
          title: i === 1 && isSpecialFormat ? meta.anime.name : `Episode ${i}`,
          description: null,
          thumbnail: null,
          malUrl: null,
          isFiller: false,
          releasedDate: null,
          seasonNum: 1,
          seasonId: id,
          seasonName: meta.anime.name,
          seasonMalId: meta.anime.idMal || null,
        });
      }
    }

    episodes = enrichEpisodeReleaseStatus(episodes, meta);

    const payloadData = { episodes, totalEpisodes: episodes.length };
    if (EPISODES_CACHE.size > 300) {
      const first = EPISODES_CACHE.keys().next().value;
      if (first !== undefined) EPISODES_CACHE.delete(first);
    }
    EPISODES_CACHE.set(cacheKey, { data: payloadData, timestamp: Date.now() });

    return Response.json({
      success: true,
      data: payloadData,
    }, { headers: animeCacheHeaders });
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: "Failed to fetch episodes", success: false },
      { status: 500, headers: animeCacheHeaders }
    );
  }
}
