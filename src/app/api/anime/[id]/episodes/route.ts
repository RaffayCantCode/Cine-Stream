export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import {
  getAnimeDetails,
  fetchEpisodesFromAniZip,
  fetchEpisodesFromKitsu,
  fetchFillerLookupFromAnimeFillerList,
  resolveTmdbMappingFromAniZip,
  DEFAULT_FETCH_USER_AGENT,
} from "@/lib/anime-fetch";
import { tmdbFetch, fetchTmdbEpisodeData, searchTmdbShow } from "@/lib/tmdb";
import { isEpisodeAvailable } from "@/lib/episode-availability";
import { getCuratedAnimeFranchiseNodes } from "@/lib/franchises";
import { getMediaOverride } from "@/lib/media-overrides";

// An episode only counts as "real" if it carries actual metadata — a specific
// title (not generic "Episode N"), thumbnail, description, or air date.
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

  let seasonNum = 1;
  const seasonMatch =
    lower.match(/(?:season|s)\s*(\d+)/i) ||
    lower.match(/(\d+)(?:st|nd|rd|th)\s*season/i);

  if (seasonMatch && seasonMatch[1]) {
    seasonNum = parseInt(seasonMatch[1], 10) || 1;
  } else if (lower.includes("final season")) {
    seasonNum = 4;
  }

  const partMatch = lower.match(/(?:part|cour)\s*(\d+)/i);
  let partNum = partMatch && partMatch[1] ? parseInt(partMatch[1], 10) : 1;

  if (!seasonMatch && !lower.includes("final season") && partMatch && partNum > 1) {
    seasonNum = partNum;
    partNum = 1;
  }

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
  const nextAiringAt = !isSeasonFinished ? (meta?.anime?.nextAiringEpisode?.airingAt || null) : null;
  const isNotYetReleased = !isSeasonFinished && (meta?.anime?.status === "NOT_YET_RELEASED" || season?.status === "NOT_YET_RELEASED");

  let seasonIsUpcoming = isNotYetReleased || Boolean(!isSeasonFinished && season?.seasonYear && season.seasonYear > currentYear);

  let encounteredUnreleased = false;
  return episodes.map((ep: any) => {
    let isReleased = ep.isReleased !== false;

    if (isSeasonFinished) {
      isReleased = true;
    } else if (seasonIsUpcoming) {
      isReleased = false;
    } else if (nextAiringEpNum && typeof ep.episodeNum === "number" && ep.episodeNum > nextAiringEpNum) {
      isReleased = false;
    } else if (nextAiringEpNum && typeof ep.episodeNum === "number" && ep.episodeNum === nextAiringEpNum) {
      if (nextAiringAt) {
        if (!isEpisodeAvailable(nextAiringAt, nowMs)) {
          isReleased = false;
        }
      } else {
        isReleased = false;
      }
    } else if (ep.releasedDate) {
      if (!isEpisodeAvailable(ep.releasedDate, nowMs)) {
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
  if (meta?.anime?.status === "FINISHED" || meta?.anime?.status === "FINISHED_AIRING") return true;
  if (season?.status === "FINISHED" || season?.status === "FINISHED_AIRING") return true;
  const status = (meta?.anime?.status || "").toUpperCase();
  const isAiringNow = status === "RELEASING" || status === "AIRING" || status === "NOT_YET_RELEASED";
  if (!isAiringNow && season?.totalEpisodes && season.totalEpisodes > 0 && season.totalEpisodes < 1499) {
    return true;
  }
  return false;
}

function cleanAndCapSeasonEpisodes(episodes: any[], season: any, meta?: any): any[] {
  if (!episodes || episodes.length === 0) return [];

  const isExplicitMovie =
    (season?.seasonLabel || "").toLowerCase().startsWith("movie") ||
    season?.format === "MOVIE" ||
    (meta?.anime?.format === "MOVIE" && (!season?.format || season?.format === "MOVIE") && (season?.totalEpisodes === 1 || !season?.totalEpisodes));

  if (isExplicitMovie && episodes.length > 1) {
    const firstEp = episodes[0];
    return [{
      ...firstEp,
      episodeNum: 1,
      title: (firstEp.title && firstEp.title !== "Episode 1" && !firstEp.title.toLowerCase().startsWith("part ")) ? firstEp.title : (season?.name || meta?.anime?.name || "Complete Movie"),
      description: firstEp.description || meta?.anime?.description || null,
      thumbnail: firstEp.thumbnail || meta?.anime?.poster || null,
    }];
  }

  const knownEpisodeCount = season?.totalEpisodes && season.totalEpisodes > 0 && season.totalEpisodes < 1499 ? season.totalEpisodes : null;
  const isSpecial = ["OVA", "Special"].some(t =>
    (season?.seasonLabel || "").startsWith(t) || (season?.name || "").includes(t)
  );
  const isFinished = isAnimeSeasonFinished(season, meta);

  let result = [...episodes];

  if (knownEpisodeCount && knownEpisodeCount > 0) {
    const hasRealBeyondCap = result.some((ep: any) => ep.episodeNum > knownEpisodeCount && episodeHasRealMetadata(ep));
    if (!hasRealBeyondCap) {
      result = result.filter((ep: any) => ep.episodeNum <= knownEpisodeCount);
    }
  } else if (isSpecial) {
    result = result.filter((ep: any) => ep.episodeNum <= 1);
  }

  if (isFinished) {
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
      const maxAllowed = knownEpisodeCount
        ? Math.min(knownEpisodeCount, maxRealEpNum)
        : maxRealEpNum;
      result = result.filter((ep: any) => ep.episodeNum <= maxAllowed);
    } else if (knownEpisodeCount) {
      result = result.filter((ep: any) => ep.episodeNum <= knownEpisodeCount);
    }
  }

  const seenEpNums = new Set<number>();
  const dedupedResult: any[] = [];
  for (const ep of result) {
    if (!seenEpNums.has(ep.episodeNum)) {
      seenEpNums.add(ep.episodeNum);
      dedupedResult.push(ep);
    }
  }

  return dedupedResult;
}

// Clean helper to fetch and enrich episode lists from AniZip (primary) and Kitsu (fallback)
async function getEnrichedEpisodesList(
  seasonId: string,
  seasonName: string,
  totalEpisodes: number
): Promise<any[]> {
  let seasonEps: any[] = [];
  const cleanSeasonName = seasonName.replace(/\s*\([^)]*\)\s*/g, "").trim() || seasonName;

  // 1. AniZip (primary for anime episode list mapping)
  try {
    const az = await fetchEpisodesFromAniZip(seasonId, totalEpisodes).catch(() => null);
    if (az && az.length > 0) {
      seasonEps = az;
    }
  } catch {}

  // 2. Kitsu fallback if AniZip failed
  if (seasonEps.length === 0) {
    try {
      const kitsuEps = await fetchEpisodesFromKitsu(seasonName, totalEpisodes);
      if (kitsuEps && kitsuEps.length > 0) {
        seasonEps = kitsuEps;
      }
    } catch {}
  }

  // 3. Optional filler data from animefillerlist (short timeout so it never blocks)
  try {
    const fillerLookup = await Promise.race([
      fetchFillerLookupFromAnimeFillerList(cleanSeasonName),
      new Promise<null>(r => setTimeout(() => r(null), 1000)),
    ]);
    if (fillerLookup && (fillerLookup.filler.size > 0 || fillerLookup.mixed.size > 0)) {
      seasonEps = seasonEps.map((ep) => ({
        ...ep,
        isFiller: ep.isFiller || fillerLookup.filler.has(ep.episodeNum) || fillerLookup.mixed.has(ep.episodeNum),
      }));
    }
  } catch {}

  // 4. Placeholders only if both AniZip and Kitsu failed
  if (!seasonEps || seasonEps.length === 0) {
    const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => seasonName?.includes(t));
    const count = isSpecialFormat ? 1 : (totalEpisodes && totalEpisodes > 0 ? totalEpisodes : 12);
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
        isPlaceholder: true,
        seasonId: seasonId,
        seasonName: seasonName,
      });
    }
  }

  return seasonEps;
}

