import { NextRequest } from "next/server";
import { fetchAnimeApi, fetchEpisodesFromJikan, fetchEpisodesFromJikanPage, getAnimeDetails } from "@/lib/anime-fetch";
import { searchTmdbShow, fetchTmdbEpisodeData } from "@/lib/tmdb";

function parseAnimeTitleAndSeason(rawName: string): { baseTitle: string; tmdbSeason: number } {
  let baseTitle = rawName;
  let tmdbSeason = 1;

  // Pattern for "Season N"
  const seasonMatch = rawName.match(/[\s:]+Season\s+(\d+)/i);
  if (seasonMatch) {
    tmdbSeason = parseInt(seasonMatch[1], 10);
    baseTitle = rawName.replace(/[\s:]+Season\s+(\d+).*/i, "").trim();
    return { baseTitle, tmdbSeason };
  }

  // Word-based seasons
  const wordSeasons: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10
  };

  for (const [word, num] of Object.entries(wordSeasons)) {
    const wordRegex = new RegExp(`[\\s:]+${word}\\s+season`, "i");
    if (wordRegex.test(rawName)) {
      tmdbSeason = num;
      baseTitle = rawName.replace(new RegExp(`[\\s:]+${word}\\s+season.*`, "i"), "").trim();
      return { baseTitle, tmdbSeason };
    }
  }

  // "Nth Season" pattern
  const nthMatch = rawName.match(/[\s:]+(\d+)(?:st|nd|rd|th)\s+Season/i);
  if (nthMatch) {
    tmdbSeason = parseInt(nthMatch[1], 10);
    baseTitle = rawName.replace(/[\s:]+(\d+)(?:st|nd|rd|th)\s+Season.*/i, "").trim();
    return { baseTitle, tmdbSeason };
  }

  // "Final Season"
  if (/Final\s+Season/i.test(rawName)) {
    tmdbSeason = 4; // AoT Final Season is Season 4
    baseTitle = rawName.replace(/[\s:]+Final\s+Season.*/i, "").trim();
    return { baseTitle, tmdbSeason };
  }

  // Strip split cour / part suffixes from TMDB search
  if (/Part\s+\d+/i.test(rawName)) {
    baseTitle = rawName.replace(/[\s:]+Part\s+\d+.*/i, "").trim();
  }
  if (/Cour\s+\d+/i.test(rawName)) {
    baseTitle = rawName.replace(/[\s:]+Cour\s+\d+.*/i, "").trim();
  }

  // Clean trailing punctuation
  baseTitle = baseTitle.replace(/[\s:-]+$/, "").trim();

  return { baseTitle, tmdbSeason };
}

