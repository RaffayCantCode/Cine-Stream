export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { fetchEpisodesFromJikan, fetchEpisodesFromJikanPage, getAnimeDetails, fetchEpisodesFromAniZip, fetchEpisodesFromKitsu, fetchFillerLookupFromAnimeFillerList } from "@/lib/anime-fetch";
import { tmdbFetch, fetchTmdbEpisodeData } from "@/lib/tmdb";

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

function enrichEpisodeReleaseStatus(episodes: any[], meta: any): any[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const nextAiringEpNum = meta?.anime?.nextAiringEpisode?.episode || null;
  const isNotYetReleased = meta?.anime?.status === "NOT_YET_RELEASED";

  let encounteredUnreleased = false;
  return episodes.map((ep: any) => {
    let isReleased = true;

    if (isNotYetReleased) {
      isReleased = false;
    } else if (nextAiringEpNum && ep.episodeNum >= nextAiringEpNum) {
      isReleased = false;
    } else if (ep.releasedDate) {
      const dateOnlyStr = String(ep.releasedDate).split("T")[0];
      const epDate = new Date(`${dateOnlyStr}T00:00:00`);
      if (!isNaN(epDate.getTime()) && epDate.getTime() > todayTime) {
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

// Robust helper to consolidate and enrich episode lists from AniZip, Jikan, and Kitsu
async function getEnrichedEpisodesList(
  seasonId: string,
  seasonName: string,
  totalEpisodes: number,
  idMal: number | string | null
): Promise<any[]> {
  let seasonEps: any[] = [];

  // 1 & 2. Try AniZip and Jikan in parallel
  const [aniZipEpsRes, jikanEpsRes, fillerLookupRes] = await Promise.allSettled([
    fetchEpisodesFromAniZip(seasonId, totalEpisodes),
    idMal ? fetchEpisodesFromJikan(idMal, seasonId, totalEpisodes) : Promise.resolve([]),
    fetchFillerLookupFromAnimeFillerList(seasonName)
  ]);

  const aniZipEps = aniZipEpsRes.status === 'fulfilled' ? aniZipEpsRes.value : [];
  const jikanEps = jikanEpsRes.status === 'fulfilled' ? jikanEpsRes.value : [];
  const fillerLookup = fillerLookupRes.status === 'fulfilled' ? fillerLookupRes.value : null;

  if (aniZipEps && aniZipEps.length > 0) {
    seasonEps = aniZipEps;
  }

  if (jikanEps && jikanEps.length > 0) {
    if (seasonEps.length === 0) {
      seasonEps = jikanEps;
    } else {
      seasonEps = seasonEps.map((ep) => {
        const jEp = jikanEps.find(je => je.episodeNum === ep.episodeNum);
        return {
          ...ep,
          thumbnail: ep.thumbnail || jEp?.thumbnail || null,
          description: ep.description || jEp?.description || null,
          isFiller: Boolean(jEp?.isFiller || fillerLookup?.filler.has(ep.episodeNum)),
        };
      });
    }
  }

  if (!seasonEps || seasonEps.length === 0) {
    const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => seasonName?.includes(t));
    const count = isSpecialFormat ? 1 : Math.max(totalEpisodes || 12, 1);
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
        seasonId: seasonId,
        seasonName: seasonName,
        seasonMalId: idMal || null,
      });
    }
  }

  return seasonEps;
}

const episodesCache = new Map<string, { data: any; expires: number }>();
const animeCacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
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

  const cacheKey = `${id}:${searchParams.toString()}`;
  const cached = episodesCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return Response.json(cached.data, { headers: animeCacheHeaders });
  }

  try {
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
      if (newEps.length > 0) {
        episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 60000 });
      }
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
        // Slow path: derive mapping data from full meta lookup
        console.log(`[Episodes API] Slow path: fetching full meta for seasonId=${seasonId}, anime id=${id}`);
        meta = await getAnimeDetails(id, 1500, true);
        if (!meta) {
          console.error(`[Episodes API] getAnimeDetails returned null for id=${id}`);
          throw new Error("Anime not found");
        }

        season = meta.seasons.find((s: any) => s.id === seasonId);
        console.log(`[Episodes API] Season lookup: found=${!!season}, seasons:`, meta.seasons.map((s: any) => ({ id: s.id, label: s.seasonLabel, tmdbSeason: s.tmdbSeasonNumber, offset: s.episodeOffset })));

        if (!season && (clientTmdbId != null || clientTmdbSeasonNum != null)) {
          season = {
            id: seasonId,
            name: meta.anime.name,
            seasonLabel: "Episodes",
            totalEpisodes: meta.totalEpisodes || 12,
            isCurrent: seasonId === id,
            idMal: meta.anime.idMal ? parseInt(meta.anime.idMal, 10) : null,
            tmdbId: clientTmdbId,
            tmdbSeasonNumber: clientTmdbSeasonNum,
            episodeOffset: clientEpisodeOffset ?? 0,
          };
        }

        if (!season) {
          console.log(`[Episodes API] Season not found, forcing fresh fetch`);
          const freshMeta = await getAnimeDetails(id, 1500, true);
          if (freshMeta) {
            meta = freshMeta;
            season = meta.seasons.find((s: any) => s.id === seasonId);
          }
        }

        if (!season) {
          console.warn(`[Episodes API] Season ${seasonId} not found in any meta result`);
          return Response.json({ success: true, data: { episodes: [], totalEpisodes: 0 } }, { headers: animeCacheHeaders });
        }

        const idx = meta.seasons.findIndex((s: any) => s.id === seasonId);
        seasonNumFromList = idx >= 0 ? idx + 1 : 1;
      }

      // Client params always win over server-derived values
      const tmdbId = clientTmdbId ?? (season as any).tmdbId;
      const tmdbSeasonNum = clientTmdbSeasonNum ?? season.tmdbSeasonNumber;
      const episodeOffset = clientEpisodeOffset ?? (season as any).episodeOffset ?? 0;

      console.log(`[Episodes API] Using mapping details: tmdbId=${tmdbId}, tmdbSeasonNum=${tmdbSeasonNum}, episodeOffset=${episodeOffset}`);

      const isTMDBReady = tmdbId != null && !isNaN(tmdbId) && tmdbSeasonNum != null && !isNaN(tmdbSeasonNum);


      let seasonEps: any[] = [];
      let seasonOverview: string | null = null;

      // Guard against zero/undefined totalEpisodes — default to 1500 for TV seasons
      const safeTotalEpisodes = Math.max(season.totalEpisodes || 1500, 1);
      if (safeTotalEpisodes !== season.totalEpisodes) {
        console.warn(`[Episodes API] Clamped totalEpisodes from ${season.totalEpisodes} to ${safeTotalEpisodes} for seasonId=${seasonId}`);
      }

      console.log(`[Episodes API] TMDB ready: ${isTMDBReady}, tmdbId: ${tmdbId}, tmdbSeasonNum: ${tmdbSeasonNum}, totalEpisodes: ${safeTotalEpisodes}`);

      if (isTMDBReady) {
        // ── TMDB is the source of truth for episodes ─────────────────────
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
        let dynamicTotalEpisodes = safeTotalEpisodes;
        // True episode count from AniList (null if unknown/airing)
        const knownEpisodeCount = season.totalEpisodes && season.totalEpisodes < 1499 ? season.totalEpisodes : null;
        if (tmdbSeasonsList.length > 0) {
          const currentTmdbSeason = tmdbSeasonsList.find((s: any) => s.season_number === (tmdbSeasonNum || 1));
          const nextSeasonInTMDB = (meta?.seasons || []).find((s: any) => 
            s.tmdbSeasonNumber === (tmdbSeasonNum || 1) && 
            (s.episodeOffset || 0) > episodeOffset &&
            s.totalEpisodes > 2 // Ignore OVAs and specials when clamping
          );
          if (nextSeasonInTMDB) {
            // The next AniList season also maps to the same TMDB season — clamp to that boundary
            dynamicTotalEpisodes = (nextSeasonInTMDB.episodeOffset || 0) - episodeOffset;
          } else if (currentTmdbSeason) {
            if (knownEpisodeCount) {
              // AniList has a real episode count: trust it as authoritative
              dynamicTotalEpisodes = knownEpisodeCount;
            } else {
              // AniList count is unknown (airing): sum all TMDB episodes from this season onwards
              const futureSeasons = tmdbSeasonsList.filter((s: any) => s.season_number >= (tmdbSeasonNum || 1));
              const totalTmdbAvailable = futureSeasons.reduce((acc: number, s: any) => acc + s.episode_count, 0) - episodeOffset;
              
              // Also check if AniZip mapped more episodes than TMDB has logged
              // We can't await overlayEpsPromise here synchronously, so we just use totalTmdbAvailable
              dynamicTotalEpisodes = totalTmdbAvailable;
            }
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
            console.log(`[Episodes API] Overlay also empty! Retrying AniZip/Jikan and falling back to Kitsu...`);
            await new Promise(r => setTimeout(r, 2000)); // The 2-second sleep to handle Cloudflare/AniZip transient errors
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
                  signal: AbortSignal.timeout(4000),
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
              seasonNum: seasonNumFromList,
              seasonId: season.id,
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
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
        // ── No TMDB: use enriched episodes ────────────────────────────────────
        const enrichedEps = await getEnrichedEpisodesList(season.id, season.name, safeTotalEpisodes, season.idMal || null);
        seasonEps = enrichedEps.map((ep) => ({
          ...ep,
          episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
          seasonNum: seasonNumFromList,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));

        const covered = new Set(seasonEps.map((e: any) => e.episodeNum));
        const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => season.seasonLabel.startsWith(t));
        const count = isSpecialFormat ? 1 : safeTotalEpisodes;
        for (let i = 1; i <= count; i++) {
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

      seasonEps.sort((a: any, b: any) => a.episodeNum - b.episodeNum);
      seasonEps = enrichEpisodeReleaseStatus(seasonEps, meta);

      console.log(`[Episodes API] Built ${seasonEps.length} episodes for seasonId=${seasonId}`);

      const resPayload = {
        success: true,
        data: {
          episodes: seasonEps,
          totalEpisodes: meta.totalEpisodes,
          seasonOverview,
        },
      };

      // Don't cache empty results — allow retries to re-fetch
      if (seasonEps.length > 0) {
        episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 60000 });
      } else {
        console.warn(`[Episodes API] Not caching empty episode result for seasonId=${seasonId}`);
      }

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
        seasonEps = enrichEpisodeReleaseStatus(seasonEps, meta);
      }

      const resPayload = {
        success: true,
        data: { episodes: seasonEps, totalEpisodes: meta.totalEpisodes },
      };
      if (seasonEps.length > 0) {
        episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 60000 });
      }
      return Response.json(resPayload, { headers: animeCacheHeaders });
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
            seasonNum: seasonNumFromList,
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
          seasonNum: seasonNumFromList,
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
            seasonNum: seasonIdx,
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
        episodes.push(...seasonEps);
      }

      if (episodes.length === 0 && season) {
        const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => season.seasonLabel?.startsWith(t));
        const epCount = isSpecialFormat ? 1 : Math.max(season.totalEpisodes || 12, 1);
        for (let i = 1; i <= epCount; i++) {
          episodes.push({
            episodeId: `${season.id}-${i}`,
            episodeNum: i,
            title: i === 1 && isSpecialFormat ? season.name : `Episode ${i}`,
            description: null,
            thumbnail: null,
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
    }

    episodes = enrichEpisodeReleaseStatus(episodes, meta);

    const resPayload = {
      success: true,
      data: { episodes, totalEpisodes: episodes.length },
    };
    if (episodes.length > 0) {
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 60000 });
    }
    return Response.json(resPayload, { headers: animeCacheHeaders });
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: "Failed to fetch episodes", success: false },
      { status: 500, headers: animeCacheHeaders }
    );
  }
}
