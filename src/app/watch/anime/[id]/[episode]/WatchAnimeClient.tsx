"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CinemaPlayer, type CinemaPlayerMetadata } from "@/components/player/CinemaPlayer";
import { ServerOption } from "@/components/player/ServerSelectorModal";
import { DrawerSeason } from "@/components/player/EpisodeDrawer";
import { NativeHlsPlayer } from "@/components/player/NativeHlsPlayer";
import { usePageContentReady } from "@/lib/pageLoad";
import { fetchSourceConfig, SOURCE_TAG_LABELS, type SourceConfigEntry, type SourceTag, type SourceCategory } from "@/lib/streaming-config";

function buildAnimeIframeUrl(
  provider: string,
  animeId: string,
  malId: string | null | undefined,
  episode: number,
  tmdbId?: number | null,
  tmdbSeason?: number | null,
  isMovie?: boolean,
  episodeOffset?: number | null
): string {
  const cleanNumeric = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const digits = id.replace(/\D/g, "");
    return digits || null;
  };
  const primaryId = cleanNumeric(animeId) || cleanNumeric(malId) || "";
  const effectiveTmdbEpisode = (episode || 1) + (episodeOffset || 0);

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
          : `https://embedmaster.link/tv/${tmdbId}/${tmdbSeason || 1}/${effectiveTmdbEpisode}`;
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
          : `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${tmdbSeason || 1}&episode=${effectiveTmdbEpisode}`;
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
  episodeOffset?: number | null;
  countryOfOrigin?: string | null;
}

interface WatchAnimeClientProps {
  animeId: string;
  episodeNumber: number;
}

