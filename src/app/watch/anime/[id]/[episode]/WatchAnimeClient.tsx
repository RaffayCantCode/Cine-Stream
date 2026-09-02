"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CinemaPlayer, type CinemaPlayerMetadata } from "@/components/player/CinemaPlayer";
import { ServerOption } from "@/components/player/ServerSelectorModal";
import { DrawerSeason } from "@/components/player/EpisodeDrawer";
import { NativeHlsPlayer } from "@/components/player/NativeHlsPlayer";

function buildAnimeIframeUrl(
  provider: string,
  animeId: string,
  malId: string | null | undefined,
  episode: number,
  tmdbId?: number | null,
  tmdbSeason?: number | null,
  isMovie?: boolean
): string {
  const cleanNumeric = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const digits = id.replace(/\D/g, "");
    return digits || null;
  };
  const primaryId = cleanNumeric(animeId) || cleanNumeric(malId) || "";

  switch (provider) {
    case "animeplay":
    case "megaplay":
      return primaryId ? `https://megaplay.buzz/stream/ani/${primaryId}/${episode}/sub` : "";
    case "vidnest":
      return primaryId ? `https://vidnest.fun/anime/${primaryId}/${episode}/sub` : "";
    case "embedmaster":
      if (tmdbId) {
        return isMovie
          ? `https://embedmaster.link/movie/${tmdbId}`
          : `https://embedmaster.link/tv/${tmdbId}/${tmdbSeason || 1}/${episode}`;
      }
      return primaryId ? `https://vidnest.fun/animepahe/${primaryId}/${episode}/sub` : "";
    case "animepahe":
      return primaryId ? `https://vidnest.fun/animepahe/${primaryId}/${episode}/sub` : "";
    case "animesub":
      const malClean = cleanNumeric(malId) || primaryId;
      return malClean ? `https://megaplay.buzz/stream/mal/${malClean}/${episode}/sub` : "";
    case "vidsrc":
      if (tmdbId) {
        return isMovie
          ? `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`
          : `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${tmdbSeason || 1}&episode=${episode}`;
      }
      return primaryId ? `https://megaplay.buzz/stream/ani/${primaryId}/${episode}/sub` : "";
    default:
      return primaryId ? `https://megaplay.buzz/stream/ani/${primaryId}/${episode}/sub` : "";
  }
}

interface AnimeInfo {
  id: string;
  idMal?: string | null;
  name: string;
  jname?: string | null;
  poster: string;
  bannerImage?: string | null;
  format?: string | null;
  seasonYear?: number | null;
  status?: string | null;
  rating?: string | null;
  genres?: string[];
  description?: string;
  episodes?: { sub: number | null; dub: number | null };
  totalEpisodes?: number | null;
  tmdbId?: number | null;
  tmdbSeason?: number | null;
  countryOfOrigin?: string | null;
}

interface WatchAnimeClientProps {
  animeId: string;
  episodeNumber: number;
}

const ANIME_SERVERS: ServerOption[] = [
  { key: "animeplay", name: "Source 1", type: "animeplay", quality: "Recommended", tag: "recommended" },
  { key: "vidnest", name: "Source 2", type: "vidnest", quality: "Best", tag: "best" },
  { key: "embedmaster", name: "Source 3", type: "embedmaster", quality: "Best", tag: "best" },
  { key: "animepahe", name: "Source 4", type: "animepahe", quality: "Good", tag: "good" },
  { key: "animesub", name: "Source 5", type: "animesub", quality: "Backup", tag: "backup" },
  { key: "vidsrc", name: "Source 6", type: "vidsrc", quality: "Backup", tag: "backup" },
];

