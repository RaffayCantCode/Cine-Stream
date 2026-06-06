import { NextRequest } from "next/server";
import { fetchAnimeApi, fetchEpisodesFromJikanPage } from "@/lib/anime-fetch";
import { searchTmdbShow, fetchTmdbEpisodeData } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const seasonMalId = searchParams.get("seasonMalId") || null;
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