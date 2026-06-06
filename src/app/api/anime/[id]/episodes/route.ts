import { NextRequest } from "next/server";
import { fetchAnimeApi, fetchEpisodesFromJikan, fetchEpisodesFromJikanPage, getAnimeDetails } from "@/lib/anime-fetch";
import { searchTmdbShow, fetchTmdbEpisodeData } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const seasonMalId = searchParams.get("seasonMalId") || null;
  const seasonNum = parseInt(searchParams.get("seasonNum") || "", 10);
  const batchSize = 100;

  try {
    // Fetching a specific page for a season (lazy-load more episodes)
    if (seasonMalId && page > 1) {
      const newEps = await fetchEpisodesFromJikanPage(seasonMalId, id, page, batchSize);
      return Response.json({
        success: true,
        data: { episodes: newEps, totalEpisodes: 0 },
      });
    }

    // When seasonNum is provided, only fetch that season's episodes (much faster)
    if (!isNaN(seasonNum) && seasonNum > 0) {
      const meta = await getAnimeDetails(id, 100, true);
      if (!meta) throw new Error("Anime not found");
      const seasons = meta.seasons;
      const seasonIdx = seasonNum - 1;
      const season = seasons[seasonIdx];
      let seasonEps: any[] = [];

      if (season) {
        const seasonInfo = meta.episodes.filter(e => e.seasonNum === seasonNum);
        seasonEps = seasonInfo.map((ep: any) => ({
          episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
          episodeNum: Number(ep.episodeNum || 1),
          title: ep.title || `Episode ${ep.episodeNum || 1}`,
          thumbnail: ep.thumbnail || null,
          malUrl: ep.malUrl || null,
          isFiller: ep.isFiller || false,
          releasedDate: ep.releasedDate || null,
          description: ep.description || null,
          seasonNum,
          seasonId: String(season.id),
          seasonName: season.name,
          seasonMalId: season.idMal || null,
        }));

        // Try to fetch real episodes from Jikan for this season
        if (season.idMal) {
          try {
            const realEps = await fetchEpisodesFromJikan(season.idMal, String(season.id), 100);
            if (realEps && realEps.length > 0) {
              seasonEps = realEps.map((ep, idx) => {
                const matched = seasonEps.find(e => e.episodeNum === ep.episodeNum);
                return {
                  ...ep,
                  episodeId: ep.episodeId || `${season.id}-${ep.episodeNum}`,
                  seasonNum,
                  seasonId: String(season.id),
                  seasonName: season.name,
                  seasonMalId: season.idMal,
                  description: ep.description || matched?.description || null,
                  thumbnail: ep.thumbnail || matched?.thumbnail || null,
                  title: ep.title || matched?.title || `Episode ${ep.episodeNum}`,
                  malUrl: ep.malUrl || matched?.malUrl || null,
                };
              });
            }
          } catch { /* use placeholders */ }
        }

        // TMDB enrichment for this season
        try {
          const animeName = meta.anime.name;
          const animeJname = meta.anime.jname;
          const seasonYear: number | undefined = meta.anime.seasonYear ?? undefined;
          let tmdbId: number | null = null;
          if (animeName) tmdbId = await searchTmdbShow(animeName, seasonYear);
          if (!tmdbId && animeJname) tmdbId = await searchTmdbShow(animeJname, seasonYear);
          if (tmdbId) {
            const tmdbEpisodes = await fetchTmdbEpisodeData(tmdbId, [seasonNum]);
            seasonEps = seasonEps.map((ep: any) => {
              const key = `${seasonNum}-${ep.episodeNum}`;
              const tmdb = tmdbEpisodes.get(key);
              if (!tmdb) return ep;
              return { ...ep, title: tmdb.title || ep.title, thumbnail: tmdb.thumbnail || ep.thumbnail, description: tmdb.description || ep.description };
            });
          }
        } catch { /* skip TMDB */ }
      }

      return Response.json({
        success: true,
        data: { episodes: seasonEps, totalEpisodes: meta.totalEpisodes },
      });
    }

    // Default: fetch all seasons' episodes (existing behavior)
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

    // Enrich episodes with TMDB data (non-blocking - if it fails, return original)
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
            return {
              ...ep,
              title: tmdb.title || ep.title,
              thumbnail: tmdb.thumbnail || ep.thumbnail,
              description: tmdb.description || ep.description,
            };
          });
        }
      } catch {
        // TMDB enrichment failed, return original episodes
      }
    }

    return Response.json({
      success: true,
      data: {
        episodes,
        totalEpisodes: totalEps,
      },
    });
  } catch (error) {
    console.error("[Anime Episodes Error]:", error);
    return Response.json(
      { error: "Failed to fetch episodes", success: false },
      { status: 500 }
    );
  }
}