export default function WatchAnimeClient({ animeId, episodeNumber }: WatchAnimeClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const [anime, setAnime] = useState<AnimeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forcedSource, setForcedSource] = useState<string>("animeplay");

  useEffect(() => {
    const loadAnime = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}`);
        if (res.ok) {
          const json = await res.json();
          const a = json?.data?.anime || json?.data;
          if (a) {
            const isChinese = a.countryOfOrigin === "CN" || /[\u4e00-\u9fa5]/.test(a.jname || "") || /[\u4e00-\u9fa5]/.test(a.name || "");
            setAnime({
              ...a,
              name: a.name || a.title?.english || a.title?.romaji || a.title,
              poster: a.poster || a.coverImage?.extraLarge || a.coverImage?.large,
              bannerImage: a.bannerImage || a.backdrop,
              totalEpisodes: a.totalEpisodes || a.episodes?.length,
              tmdbId: a.tmdbId || null,
              tmdbSeason: a.tmdbSeason || 1,
              countryOfOrigin: a.countryOfOrigin || (isChinese ? "CN" : null),
            });
            if (isChinese) {
              setForcedSource("embedmaster");
            }
            return;
          }
        }

        const alRes = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query ($id: Int) {
                Media(id: $id, type: ANIME) {
                  id
                  idMal
                  title { romaji english native }
                  coverImage { extraLarge large }
                  bannerImage
                  format
                  seasonYear
                  status
                  averageScore
                  genres
                  description
                  episodes
                  countryOfOrigin
                }
              }
            `,
            variables: { id: parseInt(animeId, 10) || 0 },
          }),
        });

        if (alRes.ok) {
          const alJson = await alRes.json();
          const media = alJson?.data?.Media;
          if (media) {
            const isChinese = media.countryOfOrigin === "CN" || /[\u4e00-\u9fa5]/.test(media.title?.native || "");
            setAnime({
              id: String(media.id),
              idMal: media.idMal ? String(media.idMal) : null,
              name: media.title.english || media.title.romaji || media.title.native,
              jname: media.title.native,
              poster: media.coverImage.extraLarge || media.coverImage.large,
              bannerImage: media.bannerImage,
              format: media.format,
              seasonYear: media.seasonYear,
              status: media.status,
              rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : undefined,
              genres: media.genres,
              description: media.description?.replace(/<[^>]*>/g, ""),
              totalEpisodes: media.episodes,
              episodes: { sub: media.episodes, dub: null },
              countryOfOrigin: media.countryOfOrigin || (isChinese ? "CN" : null),
            });
            if (isChinese) {
              setForcedSource("embedmaster");
            }
            return;
          }
        }

        throw new Error("Could not find anime info");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load anime details");
      } finally {
        setIsLoading(false);
      }
    };

    loadAnime();
  }, [animeId]);

  // ── TMDB ID Resolver for Donghua and Universal sources (Source 3 & Source 6) ──
  useEffect(() => {
    if (!anime || anime.tmdbId) return;
    const titleToSearch = anime.name || anime.jname;
    if (!titleToSearch) return;

    let isMounted = true;
    const clean = titleToSearch.replace(/\b(season|part|2nd|3rd|4th|5th|final)\b.*$/i, "").trim() || titleToSearch;

    fetch(`/api/tmdb/search?query=${encodeURIComponent(clean)}&type=tv&include_anime=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.results?.length) return;
        const match = data.results.find((r: any) => r.genre_ids?.includes(16)) || data.results[0];
        if (match?.id) {
          setAnime((prev) => (prev ? { ...prev, tmdbId: match.id, tmdbSeason: 1 } : null));
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [anime?.name, anime?.jname, anime?.tmdbId]);

  // Load detailed anime episodes list with thumbnails, titles, and filler tags
  const [animeEpisodes, setAnimeEpisodes] = useState<any[]>([]);
  useEffect(() => {
    if (!animeId) return;
    fetch(`/api/anime/${animeId}/episodes`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && Array.isArray(json?.data?.episodes)) {
          setAnimeEpisodes(json.data.episodes);
        }
      })
      .catch(() => {});
  }, [animeId]);

  const totalEps = anime?.totalEpisodes || anime?.episodes?.sub || (animeEpisodes.length > 0 ? animeEpisodes.length : 12);

  const handleSelectEpisode = useCallback(
    (newEp: number) => {
      router.push(`/watch/anime/${animeId}/${newEp}`);
    },
    [router, animeId]
  );

  const handleAutoNext = useCallback(() => {
    if (episodeNumber < totalEps) {
      handleSelectEpisode(episodeNumber + 1);
    }
  }, [episodeNumber, totalEps, handleSelectEpisode]);

  const ratingNum = anime?.rating ? parseFloat(anime.rating) : 0;
  const currentEpDetail = animeEpisodes.find((e) => e.episodeNum === episodeNumber);

  const metadata: CinemaPlayerMetadata = useMemo(() => {
    if (!anime) {
      return {
        title: "",
        episode: episodeNumber,
        backUrl: `/anime/${animeId}`,
      };
    }
    return {
      title: anime.name,
      episodeTitle: currentEpDetail?.title || `Episode ${episodeNumber}`,
      episode: episodeNumber,
      year: anime.seasonYear || "",
      rating: ratingNum > 0 ? ratingNum : undefined,
      overview: currentEpDetail?.description || anime.description,
      posterUrl: anime.poster,
      backdropUrl: anime.bannerImage || anime.poster,
      backUrl: `/anime/${animeId}`,
      tmdbId: anime.tmdbId,
    };
  }, [anime, currentEpDetail, episodeNumber, animeId, ratingNum]);

  const drawerSeason: DrawerSeason[] = useMemo(() => {
    return [
      {
        id: 1,
        season_number: 1,
        name: "Episodes",
        episodes: animeEpisodes.length > 0
          ? animeEpisodes.map((ep) => ({
              id: ep.episodeId || ep.episodeNum,
              episode_number: ep.episodeNum,
              name: ep.title || `Episode ${ep.episodeNum}`,
              overview: ep.description || undefined,
              still_path: ep.thumbnail || undefined,
              isFiller: ep.isFiller || false,
              runtime: ep.runtime || undefined,
              vote_average: ep.vote_average || undefined,
            }))
          : Array.from({ length: totalEps }).map((_, idx) => ({
              id: idx + 1,
              episode_number: idx + 1,
              name: `Episode ${idx + 1}`,
            })),
      },
    ];
  }, [animeEpisodes, totalEps]);

  const activeIframeUrl = useMemo(() => {
    return buildAnimeIframeUrl(
      forcedSource,
      animeId,
      anime?.idMal,
      episodeNumber,
      anime?.tmdbId,
      anime?.tmdbSeason,
      anime?.format === "MOVIE"
    );
  }, [forcedSource, animeId, anime, episodeNumber]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-black flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">Loading Anime Stream...</span>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-black flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <h2 className="text-2xl font-black">Anime Unavailable</h2>
        <p className="text-sm text-white/50 max-w-md">{error || "Could not retrieve anime stream details."}</p>
        <Link href={`/anime/${animeId}`} className="px-6 py-3 rounded-2xl bg-primary text-white font-bold text-xs">
          Return to Anime Page
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black text-white overflow-hidden select-none overscroll-none">
      {/* Pure Cinema Video Player with Episodes Drawer */}
      <CinemaPlayer
        metadata={metadata}
        servers={ANIME_SERVERS}
        activeServer={ANIME_SERVERS.find((s) => s.key === forcedSource) || ANIME_SERVERS[0]}
        onSelectServer={(srv) => setForcedSource(srv.key)}
        seasons={drawerSeason}
        onSelectEpisode={(_, ep) => handleSelectEpisode(ep)}
        isAnime={true}
      >
        <NativeHlsPlayer
          key={`${animeId}-${episodeNumber}-${forcedSource}`}
          mediaType="anime"
          mediaId={animeId}
          episode={episodeNumber}
          fallbackIframeUrl={activeIframeUrl}
          server={forcedSource}
          title={`${anime.name} - Episode ${episodeNumber}`}
          poster={anime.bannerImage || anime.poster}
        />
      </CinemaPlayer>
    </div>
  );
}