interface EpisodesCacheEntry {
  data: { episodes: any[]; totalEpisodes: number };
  timestamp: number;
}
const EPISODES_CACHE = new Map<string, EpisodesCacheEntry>();
const EPISODES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const animeCacheHeaders = {
  "Cache-Control": "public, max-age=1800, s-maxage=7200, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, max-age=7200, stale-while-revalidate=86400",
  "Cloudflare-CDN-Cache-Control": "public, max-age=7200, stale-while-revalidate=86400",
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const seasonId = searchParams.get("seasonId") || null;
  const seasonNumParam = parseInt(searchParams.get("seasonNum") || "", 10);

  try {
    const override = (await getMediaOverride("anime", seasonId || id).catch(() => null)) ||
      (seasonId ? await getMediaOverride("anime", id).catch(() => null) : null);

    if (override?.isHidden || override?.status === "hidden") {
      return Response.json({ success: true, data: { episodes: [], isHidden: true } }, { headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" } });
    }
    if (override?.isUpcoming || override?.status === "upcoming") {
      return Response.json({ success: true, data: { episodes: [], isUpcoming: true, status: "upcoming" } }, { headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" } });
    }
    if (override?.isUnavailable || override?.status === "unavailable") {
      return Response.json({ success: true, data: { episodes: [], isUnavailable: true, status: "unavailable" } }, { headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" } });
    }

    // Pagination check — episodes are loaded in bulk via AniZip/TMDB
    if (page > 1) {
      return Response.json({ success: true, data: { episodes: [], totalEpisodes: 0 } }, { headers: animeCacheHeaders });
    }

    const cacheKey = `${id}-${seasonId || "root"}-${page}-${searchParams.toString()}`;
    const cached = EPISODES_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < EPISODES_CACHE_TTL) {
      return Response.json({ success: true, data: cached.data }, { headers: animeCacheHeaders });
    }

    let season: any = null;
    let meta: any = null;
    let seasonNumFromList = 1;

    // ── Fetch a specific season's episodes by its AniList ID ───────────────
    if (seasonId) {
      const tmdbIdParam = searchParams.get("tmdbId");
      const tmdbSeasonParam = searchParams.get("tmdbSeason");
      const episodeOffsetParam = searchParams.get("episodeOffset");

      const clientTmdbId = tmdbIdParam != null ? parseInt(tmdbIdParam, 10) : null;
      const clientTmdbSeasonNum = tmdbSeasonParam != null ? parseInt(tmdbSeasonParam, 10) : null;
      const clientEpisodeOffset = episodeOffsetParam != null ? parseInt(episodeOffsetParam, 10) : null;

      const allParamsProvided = clientTmdbId != null && !isNaN(clientTmdbId) &&
                                clientTmdbSeasonNum != null && !isNaN(clientTmdbSeasonNum) &&
                                clientEpisodeOffset != null && !isNaN(clientEpisodeOffset);

      if (allParamsProvided) {
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
        let directSeasonMeta: any = null;
        if (seasonId && seasonId !== id) {
          directSeasonMeta = await getAnimeDetails(seasonId, 1500, true).catch(() => null);
        }

        meta = directSeasonMeta || await getAnimeDetails(id, 1500, true);
        if (!meta) {
          throw new Error("Anime not found");
        }

        season = meta.seasons?.find((s: any) => String(s.id) === String(seasonId));
        if (!season && directSeasonMeta) {
          const directSeason = directSeasonMeta.seasons?.find((s: any) => String(s.id) === String(seasonId))
            || directSeasonMeta.seasons?.[0];
          if (directSeason) season = directSeason;
        }

        if (!season && meta.seasons && meta.seasons.length > 0) {
          const cleanTarget = String(seasonId).replace(/^(kitsu-|mal-|tmdb-)/, "");
          season = meta.seasons.find((s: any) => String(s.id).replace(/^(kitsu-|mal-|tmdb-)/, "") === cleanTarget)
            || meta.seasons.find((s: any) => s.isCurrent)
            || meta.seasons[0];
        }

        if (!season) {
          return Response.json({ success: true, data: { episodes: [], totalEpisodes: 0 } }, { headers: animeCacheHeaders });
        }

        const idx = meta.seasons.findIndex((s: any) => String(s.id) === String(season.id));
        seasonNumFromList = idx >= 0 ? idx + 1 : 1;
      }

      let tmdbId = clientTmdbId ?? (season as any).tmdbId;
      let tmdbSeasonNum = clientTmdbSeasonNum ?? season.tmdbSeasonNumber;
      let episodeOffset = clientEpisodeOffset ?? (season as any).episodeOffset ?? 0;

      // Recover TMDB mapping from AniZip if missing
      if (tmdbId == null || tmdbSeasonNum == null || isNaN(tmdbSeasonNum)) {
        try {
          const resolved = await resolveTmdbMappingFromAniZip(season.id);
          if (resolved) {
            if (tmdbId == null) tmdbId = resolved.tmdbId;
            if (tmdbSeasonNum == null || isNaN(tmdbSeasonNum)) tmdbSeasonNum = resolved.tmdbSeason;
            if (clientEpisodeOffset == null && ((season as any).episodeOffset == null || (season as any).episodeOffset === undefined)) {
              episodeOffset = resolved.episodeOffset;
            }
          }
        } catch {}
      }

      // Curated franchise mapping check
      const curatedNodes = getCuratedAnimeFranchiseNodes(Number(season.id) || Number(id));
      const curatedItem = curatedNodes?.find((n: any) => String(n.id) === String(season.id) || String(n.anilistId) === String(season.id));
      if (curatedItem) {
        if (!tmdbId && curatedItem.tmdbId) tmdbId = curatedItem.tmdbId;
        if ((tmdbSeasonNum == null || isNaN(tmdbSeasonNum)) && curatedItem.tmdbSeasonNumber != null) tmdbSeasonNum = curatedItem.tmdbSeasonNumber;
        if (episodeOffset === 0 && curatedItem.episodeOffset != null) episodeOffset = curatedItem.episodeOffset;
      }

      // Title search fallback for TMDB ID
      if (!tmdbId && (season.name || meta?.anime?.name)) {
        try {
          const titleSearch = season.name || meta?.anime?.name || "";
          const searchedId = await searchTmdbShow(titleSearch, meta?.anime?.seasonYear || undefined);
          if (searchedId) {
            tmdbId = searchedId;
            tmdbSeasonNum = tmdbSeasonNum || 1;
          }
        } catch {}
      }

      // Season & offset parsing override
      if (!tmdbSeasonNum || tmdbSeasonNum === 1) {
        const parsedLabel = parseSeasonAndOffsetFromTitle(season.seasonLabel || "");
        const parsedName = parseSeasonAndOffsetFromTitle(season.name || meta?.anime?.name || "");
        const parsed = parsedLabel.tmdbSeason > 1 ? parsedLabel : parsedName;
        if (parsed.tmdbSeason > 1 || parsed.episodeOffset > 0) {
          tmdbSeasonNum = parsed.tmdbSeason;
          episodeOffset = parsed.episodeOffset;
        }
      }

      const isTMDBReady = tmdbId != null && !isNaN(tmdbId) && tmdbSeasonNum != null && !isNaN(tmdbSeasonNum);
      let seasonEps: any[] = [];
      let seasonOverview: string | null = null;

      const isMovieOrSpecial = ["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t)) ||
        (season.format === "MOVIE") ||
        (meta?.anime?.format === "MOVIE" && (season?.totalEpisodes === 1 || !season?.totalEpisodes) && season.format !== "TV");
      const safeTotalEpisodes = isMovieOrSpecial ? 1 : (season.totalEpisodes && season.totalEpisodes < 1499 && season.totalEpisodes > 0 ? season.totalEpisodes : 1500);

      if (isTMDBReady && !isMovieOrSpecial) {
        const tmdbShowPromise = tmdbFetch(`/tv/${tmdbId}`).catch(() => null);
        const overlayEpsPromise = getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes);

        const showData = await tmdbShowPromise;
        let tmdbSeasonsList: TmdbSeasonMin[] = [];
        if ((showData as any)?.seasons) {
          tmdbSeasonsList = (showData as any).seasons
            .filter((s: any) => s.season_number > 0)
            .sort((a: any, b: any) => a.season_number - b.season_number);
        }

        let dynamicTotalEpisodes = isMovieOrSpecial ? 1 : safeTotalEpisodes;
        const knownEpisodeCount = season.totalEpisodes && season.totalEpisodes < 1499 ? season.totalEpisodes : null;
        if (tmdbSeasonsList.length > 0) {
          const currentTmdbSeason = tmdbSeasonsList.find((s: any) => s.season_number === (tmdbSeasonNum || 1));
          const nextSeasonInTMDB = (meta?.seasons || []).find((s: any) =>
            s.tmdbSeasonNumber === (tmdbSeasonNum || 1) &&
            (s.episodeOffset || 0) > episodeOffset &&
            s.totalEpisodes > 2
          );

          const currentTmdbSeasonEpCount = currentTmdbSeason ? Math.max((currentTmdbSeason.episode_count || 0) - episodeOffset, 0) : 0;
          if (currentTmdbSeasonEpCount > 0) {
            dynamicTotalEpisodes = Math.max(knownEpisodeCount || 0, currentTmdbSeasonEpCount);
          } else if (knownEpisodeCount) {
            dynamicTotalEpisodes = knownEpisodeCount;
          } else if (nextSeasonInTMDB) {
            dynamicTotalEpisodes = (nextSeasonInTMDB.episodeOffset || 0) - episodeOffset;
          }
          dynamicTotalEpisodes = Math.min(Math.max(dynamicTotalEpisodes, 1), 1500);
        }

        const neededSeasons = new Set<number>();
        const startSeason = tmdbSeasonNum || 1;
        for (let i = 1; i <= dynamicTotalEpisodes; i++) {
          const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
          neededSeasons.add(mapped.seasonNumber);
        }

        const seasonNumbers = Array.from(neededSeasons);
        const tmdbEpisodesPromise = seasonNumbers.length > 0
          ? fetchTmdbEpisodeData(tmdbId, seasonNumbers)
          : Promise.resolve(new Map<string, any>());

        const [overlayEps, tmdbEpisodes] = await Promise.all([overlayEpsPromise, tmdbEpisodesPromise]);

        if (tmdbEpisodes.size === 0 && overlayEps.length > 0) {
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
        } else if (tmdbEpisodes.size > 0) {
          for (let i = 1; i <= dynamicTotalEpisodes; i++) {
            const matchEp = overlayEps.find(j => j.episodeNum === i);
            const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
            const tmdbSeason = mapped.seasonNumber;
            const tmdbEpisode = mapped.episodeNumber;

            const tmdbEp = tmdbEpisodes.get(`${tmdbSeason}-${tmdbEpisode}`)
              || tmdbEpisodes.get(`${tmdbSeason}-rel-${tmdbEpisode}`)
              || tmdbEpisodes.get(`abs-${episodeOffset + i}`);

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

        if (tmdbEpisodes.size > 0) {
          try {
            const tmdbSeasonData = await tmdbFetch(`/tv/${tmdbId}/season/${tmdbSeasonNum}`) as { overview?: string };
            if (tmdbSeasonData) seasonOverview = tmdbSeasonData.overview || null;
          } catch {}
        }
      } else {
        // No TMDB mapping: use AniZip / Kitsu directly
        let enrichedEps = await getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes);
        const lacksRealEpisodes = !enrichedEps || enrichedEps.length === 0 || enrichedEps.every((e: any) => !episodeHasRealMetadata(e));

        const needsTmdbEnrichment = lacksRealEpisodes || (enrichedEps.length < (safeTotalEpisodes > 2 ? safeTotalEpisodes : 12) && !isMovieOrSpecial);
        if (needsTmdbEnrichment && season.name) {
          try {
            const parsed = parseSeasonAndOffsetFromTitle(season.name);
            const targetTmdbSeason = parsed.tmdbSeason || 1;
            const targetOffset = parsed.episodeOffset || 0;

            const searchedTmdbId = await searchTmdbShow(season.name, meta?.anime?.seasonYear || undefined);
            if (searchedTmdbId) {
              const tmdbSeasonData = await tmdbFetch(`/tv/${searchedTmdbId}/season/${targetTmdbSeason}`).catch(() => null) as any;
              if (tmdbSeasonData?.episodes && tmdbSeasonData.episodes.length > 0) {
                const rawEps = tmdbSeasonData.episodes.slice(targetOffset);
                if (rawEps.length > 0) {
                  enrichedEps = rawEps.map((ep: any, idx: number) => {
                    const epNum = idx + 1;
                    const existing = enrichedEps.find(e => e.episodeNum === epNum);
                    return {
                      episodeId: existing?.episodeId || `${season.id}-${epNum}`,
                      episodeNum: epNum,
                      title: ep.name || existing?.title || `Episode ${epNum}`,
                      thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w780${ep.still_path}` : (existing?.thumbnail || null),
                      description: ep.overview || existing?.description || null,
                      releasedDate: ep.air_date || existing?.releasedDate || null,
                      isFiller: existing?.isFiller || false,
                      isReleased: true,
                      seasonNum: seasonNumFromList,
                      seasonId: season.id,
                      seasonName: season.name,
                      seasonMalId: season.idMal || null,
                    };
                  });
                  seasonOverview = tmdbSeasonData.overview || null;
                }
              }
            }
          } catch {}
        }

        seasonEps = enrichedEps.map((ep) => ({
          ...ep,
          episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
          seasonNum: seasonNumFromList,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));
      }

      if (seasonEps.length === 0) {
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

      const isExplicitMovieFinal =
        (season?.seasonLabel || "").toLowerCase().startsWith("movie") ||
        season?.format === "MOVIE" ||
        (meta?.anime?.format === "MOVIE" && (!season?.format || season?.format === "MOVIE") && (season?.totalEpisodes === 1 || !season?.totalEpisodes));

      const finalKnownCount = isExplicitMovieFinal ? 1 : (season?.totalEpisodes && season.totalEpisodes > 0 && season.totalEpisodes < 1499 ? season.totalEpisodes : null);
      if (isExplicitMovieFinal) {
        seasonEps = seasonEps.slice(0, 1);
      } else if (finalKnownCount && finalKnownCount > 0) {
        const hasRealBeyondFinal = seasonEps.some((ep: any) => ep.episodeNum > finalKnownCount && episodeHasRealMetadata(ep));
        if (!hasRealBeyondFinal) {
          seasonEps = seasonEps.filter((ep: any) => ep.episodeNum <= finalKnownCount);
        }
      }

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

    // ── Fallback: fetch by season index ──────────────────
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
          } catch {}

          const overlayEps = await getEnrichedEpisodesList(String(season.id), season.name, safeTotalEpisodes);
          const startSeason = tmdbSeasonNum || 1;
          const neededSeasons = new Set<number>();
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
            const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
            const tmdbSeason = mapped.seasonNumber;
            const tmdbEpisode = mapped.episodeNumber;

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
          const enrichedEps = await getEnrichedEpisodesList(String(season.id), season.name, safeTotalEpisodes);
          seasonEps = enrichedEps.map((ep) => ({
            ...ep,
            episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
            seasonNum: seasonNumParam,
            seasonId: String(season.id),
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          }));
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
        } catch {}

        const overlayEps = await getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes);
        const startSeason = tmdbSeasonNum || 1;
        const neededSeasons = new Set<number>();
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
          const mapped = mapRelativeToTmdb(episodeOffset + i, startSeason, tmdbSeasonsList);
          const tmdbSeason = mapped.seasonNumber;
          const tmdbEpisode = mapped.episodeNumber;

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
        const enrichedEps = await getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes);
        let seasonEps: any[] = enrichedEps.map((ep) => ({
          ...ep,
          episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
          seasonNum: seasonIdx,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));
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
