"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CinemaPlayer, type CinemaPlayerMetadata } from "@/components/player/CinemaPlayer";
import { ServerOption } from "@/components/player/ServerSelectorModal";
import { DrawerSeason } from "@/components/player/EpisodeDrawer";
import { getStreamingSources, StreamingSource } from "@/lib/streaming-fetch";
import { fetchSourceConfig, type SourceTag } from "@/lib/streaming-config";
import { fetchJson } from "@/lib/utils";
import { NativeHlsPlayer } from "@/components/player/NativeHlsPlayer";

interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview?: string;
  still_path?: string | null;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}

interface Season {
  id: number;
  season_number: number;
  name: string;
  episodes?: Episode[];
}

interface TvShow {
  id: number;
  name: string;
  tagline?: string;
  overview: string;
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  vote_count?: number;
  first_air_date?: string;
  number_of_seasons?: number;
  seasons?: Season[];
}

interface WatchTvClientProps {
  showId: number;
  seasonNumber: number;
  episodeNumber: number;
}

export default function WatchTvClient({ showId, seasonNumber, episodeNumber }: WatchTvClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const [show, setShow] = useState<TvShow | null>(null);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [allSeasonsData, setAllSeasonsData] = useState<DrawerSeason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sourceConfig, setSourceConfig] = useState<{ key: string; tag: SourceTag }[] | null>(null);

  useEffect(() => {
    fetchSourceConfig().then((cfg) => {
      if (cfg?.movie) setSourceConfig(cfg.movie);
    });
  }, []);

  const sources = useMemo(() => {
    const base = getStreamingSources("tv", showId, seasonNumber, episodeNumber);
    if (!sourceConfig) return base;
    const byType = new Map(base.map((s) => [s.type, s]));
    const ordered: StreamingSource[] = [];
    sourceConfig.forEach((entry, index) => {
      const src = byType.get(entry.key);
      if (src) {
        ordered.push({ ...src, name: `Source ${index + 1}`, tag: entry.tag });
      }
    });
    base.forEach((s) => {
      if (!ordered.find((o) => o.type === s.type)) ordered.push(s);
    });
    return ordered;
  }, [showId, seasonNumber, episodeNumber, sourceConfig]);

  const [activeSource, setActiveSource] = useState<StreamingSource>(sources[0] || {
    url: `https://vidsrc.me/embed/tv?tmdb=${showId}&season=${seasonNumber}&episode=${episodeNumber}`,
    name: "Source 1",
    type: "vidsrc",
    quality: "Stable",
  });

  useEffect(() => {
    if (sources.length > 0) {
      setActiveSource(sources[0]);
    }
  }, [sources]);

  useEffect(() => {
    const loadShowAndSeason = async () => {
      setIsLoading(true);
      try {
        const [showRes, sRes] = await Promise.all([
          fetchJson<TvShow>(`/api/tmdb/tv/${showId}`),
          fetchJson<Season>(`/api/tmdb/tv/${showId}/season/${seasonNumber}`).catch(() => null),
        ]);

        setShow(showRes);
        setSeasonData(sRes);

        // Preload all seasons summary for EpisodeDrawer
        if (showRes.seasons) {
          const formattedSeasons: DrawerSeason[] = showRes.seasons
            .filter((s) => s.season_number > 0)
            .map((s) => ({
              id: s.id,
              season_number: s.season_number,
              name: s.name || `Season ${s.season_number}`,
              episodes: s.season_number === seasonNumber && sRes?.episodes ? sRes.episodes : [],
            }));
          setAllSeasonsData(formattedSeasons);
        }

        // Record watch history
        if (session?.user) {
          fetch("/api/watch-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId: showRes.id,
              mediaType: "tv",
              title: showRes.name,
              posterPath: showRes.poster_path ?? null,
              backdropPath: showRes.backdrop_path ?? null,
              season: seasonNumber,
              episode: episodeNumber,
            }),
          }).catch(() => {});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load TV show");
      } finally {
        setIsLoading(false);
      }
    };

    loadShowAndSeason();
  }, [showId, seasonNumber, episodeNumber, session]);

  const currentEpisodeData = useMemo(() => {
    return seasonData?.episodes?.find((e) => e.episode_number === episodeNumber);
  }, [seasonData, episodeNumber]);

  const handleSelectEpisode = useCallback(
    (newSeason: number, newEpisode: number) => {
      router.push(`/watch/tv/${showId}/${newSeason}/${newEpisode}`);
    },
    [router, showId]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">Loading Episode Stream...</span>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <h2 className="text-2xl font-black">Episode Unavailable</h2>
        <p className="text-sm text-white/50 max-w-md">{error || "Could not retrieve TV episode details."}</p>
        <Link href={`/tv/${showId}`} className="px-6 py-3 rounded-2xl bg-primary text-white font-bold text-xs">
          Return to Show Info
        </Link>
      </div>
    );
  }

  const posterUrl = show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null;
  const backdropUrl = show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null;
  const year = show.first_air_date ? show.first_air_date.slice(0, 4) : "";
  const rating = show.vote_average ?? 0;

  const metadata: CinemaPlayerMetadata = {
    title: show.name,
    episodeTitle: currentEpisodeData?.name,
    season: seasonNumber,
    episode: episodeNumber,
    year,
    rating,
    overview: currentEpisodeData?.overview || show.overview,
    posterUrl,
    backdropUrl,
    backUrl: `/tv/${showId}`,
    tmdbId: showId,
  };

  const serverOptions: ServerOption[] = sources.map((s) => ({
    key: s.type,
    name: s.name,
    type: s.type,
    quality: s.quality,
    tag: s.tag as SourceTag,
  }));

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black text-white overflow-hidden select-none overscroll-none">
      {/* Pure Cinema Video Player with Episodes Drawer */}
      <CinemaPlayer
        metadata={metadata}
        servers={serverOptions}
        activeServer={{
          key: activeSource.type,
          name: activeSource.name,
          type: activeSource.type,
          quality: activeSource.quality,
          tag: activeSource.tag as SourceTag,
        }}
        onSelectServer={(srv) => {
          const found = sources.find((s) => s.type === srv.key || s.name === srv.name);
          if (found) setActiveSource(found);
        }}
        seasons={allSeasonsData}
        onSelectEpisode={handleSelectEpisode}
      >
        <NativeHlsPlayer
          mediaType="tv"
          mediaId={showId}
          season={seasonNumber}
          episode={episodeNumber}
          fallbackIframeUrl={activeSource.url}
          server={activeSource.type}
          title={`${show.name} S${seasonNumber}E${episodeNumber}`}
          poster={backdropUrl || posterUrl || undefined}
        />
      </CinemaPlayer>
    </div>
  );
}
