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
      const tmdbId = (season as any).tmdbId;
      const tmdbSeasonNum = season.tmdbSeasonNumber;
      const episodeOffset = (season as any).episodeOffset || 0;
      const isTMDBReady = tmdbId && tmdbSeasonNum !== undefined && tmdbSeasonNum !== null;

      let seasonEps: any[] = [];
      let seasonOverview: string | null = null;

      if (isTMDBReady) {
        // ── TMDB is the source of truth for episodes ─────────────────────
        const tmdbEpisodes = await fetchTmdbEpisodeData(tmdbId, [tmdbSeasonNum]);

        // Get Jikan data using the anime's MAL ID for thumbnails/descriptions
        let jikanEps: any[] = [];
        const animeMalId = season.idMal;
        if (animeMalId) {
          try {
            // Note: Jikan episode numbering is specific to this AniList season (starts at 1)
            const realEps = await fetchEpisodesFromJikan(
              animeMalId, season.id,
              season.totalEpisodes
            );
            if (realEps) jikanEps = realEps;
          } catch { /* use TMDB-only */ }
        }

        // Build episodes from TMDB, overlay Jikan data
        for (let i = 1; i <= season.totalEpisodes; i++) {
          const tmdbEpNum = episodeOffset + i;
          const tmdbEp = tmdbEpisodes.get(`${tmdbSeasonNum}-${tmdbEpNum}`);
          const jikanMatch = jikanEps.find(j => j.episodeNum === i);
          
          seasonEps.push({
            episodeId: jikanMatch?.episodeId || `${season.id}-${i}`,
            episodeNum: i,
            title: tmdbEp?.title || jikanMatch?.title || `Episode ${i}`,
            thumbnail: tmdbEp?.thumbnail || jikanMatch?.thumbnail || null,
            malUrl: jikanMatch?.malUrl || null,
            isFiller: jikanMatch?.isFiller || false,
            releasedDate: jikanMatch?.releasedDate || null,
            description: tmdbEp?.description || jikanMatch?.description || null,
            vote_average: tmdbEp?.vote_average,
            runtime: tmdbEp?.runtime,
            seasonNum: seasonNumFromList,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          });
        }

        // Fetch TMDB season overview
        try {
          const tmdbSeasonData = await tmdbFetch(`/tv/${tmdbId}/season/${tmdbSeasonNum}`) as { overview?: string };
          if (tmdbSeasonData) seasonOverview = tmdbSeasonData.overview || null;
        } catch { /* no overview */ }
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
        const tmdbId = (season as any).tmdbId;
        const tmdbSeasonNum = season.tmdbSeasonNumber;
        const episodeOffset = (season as any).episodeOffset || 0;
        const isTMDBReady = tmdbId && tmdbSeasonNum !== undefined && tmdbSeasonNum !== null;

        if (isTMDBReady) {
          const tmdbEpisodes = await fetchTmdbEpisodeData(tmdbId, [tmdbSeasonNum]);

          let jikanEps: any[] = [];
          const animeMalId = season.idMal;
          if (animeMalId) {
            try {
              const realEps = await fetchEpisodesFromJikan(
                animeMalId, String(season.id),
                season.totalEpisodes
              );
              if (realEps) jikanEps = realEps;
            } catch { /* use TMDB-only */ }
          }

          for (let i = 1; i <= season.totalEpisodes; i++) {
            const tmdbEpNum = episodeOffset + i;
            const tmdbEp = tmdbEpisodes.get(`${tmdbSeasonNum}-${tmdbEpNum}`);
            const jikanMatch = jikanEps.find(j => j.episodeNum === i);
            seasonEps.push({
              episodeId: jikanMatch?.episodeId || `${season.id}-${i}`,
              episodeNum: i,
              title: tmdbEp?.title || jikanMatch?.title || `Episode ${i}`,
              thumbnail: tmdbEp?.thumbnail || jikanMatch?.thumbnail || null,
              malUrl: jikanMatch?.malUrl || null,
              isFiller: jikanMatch?.isFiller || false,
              releasedDate: jikanMatch?.releasedDate || null,
              description: tmdbEp?.description || jikanMatch?.description || null,
              vote_average: tmdbEp?.vote_average,
              runtime: tmdbEp?.runtime,
              seasonNum: seasonNumParam,
              seasonId: String(season.id),
              seasonName: season.name,
              seasonMalId: season.idMal || null,
            });
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
    
    // Group and fetch episodes for each mapped season
    for (const season of meta.seasons) {
      const tmdbId = (season as any).tmdbId;
      const tmdbSeasonNum = season.tmdbSeasonNumber;
      const episodeOffset = (season as any).episodeOffset || 0;
      const isTMDBReady = tmdbId && tmdbSeasonNum !== undefined && tmdbSeasonNum !== null;
      const seasonIdx = meta.seasons.indexOf(season) + 1;

      if (isTMDBReady) {
        const tmdbEpisodes = await fetchTmdbEpisodeData(tmdbId, [tmdbSeasonNum]);
        let jikanEps: any[] = [];
        const animeMalId = season.idMal;
        if (animeMalId) {
          try {
            const realEps = await fetchEpisodesFromJikan(animeMalId, season.id, season.totalEpisodes);
            if (realEps) jikanEps = realEps;
          } catch { /* use TMDB-only */ }
        }

        for (let i = 1; i <= season.totalEpisodes; i++) {
          const tmdbEpNum = episodeOffset + i;
          const tmdbEp = tmdbEpisodes.get(`${tmdbSeasonNum}-${tmdbEpNum}`);
          const jikanMatch = jikanEps.find(j => j.episodeNum === i);
          episodes.push({
            episodeId: jikanMatch?.episodeId || `${season.id}-${i}`,
            episodeNum: i,
            title: tmdbEp?.title || jikanMatch?.title || `Episode ${i}`,
            thumbnail: tmdbEp?.thumbnail || jikanMatch?.thumbnail || null,
            malUrl: jikanMatch?.malUrl || null,
            isFiller: jikanMatch?.isFiller || false,
            releasedDate: jikanMatch?.releasedDate || null,
            description: tmdbEp?.description || jikanMatch?.description || null,
            vote_average: tmdbEp?.vote_average,
            runtime: tmdbEp?.runtime,
            seasonNum: seasonIdx,
            seasonId: season.id,
            seasonName: season.name,
            seasonMalId: season.idMal || null,
          });
        }
      } else {
        // Fallback to placeholders or meta episodes for this season
        const metaEpsForSeason = meta.episodes.filter(e => e.seasonId === season.id);
        const seasonEps = metaEpsForSeason.map((ep: any) => ({
          episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
          episodeNum: Number(ep.episodeNum || 1),
          title: ep.title || `Episode ${ep.episodeNum || 1}`,
          thumbnail: ep.thumbnail || null,
          malUrl: ep.malUrl || null,
          isFiller: ep.isFiller || false,
          releasedDate: ep.releasedDate || null,
          description: ep.description || null,
          seasonNum: seasonIdx,
          seasonId: season.id,
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));
        episodes.push(...seasonEps);
      }
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
