// Deterministic anime catalog builder.
//
// Modeled on the TV architecture: one canonical entry resolved server-side,
// seasons/episodes built from a single trusted pipeline (AniList for identity,
// AniZip for TMDB/MAL mapping + per-episode air dates, TMDB for seasons,
// episodes, titles, unique still thumbnails, runtimes and air dates, Jikan only
// when the primary chain genuinely fails). Never fabricates episode counts.
//
// Season labelling lives in anilist.buildSeasonList (ordinals, main-line
// relation types, base-title matching); this file only wires season data.

import { getAniZipMapping, type AniZipMapping } from "./ani-zip";
import { getAnimeCore, fetchFranchiseGraph, buildSeasonList, sortNodesChronologically } from "./anilist";
import { getJikanEpisodes } from "./jikan";
import { fetchFillerLookupFromAnimeFillerList, isEpisodeFiller } from "./animefillerlist";
import { resolveAnimeId } from "./resolve-id";
import { getTmdbShow, getTmdbSeasonEpisodes, tmdbStillUrl, type TmdbSeasonEpisodes } from "./tmdb-anime";
import { searchTmdbShow } from "@/lib/tmdb";
import type { AnimeCatalog, AnimeCore, EpisodeDetail, FranchiseNode, SeasonInfo } from "./types";

const MAX_EPISODES = 2000;
const CATALOG_TTL = 30 * 60 * 1000; // 30 min in-isolate
const EPISODES_TTL = 10 * 60 * 1000; // 10 min in-isolate

interface SeasonMapping {
  tmdbId: number | null;
  tmdbSeason: number | null;
  episodeOffset: number;
  mapping: AniZipMapping | null;
}

export interface BuiltCatalog {
  catalog: AnimeCatalog;
  id: number;
  seasonMappings: Record<string, SeasonMapping>;
}

const catalogCache = new Map<string, { data: BuiltCatalog | null; expires: number }>();
const episodesCache = new Map<
  string,
  { data: { episodes: EpisodeDetail[]; seasonOverview: string | null }; expires: number }
>();

export function clearAnimeCatalogCache(): void {
  catalogCache.clear();
  episodesCache.clear();
}

function parseSeasonNumberFromTitle(title: string): number {
  const normalized = title.toLowerCase();
  const seasonMatch = normalized.match(/season\s*([0-9]+)/);
  if (seasonMatch) return parseInt(seasonMatch[1], 10);
  const ordinalMatch = normalized.match(/([0-9]+)(?:st|nd|rd|th)\s+season/);
  if (ordinalMatch) return parseInt(ordinalMatch[1], 10);
  const partMatch = normalized.match(/(?:part|cour)\s*([0-9]+)/i);
  if (partMatch) return parseInt(partMatch[1], 10);
  if (normalized.includes("final season")) return 4;
  return 1;
}

function makeNodeFromCore(core: AnimeCore): FranchiseNode {
  return {
    id: Number(core.id),
    idMal: core.idMal ? Number(core.idMal) : null,
    title: core.name,
    episodes: core.totalEpisodes,
    season: core.season,
    seasonYear: core.seasonYear,
    status: core.status,
    format: core.format,
    duration: core.duration,
  };
}

function makeSeasonFromCore(core: AnimeCore): SeasonInfo {
  return {
    id: core.id,
    name: core.name,
    seasonLabel: "Episodes",
    totalEpisodes: core.totalEpisodes ?? 0,
    isCurrent: true,
    idMal: core.idMal ? Number(core.idMal) : null,
    seasonYear: core.seasonYear,
    status: core.status,
    format: core.format,
  };
}

