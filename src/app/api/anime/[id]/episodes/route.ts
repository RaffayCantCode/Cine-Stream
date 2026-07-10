export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { fetchEpisodesFromJikan, fetchEpisodesFromJikanPage, getAnimeDetails, fetchEpisodesFromAniZip, fetchEpisodesFromKitsu } from "@/lib/anime-fetch";
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

// Robust helper to consolidate and enrich episode lists from AniZip, Jikan, and Kitsu
async function getEnrichedEpisodesList(
  seasonId: string,
  seasonName: string,
  totalEpisodes: number,
  idMal: number | string | null
): Promise<any[]> {
  let seasonEps: any[] = [];

  // 1 & 2. Try AniZip and Jikan in parallel
  const [aniZipEpsRes, jikanEpsRes] = await Promise.allSettled([
    fetchEpisodesFromAniZip(seasonId, totalEpisodes),
    idMal ? fetchEpisodesFromJikan(idMal, seasonId, totalEpisodes) : Promise.resolve([])
  ]);

  const aniZipEps = aniZipEpsRes.status === 'fulfilled' ? aniZipEpsRes.value : [];
  const jikanEps = jikanEpsRes.status === 'fulfilled' ? jikanEpsRes.value : [];

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
          isFiller: jEp?.isFiller || false,
        };
      });
    }
  }

  // Kitsu fallback and retries have been moved to be lazily evaluated only if TMDB fails
  // to prevent unnecessarily blocking the API for 2-3 seconds on 99% of requests.

  return seasonEps;
}

const episodesCache = new Map<string, { data: any; expires: number }>();

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
    return Response.json(cached.data);
  }

  try {
    // ── Lazy-load more episodes for a season (pagination) ──────────────────
    if (seasonMalId && page > 1) {
      const newEps = await fetchEpisodesFromJikanPage(seasonMalId, seasonId || id, page, batchSize);
      const resPayload = {
        success: true,
        data: { episodes: newEps, totalEpisodes: 0 },
      };
      if (newEps.length > 0) {
        episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
      }
      return Response.json(resPayload);
    }

    // ── Fetch a specific season's episodes by its AniList ID ───────────────
    if (seasonId) {
      console.log(`[Episodes API] Fetching seasonId=${seasonId} for anime id=${id}`);
      let meta = await getAnimeDetails(id, 1500, true);
      if (!meta) {
        console.error(`[Episodes API] getAnimeDetails returned null for id=${id}`);
        throw new Error("Anime not found");
      }

      let season = meta.seasons.find(s => s.id === seasonId);
      console.log(`[Episodes API] Initial season lookup: found=${!!season}, available seasons:`, meta.seasons.map(s => ({ id: s.id, name: s.name, label: s.seasonLabel, totalEp: s.totalEpisodes, tmdbId: (s as any).tmdbId, tmdbSeasonNum: s.tmdbSeasonNumber })));

      if (!season) {
        // Cache might be stale (AniList API transient failure on earlier fetch).
        // Force a fresh fetch with a different cache key.
        console.log(`[Episodes API] Season not found, forcing fresh fetch`);
        const freshMeta = await getAnimeDetails(id, 1500, true);
        if (freshMeta) {
          meta = freshMeta;
          season = meta.seasons.find(s => s.id === seasonId);
          console.log(`[Episodes API] Fresh fetch season lookup: found=${!!season}`);
        }
      }
      if (!season) {
        console.warn(`[Episodes API] Season ${seasonId} not found in any meta result`);
        return Response.json({
          success: true,
          data: { episodes: [], totalEpisodes: 0 },
        });
      }

      console.log(`[Episodes API] Season data:`, {
        id: season.id,
        name: season.name,
        label: season.seasonLabel,
        totalEpisodes: season.totalEpisodes,
        tmdbId: (season as any).tmdbId,
        tmdbSeasonNum: season.tmdbSeasonNumber,
        episodeOffset: (season as any).episodeOffset,
      });

      const seasonNumFromList = meta.seasons.findIndex(s => s.id === seasonId) + 1;
      const tmdbId = (season as any).tmdbId;
      const tmdbSeasonNum = season.tmdbSeasonNumber;
      const episodeOffset = (season as any).episodeOffset || 0;
      const isTMDBReady = tmdbId && tmdbSeasonNum !== undefined && tmdbSeasonNum !== null;

      let seasonEps: any[] = [];
      let seasonOverview: string | null = null;

      // Guard against zero/undefined totalEpisodes — default to 12 for TV seasons
      const safeTotalEpisodes = Math.max(season.totalEpisodes || 12, 1);
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
        if (tmdbSeasonsList.length > 0) {
          const currentTmdbSeason = tmdbSeasonsList.find((s: any) => s.season_number === (tmdbSeasonNum || 1));
          const nextSeasonInTMDB = meta.seasons.find((s: any) => 
            s.tmdbSeasonNumber === (tmdbSeasonNum || 1) && 
            (s.episodeOffset || 0) > episodeOffset &&
            s.totalEpisodes > 2 // Ignore OVAs and specials when clamping
          );
          if (nextSeasonInTMDB) {
            dynamicTotalEpisodes = (nextSeasonInTMDB.episodeOffset || 0) - episodeOffset;
          } else if (currentTmdbSeason) {
            dynamicTotalEpisodes = Math.max(safeTotalEpisodes, currentTmdbSeason.episode_count - episodeOffset);
            // Cap it to the exact AniList count (if known) to prevent bleeding into merged TMDB seasons
            if (season.totalEpisodes && season.totalEpisodes > 0) {
              dynamicTotalEpisodes = Math.min(dynamicTotalEpisodes, season.totalEpisodes);
            }
          }
        }

        const neededSeasons = new Set<number>();
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
            if (overlayEps.length === 0 && season.idMal) {
              try {
                const jikanEps = await fetchEpisodesFromJikan(season.idMal, season.id, safeTotalEpisodes);
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
              releasedDate: matchEp?.releasedDate || null,
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
        episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
      } else {
        console.warn(`[Episodes API] Not caching empty episode result for seasonId=${seasonId}`);
      }

      return Response.json(resPayload);
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
              releasedDate: matchEp?.releasedDate || null,
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
      }

      const resPayload = {
        success: true,
        data: { episodes: seasonEps, totalEpisodes: meta.totalEpisodes },
      };
      if (seasonEps.length > 0) {
        episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
      }
      return Response.json(resPayload);
    }

    // ── Default: fetch ALL seasons' episodes ───────────────────────────────
      let meta = await getAnimeDetails(id, 100, true);
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
            releasedDate: matchEp?.releasedDate || null,
            description: tmdbEp?.description || matchEp?.description || null,
            vote_average: tmdbEp?.vote_average,
              vote_count: tmdbEp?.vote_count,
            runtime: tmdbEp?.runtime,
            seasonNum: seasonIdx,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
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
          const metaEpsForSeason = meta.episodes.filter(e => e.seasonId === season.id);
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
        episodes.push(...seasonEps);
      }
    }

    const resPayload = {
      success: true,
      data: { episodes, totalEpisodes: episodes.length },
    };
    if (episodes.length > 0) {
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
    }
    const isDev = process.env.NODE_ENV === "development";
    return Response.json(resPayload, { 
      headers: { 
        "Cache-Control": isDev 
          ? "no-cache, no-store, must-revalidate" 
          : "public, s-maxage=3600, stale-while-revalidate=7200" 
      } 
    });
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: "Failed to fetch episodes", success: false },
      { status: 500 }
    );
  }
}
