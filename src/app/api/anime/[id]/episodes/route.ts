export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { fetchEpisodesFromJikan, fetchEpisodesFromJikanPage, getAnimeDetails, fetchEpisodesFromAniZip, fetchEpisodesFromTatakai, fetchEpisodesFromKitsu, fetchFillerLookupFromAnimeFillerList, DEFAULT_FETCH_USER_AGENT } from "@/lib/anime-fetch";
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

function parseSeasonAndOffsetFromTitle(title: string): { tmdbSeason: number; episodeOffset: number } {
  if (!title) return { tmdbSeason: 1, episodeOffset: 0 };
  const lower = title.toLowerCase();

  // Attack on Titan & General "Final Season" rules
  if (lower.includes("final season") || lower.includes("season 4") || lower.includes("4th season")) {
    if (lower.includes("part 3") || lower.includes("final chapters") || lower.includes("kanketsu-hen")) {
      return { tmdbSeason: 4, episodeOffset: 28 };
    }
    if (lower.includes("part 2") || lower.includes("2nd part")) {
      return { tmdbSeason: 4, episodeOffset: 16 };
    }
    return { tmdbSeason: 4, episodeOffset: 0 };
  }

  if (lower.includes("season 3") || lower.includes("3rd season")) {
    if (lower.includes("part 2") || lower.includes("2nd part")) {
      return { tmdbSeason: 3, episodeOffset: 12 };
    }
    return { tmdbSeason: 3, episodeOffset: 0 };
  }

  if (lower.includes("season 2") || lower.includes("2nd season")) {
    if (lower.includes("part 2") || lower.includes("cour 2")) {
      return { tmdbSeason: 2, episodeOffset: 12 };
    }
    return { tmdbSeason: 2, episodeOffset: 0 };
  }

  // Explicit Season number regex fallback (e.g. "Season 5", "5th Season", "S5")
  const seasonMatch = lower.match(/(?:season|s)\s*(\d+)/i) || lower.match(/(\d+)(?:st|nd|rd|th)\s*season/i);
  if (seasonMatch && seasonMatch[1]) {
    const sNum = parseInt(seasonMatch[1], 10);
    if (!isNaN(sNum) && sNum > 0) {
      const offsetMatch = lower.match(/(?:part|cour)\s*(\d+)/i);
      const partNum = offsetMatch ? parseInt(offsetMatch[1], 10) : 1;
      const episodeOffset = partNum > 1 ? 12 : 0;
      return { tmdbSeason: sNum, episodeOffset };
    }
  }

  return { tmdbSeason: 1, episodeOffset: 0 };
}