async function buildCatalogUncached(rawId: string): Promise<BuiltCatalog | null> {
  const id = await resolveAnimeId(rawId);
  if (!id) return null;

  const core = await getAnimeCore(id);
  if (!core) return null;

  const az = await getAniZipMapping(id);

  let nodes = await fetchFranchiseGraph(id);
  if (!nodes || nodes.length === 0) nodes = [makeNodeFromCore(core)];
  // Watch order must always be chronological regardless of which entry opened
  // the page (BFS discovery order is not release order). Same sort the season
  // guide uses, so the two lists stay consistent.
  nodes = sortNodesChronologically(nodes);

  const baseSeasons = buildSeasonList(nodes, id);
  const seasons = (baseSeasons.length > 0 ? baseSeasons : [makeSeasonFromCore(core)]).map((s) => {
    // The CURRENT season's status must come from AniList's live data — curated
    // fallbacks can wrongly mark an ongoing show (e.g. Bleach TYBW Part 4) as
    // FINISHED, which kills the "upcoming" tagging for unaired episodes.
    if (s.id === String(id) && core.status) {
      return {
        ...s,
        status: core.status,
        totalEpisodes: core.totalEpisodes && core.totalEpisodes > 0 ? core.totalEpisodes : s.totalEpisodes,
      };
    }
    return s;
  });

  const primaryTmdbId = az?.tmdbId ?? null;

  const seasonMappings: Record<string, SeasonMapping> = {};
  const tmdbSeasonMap: Record<string, number> = {};

  const chunkSize = 5;
  for (let i = 0; i < seasons.length; i += chunkSize) {
    const chunk = seasons.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (s) => {
        const isCurrent = s.id === String(id);
        const azForSeason = isCurrent ? az : await getAniZipMapping(s.id);

        let tmdbId = s.tmdbId ?? azForSeason?.tmdbId ?? primaryTmdbId ?? null;
        // Hand-curated (verified) season/offset values win over AniZip-derived
        // ones — AniZip can return misleading data for specials/movies.
        const hasCuratedTmdbSeason = s.tmdbSeasonNumber != null;
        let tmdbSeason: number | null = s.tmdbSeasonNumber ?? null;
        let episodeOffset = s.episodeOffset ?? 0;

        const azEp1 = azForSeason?.episodes.get(1);
        if (tmdbId && !hasCuratedTmdbSeason && azEp1?.seasonNumber !== undefined && azEp1?.episodeNumber !== undefined) {
          tmdbSeason = azEp1.seasonNumber;
          episodeOffset = Math.max(azEp1.episodeNumber - 1, 0);
        }

        // Fall back to label-derived guess only when we have no authoritative data.
        if (tmdbId && tmdbSeason === null) {
          const parsedNum = parseSeasonNumberFromTitle(s.name);
          if (s.seasonLabel?.toLowerCase().startsWith("special") || s.seasonLabel?.toLowerCase().startsWith("ova") || s.format === "SPECIAL" || s.format === "OVA") {
            tmdbSeason = 0;
          } else {
            tmdbSeason = parsedNum > 0 ? parsedNum : (isCurrent ? 1 : 1);
          }
          episodeOffset = 0;
        }

        if (!tmdbId) {
          tmdbId = await searchTmdbShow(s.name, s.seasonYear || undefined);
          if (tmdbId && tmdbSeason === null) {
            tmdbSeason = parseSeasonNumberFromTitle(s.name) || 1;
          }
        }

        if (tmdbId && tmdbSeason !== null && tmdbSeason !== undefined) {
          tmdbSeasonMap[s.id] = tmdbSeason;
        }

        seasonMappings[s.id] = {
          tmdbId,
          tmdbSeason: tmdbId ? (tmdbSeason ?? 1) : null,
          episodeOffset,
          mapping: azForSeason,
        };
      })
    );
  }

  const currentMapping = seasonMappings[String(id)];
  const catalog: AnimeCatalog = {
    anime: core,
    seasons: seasons.map((s) => ({
      ...s,
      tmdbId: seasonMappings[s.id]?.tmdbId ?? s.tmdbId ?? null,
      tmdbSeasonNumber: seasonMappings[s.id]?.tmdbSeason ?? s.tmdbSeasonNumber ?? null,
      episodeOffset: seasonMappings[s.id]?.episodeOffset ?? s.episodeOffset ?? 0,
    })),
    openedSeasonId: String(id),
    franchiseNodes: nodes,
    tmdbId: currentMapping?.tmdbId ?? null,
    tmdbSeasonMap,
  };

  return { catalog, id, seasonMappings };
}