function cleanTitleForMatching(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  // NEW: prefer seasonId (actual AniList ID), fall back to seasonNum (index)
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
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 }); // 30 mins
      return Response.json(resPayload);
    }

    // ── Fetch a specific season's episodes by its AniList ID (preferred) ───
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

      // Find the 1-based season number from the seasons list
      const seasonNumFromList = meta.seasons.findIndex(s => s.id === seasonId) + 1;

      let seasonEps: any[] = [];

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

      // Ensure we have all episode numbers covered (fill gaps)
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
      seasonEps.sort((a: any, b: any) => a.episodeNum - b.episodeNum);

      // TMDB enrichment for this season (with season parsing & dynamic offset calculation)
      try {
        const animeName = meta.anime.name;
        const animeJname = meta.anime.jname;
        const seasonYear: number | undefined = meta.anime.seasonYear ?? undefined;

        const parsed = parseAnimeTitleAndSeason(animeName);
        const parsedJ = animeJname ? parseAnimeTitleAndSeason(animeJname) : null;

        let tmdbId: number | null = null;
        if (parsed.baseTitle) tmdbId = await searchTmdbShow(parsed.baseTitle, seasonYear);
        if (!tmdbId && parsedJ?.baseTitle) tmdbId = await searchTmdbShow(parsedJ.baseTitle, seasonYear);

        if (tmdbId) {
          // Fetch the parsed season episodes from TMDB
          const seasonsToFetch = [parsed.tmdbSeason];
          const tmdbEpisodes = await fetchTmdbEpisodeData(tmdbId, seasonsToFetch);

          // Try to match by title to find an episode number offset (crucial for split-cours/parts)
          let matchedOffset: number | null = null;
          for (const ep of seasonEps) {
            const jTitle = ep.title ? cleanTitleForMatching(ep.title) : "";
            // Skip generic episode/special titles
            if (!jTitle || jTitle.startsWith("episode ") || jTitle.startsWith("special ")) continue;

            for (const tmdbEp of tmdbEpisodes.values()) {
              const tTitle = tmdbEp.title ? cleanTitleForMatching(tmdbEp.title) : "";
              if (!tTitle) continue;

              if (jTitle === tTitle) {
                matchedOffset = tmdbEp.episodeNum - ep.episodeNum;
                break;
              }
            }
            if (matchedOffset !== null) break;
          }

          const offset = matchedOffset !== null ? matchedOffset : 0;

          // Apply TMDB enrichment with the calculated offset
          seasonEps = seasonEps.map((ep: any) => {
            const targetEpNum = ep.episodeNum + offset;
            const key = `${parsed.tmdbSeason}-${targetEpNum}`;
            const tmdb = tmdbEpisodes.get(key);
            if (!tmdb) return ep;
            return {
              ...ep,
              title: tmdb.title || ep.title,
              thumbnail: tmdb.thumbnail || ep.thumbnail,
              description: tmdb.description || ep.description,
            };
          });
        }
      } catch (err) {
        console.error("[TMDB Enrichment Error]:", err);
      }

      const resPayload = {
        success: true,
        data: { episodes: seasonEps, totalEpisodes: meta.totalEpisodes },
      };
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 }); // 30 mins
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

        // Fill gaps
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
        seasonEps.sort((a: any, b: any) => a.episodeNum - b.episodeNum);

        // TMDB enrichment
        try {
          const animeName = meta.anime.name;
          const animeJname = meta.anime.jname;
          const seasonYear: number | undefined = meta.anime.seasonYear ?? undefined;
          let tmdbId: number | null = null;
          if (animeName) tmdbId = await searchTmdbShow(animeName, seasonYear);
          if (!tmdbId && animeJname) tmdbId = await searchTmdbShow(animeJname, seasonYear);
          if (tmdbId) {
            const tmdbEpisodes = await fetchTmdbEpisodeData(tmdbId, [seasonNumParam]);
            seasonEps = seasonEps.map((ep: any) => {
              const key = `${seasonNumParam}-${ep.episodeNum}`;
              const tmdb = tmdbEpisodes.get(key);
              if (!tmdb) return ep;
              return { ...ep, title: tmdb.title || ep.title, thumbnail: tmdb.thumbnail || ep.thumbnail, description: tmdb.description || ep.description };
            });
          }
        } catch { /* skip TMDB */ }
      }

      const resPayload = {
        success: true,
        data: { episodes: seasonEps, totalEpisodes: meta.totalEpisodes },
      };
      episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 }); // 30 mins
      return Response.json(resPayload);
    }

    // ── Default: fetch ALL seasons' episodes ───────────────────────────────
    const data = await fetchAnimeApi(`/series/${id}`, true);
    const rawEpisodes = data?.data?.episodes || [];
    const totalEps = data?.data?.totalEpisodes || rawEpisodes.length || 0;

    let episodes = rawEpisodes.map((ep: any) => ({
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

    // TMDB enrichment (non-blocking)
    const animeName: string | undefined = data?.data?.name;
    const animeJname: string | undefined = data?.data?.jname;
    const seasonYear: number | undefined = data?.data?.seasonYear;
    if (episodes.length > 0) {
      try {
        const uniqueSeasonNums = [...new Set(episodes.map((ep: any) => ep.seasonNum || 1))] as number[];
        let tmdbId: number | null = null;
        if (animeName) tmdbId = await searchTmdbShow(animeName, seasonYear);
        if (!tmdbId && animeJname) tmdbId = await searchTmdbShow(animeJname, seasonYear);
        if (tmdbId) {
          const tmdbEpisodes = await fetchTmdbEpisodeData(tmdbId, uniqueSeasonNums);
          episodes = episodes.map((ep: any) => {
            const key = `${ep.seasonNum || 1}-${ep.episodeNum}`;
            const tmdb = tmdbEpisodes.get(key);
            if (!tmdb) return ep;
            return { ...ep, title: tmdb.title || ep.title, thumbnail: tmdb.thumbnail || ep.thumbnail, description: tmdb.description || ep.description };
          });
        }
      } catch {
        // TMDB enrichment failed
      }
    }

    const resPayload = {
      success: true,
      data: { episodes, totalEpisodes: totalEps },
    };
    episodesCache.set(cacheKey, { data: resPayload, expires: Date.now() + 1800000 }); // 30 mins
    return Response.json(resPayload);
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: "Failed to fetch episodes", success: false },
      { status: 500 }
    );
  }
}