function enrichEpisodeReleaseStatus(episodes: any[], meta: any): any[] {
  const nowMs = Date.now();

  const nextAiringEpNum = meta?.anime?.nextAiringEpisode?.episode || null;
  const isNotYetReleased = meta?.anime?.status === "NOT_YET_RELEASED";

  let encounteredUnreleased = false;
  return episodes.map((ep: any) => {
    let isReleased = ep.isReleased !== false;

    if (isNotYetReleased) {
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

// Robust helper to consolidate and enrich episode lists from AniZip, Jikan, Tatakai, and Kitsu
async function getEnrichedEpisodesList(
  seasonId: string,
  seasonName: string,
  totalEpisodes: number,
  idMal: number | string | null
): Promise<any[]> {
  let seasonEps: any[] = [];

  // 1, 2 & 3. Try AniZip, Jikan, and Tatakai in parallel.
  // Filler lookup is deliberately NOT awaited here — it scrapes a 3rd party website
  // (animefillerlist.com) which is slow and unreliable. Running it in parallel with
  // a strict timeout and merging results after ensures it never blocks episode delivery.
  const fillerTimeout = new Promise<null>(r => setTimeout(() => r(null), 3500));
  const fillerFetchPromise = fetchFillerLookupFromAnimeFillerList(seasonName);

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
  const secondarySources = [jikanEps, tatakaiEps, aniZipEps].filter((s): s is any[] => Array.isArray(s) && s.length > 0);
  if (seasonEps.length > 0) {
    for (const src of secondarySources) {
      seasonEps = seasonEps.map((ep) => {
        const match = src.find(s => s && s.episodeNum === ep.episodeNum);
        const isGenericTitle = !ep.title || ep.title === `Episode ${ep.episodeNum}`;
        // Only apply isFiller when the fillerLookup plausibly covers this show.
        // Heuristic: the lookup must have at least half as many episodes as totalEpisodes
        // to be considered a valid match. This prevents false-positive filler tags from
        // a wrong show page (e.g., animefillerlist returning a different series).
        const fillerLookupValid = fillerLookup != null &&
          (fillerLookup.filler.size + fillerLookup.mixed.size + (totalEpisodes * 0.3)) >= totalEpisodes * 0.4;
        return {
          ...ep,
          title: isGenericTitle && match?.title ? match.title : ep.title,
          thumbnail: ep.thumbnail || match?.thumbnail || null,
          description: ep.description || match?.description || null,
          isFiller: Boolean(ep.isFiller || match?.isFiller || (fillerLookupValid && fillerLookup?.filler.has(ep.episodeNum))),
        };
      });
    }
  }

  // LAST RESORT: only generate placeholder episodes if every real source failed
  if (!seasonEps || seasonEps.length === 0) {
    console.warn(`[EpisodesList] All sources failed for "${seasonName}" (id=${seasonId}). Using placeholder episodes as last resort.`);
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
        isPlaceholder: true, // Flag so client knows this is fallback data
        seasonId: seasonId,
        seasonName: seasonName,
        seasonMalId: idMal || null,
      });
    }
  }

  return seasonEps;
}

// NOTE: No module-level episodesCache Map — it is wiped on every Cloudflare
// Pages cold start. Cache-control headers and next: { revalidate } on upstream
// fetch calls handle CDN-level caching instead.
const animeCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
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
        season = meta.seasons?.find((s: any) => s.id === seasonId);
        
        // If still not found and we have a direct season meta, use its first season
        if (!season && directSeasonMeta) {
          const directSeason = directSeasonMeta.seasons?.find((s: any) => s.id === seasonId)
            || directSeasonMeta.seasons?.[0];
          if (directSeason) season = directSeason;
        }
        
        console.log(`[Episodes API] Season lookup: found=${!!season}, seasons:`, meta.seasons?.map((s: any) => ({ id: s.id, label: s.seasonLabel, tmdbSeason: s.tmdbSeasonNumber, offset: s.episodeOffset })));



        if (!season) {
          console.warn(`[Episodes API] Season ${seasonId} not found in any meta result`);
          return Response.json({ success: true, data: { episodes: [], totalEpisodes: 0 } }, { headers: animeCacheHeaders });
        }

        const idx = meta.seasons.findIndex((s: any) => s.id === seasonId);
        seasonNumFromList = idx >= 0 ? idx + 1 : 1;
      }

      // Client params always win over server-derived values
      let tmdbId = clientTmdbId ?? (season as any).tmdbId;
      let tmdbSeasonNum = clientTmdbSeasonNum ?? season.tmdbSeasonNumber;
      let episodeOffset = clientEpisodeOffset ?? (season as any).episodeOffset ?? 0;

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
          if (nextSeasonInTMDB) {
            // The next AniList season also maps to the same TMDB season — clamp to that boundary
            dynamicTotalEpisodes = (nextSeasonInTMDB.episodeOffset || 0) - episodeOffset;
          } else if (currentTmdbSeason) {
            const currentTmdbEpCount = Math.max((currentTmdbSeason.episode_count || 0) - episodeOffset, 0);
            const futureSeasons = tmdbSeasonsList.filter((s: any) => s.season_number >= (tmdbSeasonNum || 1));
            const totalTmdbAvailable = Math.max(futureSeasons.reduce((acc: number, s: any) => acc + s.episode_count, 0) - episodeOffset, 0);

            if (knownEpisodeCount) {
              // AniList has a definitive count — use it as the ceiling.
              // Only allow TMDB to expand beyond AniList if TMDB count is higher AND the season is still airing.
              if (isSeasonFinished) {
                dynamicTotalEpisodes = knownEpisodeCount;
              } else {
                dynamicTotalEpisodes = Math.max(knownEpisodeCount, Math.min(currentTmdbEpCount, totalTmdbAvailable));
              }
            } else {
              // AniList episode count unknown — trust TMDB
              dynamicTotalEpisodes = Math.max(currentTmdbEpCount, totalTmdbAvailable, safeTotalEpisodes);
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
                  signal: AbortSignal.timeout(6000),
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

          // If overlayEps (AniZip/Jikan/Tatakai) contains extra episodes beyond TMDB count, append them!
          if (overlayEps && overlayEps.length > 0) {
            const maxOverlayNum = Math.max(...overlayEps.map(e => e.episodeNum || 0));
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
        const lacksRealEpisodes = !enrichedEps || enrichedEps.length === 0 || enrichedEps.every((e: any) => e.isPlaceholder);

        // Fallback: If primary sources failed/placeholders on edge, search TMDB by title!
        if (lacksRealEpisodes && season.name) {
          try {
            const parsed = parseSeasonAndOffsetFromTitle(season.name);
            const targetTmdbSeason = parsed.tmdbSeason || 1;
            const targetOffset = parsed.episodeOffset || 0;

            const cleanName = season.name.replace(/\b(season\s*\d+|part\s*\d+|cour\s*\d+|\d+(st|nd|rd|th)\s*season|final season)\b.*/gi, "").replace(/[:\-\–]/g, " ").trim() || season.name;
            const searchData = await tmdbFetch(`/search/tv?query=${encodeURIComponent(cleanName)}&include_adult=false`).catch(() => null) as any;
            if (searchData?.results && searchData.results.length > 0) {
              const match = searchData.results[0];
              if (match?.id) {
                const searchedTmdbId = match.id;
                console.log(`[Episodes API] TMDB Title Search found tmdbId=${searchedTmdbId} for "${season.name}". Fetching TMDB Season ${targetTmdbSeason}, offset ${targetOffset}`);
                const tmdbSeasonData = await tmdbFetch(`/tv/${searchedTmdbId}/season/${targetTmdbSeason}`).catch(() => null) as any;
                if (tmdbSeasonData?.episodes && tmdbSeasonData.episodes.length > 0) {
                  const rawEps = tmdbSeasonData.episodes.slice(targetOffset);
                  if (rawEps.length > 0) {
                    enrichedEps = rawEps.map((ep: any, idx: number) => ({
                      episodeId: `${season.id}-${idx + 1}`,
                      episodeNum: idx + 1,
                      title: ep.name || `Episode ${idx + 1}`,
                      thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
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

          const maxCap = isSpecialFormat
            ? 1
            : knownCount
              ? knownCount
              : Math.max(maxReleased + 1, nextAiringEp || 0, 12);

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
      seasonEps = enrichEpisodeReleaseStatus(seasonEps, meta);

      const knownTotal = season.totalEpisodes && season.totalEpisodes < 1499 ? season.totalEpisodes : null;
      const nextAiring = meta?.anime?.nextAiringEpisode?.episode || null;
      const maxReleasedIndex = seasonEps.reduce((max: number, ep: any) => {
        return ep.isReleased !== false ? Math.max(max, ep.episodeNum) : max;
      }, 0);

      const maxAllowedEpNum = knownTotal
        ? knownTotal
        : Math.min(Math.max(maxReleasedIndex + 1, nextAiring || 0, 12), 60);

      seasonEps = seasonEps.filter((ep: any) => ep.episodeNum <= maxAllowedEpNum);

      console.log(`[Episodes API] Built ${seasonEps.length} episodes for seasonId=${seasonId} (maxReleased=${maxReleasedIndex}, maxAllowed=${maxAllowedEpNum})`);

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
        seasonEps = enrichEpisodeReleaseStatus(seasonEps, meta);
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
        episodes.push(...seasonEps);
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

    return Response.json({
      success: true,
      data: { episodes, totalEpisodes: episodes.length },
    }, { headers: animeCacheHeaders });
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: "Failed to fetch episodes", success: false },
      { status: 500, headers: animeCacheHeaders }
    );
  }
}