export async function buildAnimeCatalog(rawId: string): Promise<BuiltCatalog | null> {
  const cacheKey = `v5-${rawId}`;
  const hit = catalogCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data;
  const built = await buildCatalogUncached(rawId);
  catalogCache.set(cacheKey, { data: built, expires: Date.now() + CATALOG_TTL });
  return built;
}

// ─────────────────────────────────────────────────────────────────────────────
// EPISODE BUILDING
// ─────────────────────────────────────────────────────────────────────────────

interface TmdbPosition {
  seasonNumber: number;
  episodeNumber: number;
}

/** Map a relative episode number to its absolute TMDB (season, episode). */
function mapPosition(
  relative: number,
  startSeason: number,
  offset: number,
  seasonList: { season_number: number; episode_count: number }[]
): TmdbPosition {
  let abs = offset + relative;
  const startIdx = seasonList.findIndex((s) => s.season_number === startSeason);
  if (startIdx < 0) return { seasonNumber: startSeason, episodeNumber: Math.max(abs, 1) };

  for (let i = startIdx; i < seasonList.length; i++) {
    const s = seasonList[i];
    const count = s.episode_count || 0;
    if (abs <= count) return { seasonNumber: s.season_number, episodeNumber: abs };
    if (i === seasonList.length - 1) {
      return { seasonNumber: s.season_number, episodeNumber: Math.max(count, 1) };
    }
    abs -= count;
  }
  return { seasonNumber: startSeason, episodeNumber: Math.max(abs, 1) };
}

function markReleased(
  episodes: EpisodeDetail[],
  status: string | null,
  nextAiringEp: number | null
): EpisodeDetail[] {
  const nowMs = Date.now();
  const isFinished = status === "FINISHED";
  let encounteredUnreleased = false;

  return episodes.map((ep) => {
    let released = ep.isReleased !== false;
    if (isFinished) {
      released = true;
    } else if (status === "NOT_YET_RELEASED") {
      released = false;
    } else if (nextAiringEp && ep.episodeNum >= nextAiringEp) {
      released = false;
    } else if (ep.releasedDate) {
      const t = new Date(ep.releasedDate).getTime();
      if (!Number.isNaN(t) && t > nowMs) released = false;
    }
    if (encounteredUnreleased) released = false;
    if (!released) encounteredUnreleased = true;
    return { ...ep, isReleased: released };
  });
}