const DEFAULT_ANIME_SERVERS: ServerOption[] = [
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
  const [sourceConfig, setSourceConfig] = useState<SourceConfigEntry[] | null>(null);

  // Load and listen to streaming source configuration
  useEffect(() => {
    fetchSourceConfig().then((cfg) => {
      if (cfg?.anime) setSourceConfig(cfg.anime);
    });

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<SourceCategory, SourceConfigEntry[]>>;
      if (customEvent.detail?.anime) {
        setSourceConfig(customEvent.detail.anime);
      } else {
        fetchSourceConfig(true).then((cfg) => {
          if (cfg?.anime) setSourceConfig(cfg.anime);
        });
      }
    };

    window.addEventListener("cinestream_streaming_sources_updated", handleUpdate);
    return () => {
      window.removeEventListener("cinestream_streaming_sources_updated", handleUpdate);
    };
  }, []);

  const servers: ServerOption[] = useMemo(() => {
    if (!sourceConfig || sourceConfig.length === 0) return DEFAULT_ANIME_SERVERS;

    const byKey = new Map(DEFAULT_ANIME_SERVERS.map((s) => [s.key, s]));
    const ordered: ServerOption[] = [];

    sourceConfig.forEach((entry, idx) => {
      const base = byKey.get(entry.key);
      const tag = entry.tag as SourceTag;
      const quality = SOURCE_TAG_LABELS[tag] || "Best";
      if (base) {
        ordered.push({ ...base, name: `Source ${idx + 1}`, quality, tag });
      } else {
        ordered.push({
          key: entry.key,
          name: `Source ${idx + 1}`,
          type: entry.key,
          quality,
          tag,
        });
      }
    });

    DEFAULT_ANIME_SERVERS.forEach((s) => {
      if (!ordered.some((o) => o.key === s.key)) {
        ordered.push({ ...s, name: `Source ${ordered.length + 1}` });
      }
    });

    return ordered;
  }, [sourceConfig]);

  const [forcedSource, setForcedSource] = useState<string>("animeplay");
  usePageContentReady(!isLoading);

  // Restore current/preferred source from URL query param or sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined" && servers.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const sourceParam = urlParams.get("source");
      const savedSource = sessionStorage.getItem("cinestream_anime_source");
      const targetSource = sourceParam || savedSource;
      if (targetSource && servers.some((s) => s.key === targetSource)) {
        setForcedSource(targetSource);
      } else if (!servers.some((s) => s.key === forcedSource)) {
        setForcedSource(servers[0].key);
      }
    }
  }, [servers, forcedSource]);

  const handleSelectServer = useCallback((srvKey: string) => {
    setForcedSource(srvKey);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("cinestream_anime_source", srvKey);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("source", srvKey);
        window.history.replaceState(null, "", url.toString());
      } catch {}
    }
  }, []);

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
            const matchingSeason = a.seasons?.find((s: any) => String(s.id) === String(animeId)) || a.seasons?.[0];
            const trueEpCount = matchingSeason?.totalEpisodes || a.anime?.totalEpisodes || a.totalEpisodes || a.episodes?.sub || (Array.isArray(a.episodes) ? a.episodes.length : null);
            setAnime({
              ...a,
              name: a.name || a.title?.english || a.title?.romaji || a.title,
              poster: a.poster || a.coverImage?.extraLarge || a.coverImage?.large,
              bannerImage: a.bannerImage || a.backdrop,
              totalEpisodes: trueEpCount,
              tmdbId: matchingSeason?.tmdbId || a.tmdbId || null,
              tmdbSeason: matchingSeason?.tmdbSeasonNumber || a.tmdbSeason || 1,
              episodeOffset: matchingSeason?.episodeOffset || 0,
              countryOfOrigin: a.countryOfOrigin || (isChinese ? "CN" : null),
            });
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
    const tmdbQuery = anime?.tmdbId ? `&tmdbId=${anime.tmdbId}&tmdbSeason=${anime.tmdbSeason || 1}` : "";
    fetch(`/api/anime/${animeId}/episodes?seasonId=${encodeURIComponent(animeId)}${tmdbQuery}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && Array.isArray(json?.data?.episodes)) {
          setAnimeEpisodes(json.data.episodes);
        }
      })
      .catch(() => {});
  }, [animeId, anime?.tmdbId, anime?.tmdbSeason]);

  const cappedEpisodes = useMemo(() => {
    const maxEp = anime?.totalEpisodes && anime.totalEpisodes > 0 ? anime.totalEpisodes : null;
    if (!maxEp) return animeEpisodes;
    return animeEpisodes.filter((ep) => ep.episodeNum <= maxEp);
  }, [animeEpisodes, anime?.totalEpisodes]);

  const totalEps = anime?.totalEpisodes || anime?.episodes?.sub || (cappedEpisodes.length > 0 ? cappedEpisodes.length : 12);
  const ratingNum = anime?.rating ? parseFloat(anime.rating) : 0;
  const currentEpDetail = cappedEpisodes.find((e) => e.episodeNum === episodeNumber);

  // ── Reliably record watch history in Database and localStorage cache on every episode change ──
  useEffect(() => {
    if (!anime || !animeId) return;

    const numericId = Number(anime.id) || (anime.tmdbId ? Number(anime.tmdbId) : parseInt(animeId, 10) || 0);

    const payload = {
      mediaId: numericId,
      mediaType: "anime" as const,
      title: anime.name,
      posterPath: anime.poster ?? null,
      backdropPath: anime.bannerImage ?? null,
      season: 1,
      episode: episodeNumber,
      episodeName: currentEpDetail?.title || `Episode ${episodeNumber}`,
    };

    // 1. Post to database
    fetch("/api/watch-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

    // 2. Optimistically update localStorage cache for Continue Watching with 0ms delay
    try {
      const saved = localStorage.getItem("cinestream_cw_cache");
      const parsed = saved ? JSON.parse(saved) : { items: [] };
      const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];

      const updatedItem = {
        id: numericId,
        mediaId: numericId,
        mediaType: "anime",
        title: anime.name,
        posterPath: anime.poster ?? null,
        backdropPath: anime.bannerImage ?? null,
        season: 1,
        episode: episodeNumber,
        episodeName: currentEpDetail?.title || `Episode ${episodeNumber}`,
        watchedAt: new Date().toISOString(),
      };

      const filtered = items.filter((it) => !(it.mediaId === numericId && it.mediaType === "anime"));
      filtered.unshift(updatedItem);
      localStorage.setItem("cinestream_cw_cache", JSON.stringify({ items: filtered.slice(0, 30) }));

      // Also update active anime tracker for the details page
      localStorage.setItem("cinestream_active_anime_show", JSON.stringify({
        id: String(anime.id || animeId),
        episodeNum: episodeNumber,
      }));
    } catch {}
  }, [anime, animeId, episodeNumber, currentEpDetail?.title]);

  const handleSelectEpisode = useCallback(
    (newEp: number) => {
      if (anime) {
        try {
          const saved = localStorage.getItem("cinestream_cw_cache");
          const parsed = saved ? JSON.parse(saved) : { items: [] };
          const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];
          const numericId = Number(anime.id) || (anime.tmdbId ? Number(anime.tmdbId) : parseInt(animeId, 10) || 0);

          const updatedItem = {
            id: numericId,
            mediaId: numericId,
            mediaType: "anime",
            title: anime.name,
            posterPath: anime.poster ?? null,
            backdropPath: anime.bannerImage ?? null,
            season: 1,
            episode: newEp,
            episodeName: `Episode ${newEp}`,
            watchedAt: new Date().toISOString(),
          };

          const filtered = items.filter((it) => !(it.mediaId === numericId && it.mediaType === "anime"));
          filtered.unshift(updatedItem);
          localStorage.setItem("cinestream_cw_cache", JSON.stringify({ items: filtered.slice(0, 30) }));

          localStorage.setItem("cinestream_active_anime_show", JSON.stringify({
            id: String(anime.id || animeId),
            episodeNum: newEp,
          }));
        } catch {}
      }
      router.push(`/watch/anime/${animeId}/${newEp}?source=${forcedSource}`);
    },
    [router, animeId, anime, forcedSource]
  );

  const handleAutoNext = useCallback(() => {
    if (episodeNumber < totalEps) {
      handleSelectEpisode(episodeNumber + 1);
    }
  }, [episodeNumber, totalEps, handleSelectEpisode]);

  const metadata: CinemaPlayerMetadata = useMemo(() => {
    if (!anime) {
      return {
        title: "",
        season: 1,
        episode: episodeNumber,
        backUrl: `/anime/${animeId}`,
      };
    }
    return {
      title: anime.name,
      episodeTitle: currentEpDetail?.title || `Episode ${episodeNumber}`,
      season: 1,
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
        episodes: cappedEpisodes.length > 0
          ? cappedEpisodes.map((ep) => ({
              id: ep.episodeId || ep.episodeNum,
              episode_number: ep.episodeNum,
              name: ep.title || `Episode ${ep.episodeNum}`,
              overview: ep.description || undefined,
              still_path: ep.thumbnail || undefined,
              isFiller: Boolean(ep.isFiller),
              runtime: ep.runtime || undefined,
              vote_average: ep.vote_average || undefined,
              air_date: ep.releasedDate || undefined,
            }))
          : Array.from({ length: totalEps }).map((_, idx) => ({
              id: idx + 1,
              episode_number: idx + 1,
              name: `Episode ${idx + 1}`,
            })),
      },
    ];
  }, [cappedEpisodes, totalEps]);

  const activeIframeUrl = useMemo(() => {
    return buildAnimeIframeUrl(
      forcedSource,
      anime?.id || animeId,
      anime?.idMal,
      episodeNumber,
      anime?.tmdbId,
      anime?.tmdbSeason,
      anime?.format === "MOVIE",
      anime?.episodeOffset
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
        servers={servers}
        activeServer={servers.find((s) => s.key === forcedSource) || servers[0]}
        onSelectServer={(srv) => handleSelectServer(srv.key)}
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
