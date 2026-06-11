import { NextRequest } from "next/server";
import { fetchEpisodesFromJikan, fetchEpisodesFromJikanPage, getAnimeDetails } from "@/lib/anime-fetch";
import { tmdbFetch, fetchTmdbEpisodeData } from "@/lib/tmdb";

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
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
      return Response.json(resPayload);
    }

    // ── Fetch a specific season's episodes by its AniList ID ───────────────
    if (seasonId) {
      const meta = await getAnimeDetails(id, 100, true);
      if (!meta) throw new Error("Anime not found");

      const season = meta.seasons.find(s => s.id === seasonId);
      if (!season) {
        return Response.json({
          success: true,
          data: { episodes: [], totalEpisodes: 0 },
        });
      }

      const seasonNumFromList = meta.seasons.findIndex(s => s.id === seasonId) + 1;
      const isTMDBReady = meta.tmdbId && meta.tmdbSeasonMap && season.tmdbSeasonNumber !== undefined && season.tmdbSeasonNumber !== null;

      let seasonEps: any[] = [];

      let seasonOverview: string | null = null;

      if (isTMDBReady) {
        // ── TMDB is the source of truth for episodes ─────────────────────
        const tmdbSeasonNum = season.tmdbSeasonNumber!;
        const tmdbEpisodes = await fetchTmdbEpisodeData(meta.tmdbId!, [tmdbSeasonNum]);

        // Calculate global episode offset for this TMDB season.
        // TMDB seasons restart episode numbering at 1; Jikan uses global numbering.
        let episodeOffset = 0;
        for (const s of meta.seasons) {
          if (!s.tmdbSeasonNumber || s.tmdbSeasonNumber <= 0) continue;
          if (s.tmdbSeasonNumber === tmdbSeasonNum) break;
          episodeOffset += s.totalEpisodes;
        }

        // Get Jikan data using the anime's MAL ID for thumbnails/descriptions
        let jikanEps: any[] = [];
        const animeMalId = (meta.anime as any)?.idMal || season.idMal;
        if (animeMalId) {
          try {
            const realEps = await fetchEpisodesFromJikan(
              animeMalId, season.id,
              episodeOffset + season.totalEpisodes
            );
            if (realEps) jikanEps = realEps;
          } catch { /* use TMDB-only */ }
        }

        // Build episodes from TMDB, overlay Jikan data
        for (const [, tmdbEp] of tmdbEpisodes) {
          const globalEpNum = episodeOffset + tmdbEp.episodeNum;
          const jikanMatch = jikanEps.find(j => j.episodeNum === globalEpNum);
          seasonEps.push({
            episodeId: jikanMatch?.episodeId || `${season.id}-${tmdbEp.episodeNum}`,
            episodeNum: tmdbEp.episodeNum,
            title: tmdbEp.title || jikanMatch?.title || `Episode ${tmdbEp.episodeNum}`,
            thumbnail: tmdbEp.thumbnail || jikanMatch?.thumbnail || null,
            malUrl: jikanMatch?.malUrl || null,
            isFiller: jikanMatch?.isFiller || false,
            releasedDate: jikanMatch?.releasedDate || null,
            description: tmdbEp.description || jikanMatch?.description || null,
            vote_average: tmdbEp.vote_average,
            runtime: tmdbEp.runtime,
            seasonNum: seasonNumFromList,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          });
        }

        // Fetch TMDB season overview
        try {
          const tmdbSeasonData = await tmdbFetch(`/tv/${meta.tmdbId}/season/${tmdbSeasonNum}`) as { overview?: string };
          if (tmdbSeasonData) seasonOverview = tmdbSeasonData.overview || null;
        } catch { /* no overview */ }

        // Fill gaps: if TMDB has fewer episodes than expected, add placeholders
        const covered = new Set(seasonEps.map((e: any) => e.episodeNum));
        for (let i = 1; i <= season.totalEpisodes; i++) {
          if (!covered.has(i)) {
            const globalEpNum = episodeOffset + i;
            const jikanPlaceholder = jikanEps.find(j => j.episodeNum === globalEpNum);
            seasonEps.push({
              episodeId: jikanPlaceholder?.episodeId || `${season.id}-${i}`,
              episodeNum: i,
              title: jikanPlaceholder?.title || `Episode ${i}`,
              thumbnail: jikanPlaceholder?.thumbnail || null,
              malUrl: jikanPlaceholder?.malUrl || null,
              isFiller: jikanPlaceholder?.isFiller || false,
              releasedDate: jikanPlaceholder?.releasedDate || null,
              description: jikanPlaceholder?.description || null,
              seasonNum: seasonNumFromList,
              seasonId: season.id,
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
          }
        }
      } else {
        // ── No TMDB: use Jikan episodes ────────────────────────────────────
        // Start with placeholder episodes from meta
        const metaEpsForSeason = meta.episodes.filter(e => e.seasonId === seasonId);
        seasonEps = metaEpsForSeason.map((ep: any) => ({
          episodeId: ep.episodeId || `${seasonId}-${ep.episodeNum}`,
          episodeNum: Number(ep.episodeNum || 1),
          title: ep.title || `Episode ${ep.episodeNum || 1}`,
          thumbnail: ep.thumbnail || null,
          malUrl: ep.malUrl || null,
          isFiller: ep.isFiller || false,
          releasedDate: ep.releasedDate || null,
          description: ep.description || null,
          seasonNum: seasonNumFromList,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));

        // Fetch real episode data from Jikan if we have a MAL ID
        if (season.idMal) {
          try {
            const realEps = await fetchEpisodesFromJikan(season.idMal, season.id, season.totalEpisodes);
            if (realEps && realEps.length > 0) {
              seasonEps = realEps.map((ep) => ({
                ...ep,
                episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
                seasonNum: seasonNumFromList,
                seasonId: season.id,
                seasonName: season.name,
                seasonMalId: season.idMal,
              }));
            }
          } catch { /* use placeholders */ }
        }

        // Ensure we have all episode numbers covered
        const covered = new Set(seasonEps.map((e: any) => e.episodeNum));
        const isSpecialFormat = ["Movie", "OVA", "Special"].some(t => season.seasonLabel.startsWith(t));
        const count = isSpecialFormat ? 1 : season.totalEpisodes;
        for (let i = 1; i <= count; i++) {
          if (!covered.has(i)) {
            seasonEps.push({
              episodeId: `${season.id}-${i}`,
              episodeNum: i,
              title: `Episode ${i}`,
              thumbnail: null, malUrl: null, isFiller: false,
              releasedDate: null, description: null,
              seasonNum: seasonNumFromList,
              seasonId: season.id,
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
          }
        }
      }

      seasonEps.sort((a: any, b: any) => a.episodeNum - b.episodeNum);

      const resPayload = {
        success: true,
        data: {
          episodes: seasonEps,
          totalEpisodes: meta.totalEpisodes,
          seasonOverview,
        },
      };
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
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
        const isTMDBReady = meta.tmdbId && meta.tmdbSeasonMap && season.tmdbSeasonNumber !== undefined && season.tmdbSeasonNumber !== null;

        if (isTMDBReady) {
          const tmdbSeasonNum = season.tmdbSeasonNumber!;
          const tmdbEpisodes = await fetchTmdbEpisodeData(meta.tmdbId!, [tmdbSeasonNum]);

          let episodeOffset = 0;
          for (const s of meta.seasons) {
            if (!s.tmdbSeasonNumber || s.tmdbSeasonNumber <= 0) continue;
            if (s.tmdbSeasonNumber === tmdbSeasonNum) break;
            episodeOffset += s.totalEpisodes;
          }

          let jikanEps: any[] = [];
          const animeMalId = (meta.anime as any)?.idMal || season.idMal;
          if (animeMalId) {
            try {
              const realEps = await fetchEpisodesFromJikan(
                animeMalId, String(season.id),
                episodeOffset + season.totalEpisodes
              );
              if (realEps) jikanEps = realEps;
            } catch { /* use TMDB-only */ }
          }

          for (const [, tmdbEp] of tmdbEpisodes) {
            const globalEpNum = episodeOffset + tmdbEp.episodeNum;
            const jikanMatch = jikanEps.find(j => j.episodeNum === globalEpNum);
            seasonEps.push({
              episodeId: jikanMatch?.episodeId || `${season.id}-${tmdbEp.episodeNum}`,
              episodeNum: tmdbEp.episodeNum,
              title: tmdbEp.title || jikanMatch?.title || `Episode ${tmdbEp.episodeNum}`,
              thumbnail: tmdbEp.thumbnail || jikanMatch?.thumbnail || null,
              malUrl: jikanMatch?.malUrl || null,
              isFiller: jikanMatch?.isFiller || false,
              releasedDate: jikanMatch?.releasedDate || null,
              description: tmdbEp.description || jikanMatch?.description || null,
              vote_average: tmdbEp.vote_average,
              runtime: tmdbEp.runtime,
              seasonNum: seasonNumParam,
              seasonId: String(season.id),
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
          }

          const covered = new Set(seasonEps.map((e: any) => e.episodeNum));
          for (let i = 1; i <= season.totalEpisodes; i++) {
            if (!covered.has(i)) {
              const globalEpNum = episodeOffset + i;
              const jikanPlaceholder = jikanEps.find(j => j.episodeNum === globalEpNum);
              seasonEps.push({
                episodeId: jikanPlaceholder?.episodeId || `${season.id}-${i}`,
                episodeNum: i,
                title: jikanPlaceholder?.title || `Episode ${i}`,
                thumbnail: jikanPlaceholder?.thumbnail || null,
                malUrl: jikanPlaceholder?.malUrl || null,
                isFiller: jikanPlaceholder?.isFiller || false,
                releasedDate: jikanPlaceholder?.releasedDate || null,
                description: jikanPlaceholder?.description || null,
                vote_average: null, runtime: null,
                seasonNum: seasonNumParam,
                seasonId: String(season.id), seasonName: season.name,
                seasonMalId: season.idMal || null,
              });
            }
          }
        } else {
          const seasonInfo = meta.episodes.filter(e => e.seasonNum === seasonNumParam);
          seasonEps = seasonInfo.map((ep: any) => ({
            episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
            episodeNum: Number(ep.episodeNum || 1),
            title: ep.title || `Episode ${ep.episodeNum || 1}`,
            thumbnail: ep.thumbnail || null,
            malUrl: ep.malUrl || null,
            isFiller: ep.isFiller || false,
            releasedDate: ep.releasedDate || null,
            description: ep.description || null,
            seasonNum: seasonNumParam,
            seasonId: String(season.id),
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          }));

          if (season.idMal) {
            try {
              const realEps = await fetchEpisodesFromJikan(season.idMal, String(season.id), 100);
              if (realEps && realEps.length > 0) {
                seasonEps = realEps.map((ep) => ({
                  ...ep,
                  episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
                  seasonNum: seasonNumParam,
                  seasonId: String(season.id),
                  seasonName: season.name,
                  seasonMalId: season.idMal,
                }));
              }
            } catch { /* use placeholders */ }
          }

          const covered = new Set(seasonEps.map((e: any) => e.episodeNum));
          const isSpecial = ["Movie", "OVA", "Special"].some(t => season.seasonLabel.startsWith(t));
          const count = isSpecial ? 1 : season.totalEpisodes;
          for (let i = 1; i <= count; i++) {
            if (!covered.has(i)) {
              seasonEps.push({
                episodeId: `${season.id}-${i}`, episodeNum: i, title: `Episode ${i}`,
                thumbnail: null, malUrl: null, isFiller: false, releasedDate: null,
                description: null, seasonNum: seasonNumParam,
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
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
      return Response.json(resPayload);
    }

    // ── Default: fetch ALL seasons' episodes ───────────────────────────────
    const meta = await getAnimeDetails(id, 100, true);
    if (!meta) throw new Error("Anime not found");

    let episodes: any[] = [];
    const isTMDBReady = meta.tmdbId && meta.tmdbSeasonMap;

    if (isTMDBReady) {
      // Fetch Jikan data once for the whole anime
      let allJikanEps: any[] = [];
      const animeMalId = (meta.anime as any)?.idMal;
      if (animeMalId) {
        try {
          const totalEps = meta.seasons.reduce((sum, s) => sum + (s.tmdbSeasonNumber && s.tmdbSeasonNumber > 0 ? s.totalEpisodes : 0), 0);
          const realEps = await fetchEpisodesFromJikan(animeMalId, id, totalEps || 500);
          if (realEps) allJikanEps = realEps;
        } catch { /* use TMDB-only */ }
      }

      // Build episodes from all TMDB seasons
      let episodeOffset = 0;
      for (const season of meta.seasons) {
        if (season.tmdbSeasonNumber === undefined || season.tmdbSeasonNumber === null) continue;
        const tmdbEpisodes = await fetchTmdbEpisodeData(meta.tmdbId!, [season.tmdbSeasonNumber]);
        const seasonIdx = meta.seasons.findIndex(s => s.id === season.id) + 1;

        for (const [, tmdbEp] of tmdbEpisodes) {
          const globalEpNum = episodeOffset + tmdbEp.episodeNum;
          const jikanMatch = allJikanEps.find((j: any) => j.episodeNum === globalEpNum);
          episodes.push({
            episodeId: jikanMatch?.episodeId || `${season.id}-${tmdbEp.episodeNum}`,
            episodeNum: tmdbEp.episodeNum,
            title: tmdbEp.title || jikanMatch?.title || `Episode ${tmdbEp.episodeNum}`,
            thumbnail: tmdbEp.thumbnail || jikanMatch?.thumbnail || null,
            malUrl: jikanMatch?.malUrl || null,
            isFiller: jikanMatch?.isFiller || false,
            releasedDate: jikanMatch?.releasedDate || null,
            description: tmdbEp.description || jikanMatch?.description || null,
            vote_average: tmdbEp.vote_average,
            runtime: tmdbEp.runtime,
            seasonNum: seasonIdx,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          });
        }

        if (season.tmdbSeasonNumber > 0) episodeOffset += season.totalEpisodes;
      }
    } else {
      // Fallback: use meta episodes (placeholders from AniList)
      episodes = meta.episodes.map((ep: any) => ({
        episodeId: ep.episodeId || `${id}-${ep.episodeNum}`,
        episodeNum: Number(ep.episodeNum || ep.episode || 1),
        title: ep.title || `Episode ${ep.episodeNum || 1}`,
        thumbnail: ep.thumbnail || null,
        malUrl: ep.malUrl || null,
        isFiller: ep.isFiller || false,
        releasedDate: ep.releasedDate || null,
        description: ep.description || null,
        seasonNum: ep.seasonNum || null,
        seasonId: ep.seasonId || null,
        seasonName: ep.seasonName || null,
        seasonMalId: ep.seasonMalId || null,
      }));
    }

    const resPayload = {
      success: true,
      data: { episodes, totalEpisodes: episodes.length },
    };
    episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 });
    return Response.json(resPayload);
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: "Failed to fetch episodes", success: false },
      { status: 500 }
    );
  }
}