export async function buildSeasonEpisodes(
  rawId: string,
  seasonId: string
): Promise<{ episodes: EpisodeDetail[]; seasonOverview: string | null } | null> {
  const cacheKey = `v5-${rawId}|${seasonId}`;
  const hit = episodesCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data;

  const built = await buildAnimeCatalog(rawId);
  if (!built) return null;

  const { catalog, seasonMappings } = built;
  const season =
    catalog.seasons.find((s) => s.id === seasonId) ||
    catalog.seasons.find((s) => s.id === catalog.openedSeasonId);
  if (!season) return null;

  const mapping = seasonMappings[season.id] || {
    tmdbId: season.tmdbId ?? null,
    tmdbSeason: season.tmdbSeasonNumber ?? null,
    episodeOffset: season.episodeOffset ?? 0,
    mapping: null,
  };

  const { tmdbId, tmdbSeason, episodeOffset } = mapping;
  const isCurrent = season.id === catalog.openedSeasonId;
  const seriesStatus = season.status || catalog.anime.status || null;
  const nextAiringEp = isCurrent ? (catalog.anime.nextAiringEpisode?.episode ?? null) : null;

  // Known episode count — real numbers only, never fabricated.
  let knownCount: number | null = season.totalEpisodes > 0 ? season.totalEpisodes : null;
  if (!knownCount) {
    knownCount = mapping.mapping?.maxEpisode ?? null;
  }
  if (!knownCount && isCurrent && catalog.anime.totalEpisodes) {
    knownCount = catalog.anime.totalEpisodes;
  }

  let tmdbShowSeasons: { season_number: number; episode_count: number; name?: string; overview?: string | null }[] | null = null;
  const tmdbSeasonData: Record<number, TmdbSeasonEpisodes | null> = {};

  if (tmdbId && tmdbSeason !== null) {
    const show = await getTmdbShow(tmdbId);
    tmdbShowSeasons = show?.seasons || null;
    tmdbSeasonData[tmdbSeason] = await getTmdbSeasonEpisodes(tmdbId, tmdbSeason);
  }

  // When count is unknown, derive a safe bound from TMDB (only actual aired
  // eps). Long-running anime span MULTIPLE TMDB seasons, so sum every season
  // from the mapping start — otherwise One Piece would stop at season 1's 61.
  let bound: number | null = knownCount;
  if (!bound && tmdbShowSeasons && tmdbSeason !== null && tmdbShowSeasons.length > 0) {
    const startIdx = tmdbShowSeasons.findIndex((s) => s.season_number === tmdbSeason);
    if (startIdx >= 0) {
      let total = 0;
      for (let i = startIdx; i < tmdbShowSeasons.length; i++) {
        total += tmdbShowSeasons[i].episode_count || 0;
      }
      bound = Math.max(total - episodeOffset, 0);
    }
  }
  if (!bound && tmdbSeasonData[tmdbSeason ?? 1]) {
    const eps = tmdbSeasonData[tmdbSeason ?? 1]?.episodes || [];
    bound = Math.max(eps.length - episodeOffset, 0);
  }
  if (!bound && mapping.mapping?.maxEpisode) bound = mapping.mapping.maxEpisode;
  if (!bound) {
    const result = { episodes: [], seasonOverview: null };
    episodesCache.set(cacheKey, { data: result, expires: Date.now() + EPISODES_TTL });
    return result;
  }

  const count = Math.min(Math.max(bound, 0), MAX_EPISODES);

  // Fetch EVERY TMDB season the anime spans into (start→end, inclusive) so
  // long-running shows get thumbnails/titles/runtimes for ALL episodes, not
  // just the first and last season. Long anime (One Piece, Gintama) span many
  // TMDB seasons, so fetch in parallel — results are CDN-cached by tmdbFetch.
  if (tmdbId && tmdbSeason !== null && tmdbShowSeasons && tmdbShowSeasons.length > 0) {
    const startPos = mapPosition(1, tmdbSeason, episodeOffset, tmdbShowSeasons);
    const endPos = mapPosition(count, tmdbSeason, episodeOffset, tmdbShowSeasons);
    const first = Math.min(startPos.seasonNumber, endPos.seasonNumber);
    const last = Math.max(startPos.seasonNumber, endPos.seasonNumber);
    const missing: number[] = [];
    for (let sn = first; sn <= last; sn++) {
      if (tmdbSeasonData[sn] === undefined) missing.push(sn);
    }
    await Promise.all(
      missing.map(async (sn) => {
        tmdbSeasonData[sn] = await getTmdbSeasonEpisodes(tmdbId, sn);
      })
    );
  }

  const azEps = mapping.mapping?.episodes || new Map<number, any>();
  const seasonOverview =
    tmdbSeasonData[tmdbSeason ?? 1]?.overview || tmdbShowSeasons?.find((s) => s.season_number === tmdbSeason)?.overview || null;

  const episodes: EpisodeDetail[] = [];
  // Two lookup maps, because TMDB long-runners use two different episode
  // numbering schemes:
  //  - per-season (each season restarts at 1): `${season}-${episode_number}`
  //  - continuous/global (One Piece season 2 starts at ep 62): global number
  const tmdbByPosition = new Map<string, any>();
  const tmdbByGlobalNum = new Map<number, any>();
  for (const [sn, data] of Object.entries(tmdbSeasonData)) {
    for (const ep of data?.episodes || []) {
      tmdbByPosition.set(`${sn}-${ep.episode_number}`, ep);
      if (!tmdbByGlobalNum.has(ep.episode_number)) {
        tmdbByGlobalNum.set(ep.episode_number, ep);
      }
    }
  }

  for (let i = 1; i <= count; i++) {
    const azEp = azEps.get(i);
    const azTitle =
      azEp?.title?.en || azEp?.title?.["x-jat"] || azEp?.title?.ja || null;

    let tmdbEp: any = null;
    if (tmdbId) {
      const targetGlobal = azEp?.absoluteEpisodeNumber ?? (i + episodeOffset);
      const pos = (tmdbSeason !== null && tmdbShowSeasons && tmdbShowSeasons.length > 0)
        ? mapPosition(i, tmdbSeason, episodeOffset, tmdbShowSeasons)
        : { seasonNumber: tmdbSeason ?? 1, episodeNumber: i + episodeOffset };

      // 1. Direct per-season position lookup (e.g. "1-5" or "2-1")
      tmdbEp = tmdbByPosition.get(`${pos.seasonNumber}-${pos.episodeNumber}`);

      // 2. Global/Continuous episode number lookup (e.g. Naruto ep 53, One Piece ep 500)
      if (!tmdbEp) {
        tmdbEp = tmdbByGlobalNum.get(targetGlobal) || tmdbByGlobalNum.get(i);
      }

      // 3. Season + global episode number lookup (e.g. "2-53")
      if (!tmdbEp) {
        tmdbEp = tmdbByPosition.get(`${pos.seasonNumber}-${targetGlobal}`);
      }
    }

    episodes.push({
      episodeId: `${season.id}-${i}`,
      episodeNum: i,
      title: tmdbEp?.name || azTitle || `Episode ${i}`,
      description: tmdbEp?.overview || azEp?.overview || azEp?.summary || null,
      thumbnail: tmdbStillUrl(tmdbEp?.still_path) || azEp?.image || null,
      releasedDate: tmdbEp?.air_date || azEp?.airDate || null,
      isFiller: false,
      isRecap: false,
      malUrl: azEp?.malId ? `https://myanimelist.net/anime/${azEp.malId}/episode/${i}` : null,
      seasonNum: 1,
      seasonId: season.id,
      seasonName: season.name,
      seasonMalId: season.idMal ?? null,
      runtime: tmdbEp?.runtime ?? null,
      vote_average: tmdbEp?.vote_average ?? undefined,
      vote_count: tmdbEp?.vote_count ?? undefined,
      tmdbSeasonNumber: tmdbSeason ?? undefined,
      tmdbEpisodeNumber: tmdbEp?.episode_number ?? undefined,
    });
  }

  let finalEps = markReleased(episodes, seriesStatus, nextAiringEp);
  let usedJikanFallback = false;

  // Secondary: Jikan only when the primary chain produced nothing usable.
  if (finalEps.length === 0 && season.idMal) {
    const jikanEps = await getJikanEpisodes(season.idMal, count);
    if (jikanEps) {
      usedJikanFallback = true;
      finalEps = jikanEps
        .slice(0, count)
        .map((ep) => ({
          ...ep,
          episodeId: `${season.id}-${ep.episodeNum}`,
          seasonNum: 1,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal ?? null,
        }));
      finalEps = markReleased(finalEps, seriesStatus, nextAiringEp);
    }
  }

  // Enrich episodes with AnimeFillerList filler flags
  if (finalEps.length > 0 && count <= 2000) {
    const fillerLookup = await fetchFillerLookupFromAnimeFillerList(
      season.name,
      catalog.anime.name,
      catalog.anime.jname
    );
    if (fillerLookup) {
      finalEps = finalEps.map((ep) => ({
        ...ep,
        isFiller: isEpisodeFiller(fillerLookup, ep.episodeNum, episodeOffset),
      }));
    }
  }

  const result = { episodes: finalEps.sort((a, b) => a.episodeNum - b.episodeNum), seasonOverview };
  episodesCache.set(cacheKey, { data: result, expires: Date.now() + EPISODES_TTL });
  return result;
}
