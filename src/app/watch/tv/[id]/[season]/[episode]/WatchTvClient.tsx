"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CinemaPlayer, type CinemaPlayerMetadata } from "@/components/player/CinemaPlayer";
import { ServerOption } from "@/components/player/ServerSelectorModal";
import { DrawerSeason } from "@/components/player/EpisodeDrawer";
import { getStreamingSources, StreamingSource } from "@/lib/streaming-fetch";
import { fetchSourceConfig, SOURCE_TAG_LABELS, type SourceTag, type SourceConfigEntry, type SourceCategory } from "@/lib/streaming-config";
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

  const [show, setShow] = useState<TvShow | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`cinestream_tv_${showId}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [seasonData, setSeasonData] = useState<Season | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`cinestream_tv_${showId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?._initialSeasonNum === seasonNumber && parsed?._initialSeasonData) {
            return parsed._initialSeasonData;
          }
        }
      } catch {}
    }
    return null;
  });
  const [allSeasonsData, setAllSeasonsData] = useState<DrawerSeason[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [sourceConfig, setSourceConfig] = useState<SourceConfigEntry[] | null>(null);

  useEffect(() => {
    fetchSourceConfig().then((cfg) => {
      if (cfg?.movie) setSourceConfig(cfg.movie);
    });

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<SourceCategory, SourceConfigEntry[]>>;
      if (customEvent.detail?.movie) {
        setSourceConfig(customEvent.detail.movie);
      } else {
        fetchSourceConfig(true).then((cfg) => {
          if (cfg?.movie) setSourceConfig(cfg.movie);
        });
      }
    };

    window.addEventListener("cinestream_streaming_sources_updated", handleUpdate);
    return () => {
      window.removeEventListener("cinestream_streaming_sources_updated", handleUpdate);
    };
  }, []);

  const sources = useMemo(() => {
    const base = getStreamingSources("tv", showId, seasonNumber, episodeNumber);
    if (!sourceConfig || sourceConfig.length === 0) return base;
    const byType = new Map(base.map((s) => [s.type, s]));
    const ordered: StreamingSource[] = [];
    sourceConfig.forEach((entry, index) => {
      const src = byType.get(entry.key);
      if (src) {
        ordered.push({
          ...src,
          name: `Source ${index + 1}`,
          tag: entry.tag,
          quality: (SOURCE_TAG_LABELS[entry.tag] as any) || src.quality,
        });
      }
    });
    base.forEach((s) => {
      if (!ordered.find((o) => o.type === s.type)) ordered.push(s);
    });
    return ordered;
  }, [showId, seasonNumber, episodeNumber, sourceConfig]);

  const [activeSource, setActiveSource] = useState<StreamingSource>(() => {
    const base = getStreamingSources("tv", showId, seasonNumber, episodeNumber);
    return base[0] || {
      url: `https://vixsrc.to/tv/${showId}/${seasonNumber}/${episodeNumber}`,
      name: "Source 1",
      type: "vixsrc",
      quality: "Best",
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined" && sources.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const sourceParam = urlParams.get("source");
      const savedSource = sessionStorage.getItem("cinestream_tv_source");

      let selected: StreamingSource | undefined;
      if (sourceParam) {
        const num = parseInt(sourceParam, 10);
        if (!isNaN(num) && num >= 1 && num <= sources.length) {
          selected = sources[num - 1];
        } else {
          selected = sources.find((s) => s.type === sourceParam || s.name.toLowerCase() === sourceParam.toLowerCase());
        }
      }

      if (!selected && savedSource) {
        const num = parseInt(savedSource, 10);
        if (!isNaN(num) && num >= 1 && num <= sources.length) {
          selected = sources[num - 1];
        } else {
          selected = sources.find((s) => s.type === savedSource);
        }
      }

      if (!selected) {
        selected = sources.find((s) => s.type === activeSource.type) || sources[0];
      }

      setActiveSource(selected);

      // Clean up / normalize URL to show source as a number
      const selectedIndex = sources.findIndex((s) => s.type === selected.type);
      const sourceNumber = selectedIndex >= 0 ? selectedIndex + 1 : 1;
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("source") !== String(sourceNumber)) {
          url.searchParams.set("source", String(sourceNumber));
          window.history.replaceState(null, "", url.toString());
        }
      } catch {}
    }
  }, [sources]);

  useEffect(() => {
    const loadShowAndSeason = async () => {
      try {
        let activeShow = show;
        if (!activeShow) {
          activeShow = await fetchJson<TvShow>(`/api/tmdb/tv/${showId}`);
          setShow(activeShow);
        }

        let activeSeason = seasonData;
        if (!activeSeason) {
          if ((activeShow as any)?._initialSeasonNum === seasonNumber && (activeShow as any)?._initialSeasonData) {
            activeSeason = (activeShow as any)._initialSeasonData;
          } else {
            activeSeason = await fetchJson<Season>(`/api/tmdb/tv/${showId}/season/${seasonNumber}`).catch(() => null);
          }
          if (activeSeason) setSeasonData(activeSeason);
        }

        // Preload all seasons summary for EpisodeDrawer
        if (activeShow?.seasons) {
          const formattedSeasons: DrawerSeason[] = activeShow.seasons
            .filter((s) => s.season_number > 0)
            .map((s) => ({
              id: s.id,
              season_number: s.season_number,
              name: s.name || `Season ${s.season_number}`,
              episodes: s.season_number === seasonNumber && activeSeason?.episodes ? activeSeason.episodes : [],
            }));
          setAllSeasonsData(formattedSeasons);
        }
      } catch (err) {
        if (!show) {
          setError(err instanceof Error ? err.message : "Failed to load TV show");
        }
      }
    };

    loadShowAndSeason();
  }, [showId, seasonNumber, episodeNumber]);

  const currentEpisodeData = useMemo(() => {
    return seasonData?.episodes?.find((e) => e.episode_number === episodeNumber);
  }, [seasonData, episodeNumber]);

  // ── Reliably record watch history in Database and localStorage cache on every episode change ──
  useEffect(() => {
    if (!show || !showId) return;

    const payload = {
      mediaId: show.id || showId,
      mediaType: "tv" as const,
      title: show.name,
      posterPath: show.poster_path ?? null,
      backdropPath: show.backdrop_path ?? null,
      season: seasonNumber,
      episode: episodeNumber,
      episodeName: currentEpisodeData?.name || `Episode ${episodeNumber}`,
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
        id: show.id || showId,
        mediaId: show.id || showId,
        mediaType: "tv",
        title: show.name,
        posterPath: show.poster_path ?? null,
        backdropPath: show.backdrop_path ?? null,
        season: seasonNumber,
        episode: episodeNumber,
        episodeName: currentEpisodeData?.name || `Episode ${episodeNumber}`,
        watchedAt: new Date().toISOString(),
      };

      const filtered = items.filter((it) => !(it.mediaId === (show.id || showId) && it.mediaType === "tv"));
      filtered.unshift(updatedItem);
      localStorage.setItem("cinestream_cw_cache", JSON.stringify({ items: filtered.slice(0, 30) }));

      // Also update active tv tracker for the details page
      localStorage.setItem("cinestream_active_tv_show", JSON.stringify({
        id: String(show.id || showId),
        season: seasonNumber,
        episode: episodeNumber,
      }));
    } catch {}
  }, [show, showId, seasonNumber, episodeNumber, currentEpisodeData?.name]);

  const handleSelectEpisode = useCallback(
    (newSeason: number, newEpisode: number) => {
      if (show) {
        try {
          const saved = localStorage.getItem("cinestream_cw_cache");
          const parsed = saved ? JSON.parse(saved) : { items: [] };
          const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];

          const updatedItem = {
            id: show.id || showId,
            mediaId: show.id || showId,
            mediaType: "tv",
            title: show.name,
            posterPath: show.poster_path ?? null,
            backdropPath: show.backdrop_path ?? null,
            season: newSeason,
            episode: newEpisode,
            episodeName: `Episode ${newEpisode}`,
            watchedAt: new Date().toISOString(),
          };

          const filtered = items.filter((it) => !(it.mediaId === (show.id || showId) && it.mediaType === "tv"));
          filtered.unshift(updatedItem);
          localStorage.setItem("cinestream_cw_cache", JSON.stringify({ items: filtered.slice(0, 30) }));

          localStorage.setItem("cinestream_active_tv_show", JSON.stringify({
            id: String(show.id || showId),
            season: newSeason,
            episode: newEpisode,
          }));
        } catch {}
      }
      const sourceIndex = sources.findIndex((s) => s.type === activeSource.type);
      const sourceNum = sourceIndex >= 0 ? sourceIndex + 1 : 1;
      router.push(`/watch/tv/${showId}/${newSeason}/${newEpisode}?source=${sourceNum}`);
    },
    [router, show, showId, sources, activeSource.type]
  );

  // Preconnect embed domains early for lightning-fast iframe startup
  useEffect(() => {
    const domains = [
      "https://vixsrc.to",
      "https://embedmaster.link",
      "https://vidnest.fun",
      "https://vidlink.pro",
      "https://autoembed.co",
    ];
    domains.forEach((href) => {
      if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }, []);

  const posterUrl = show?.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null;
  const backdropUrl = show?.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : null;
  const year = show?.first_air_date ? show.first_air_date.slice(0, 4) : "";
  const rating = show?.vote_average ?? 0;

  const metadata: CinemaPlayerMetadata = {
    title: show?.name || `TV Series (S${seasonNumber} E${episodeNumber})`,
    episodeTitle: currentEpisodeData?.name,
    season: seasonNumber,
    episode: episodeNumber,
    year,
    rating,
    overview: currentEpisodeData?.overview || show?.overview || "",
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
          if (found) {
            setActiveSource(found);
            if (typeof window !== "undefined") {
              const sourceIndex = sources.findIndex((s) => s.type === found.type);
              const sourceNum = sourceIndex >= 0 ? sourceIndex + 1 : 1;
              sessionStorage.setItem("cinestream_tv_source", String(sourceNum));
              try {
                const url = new URL(window.location.href);
                url.searchParams.set("source", String(sourceNum));
                window.history.replaceState(null, "", url.toString());
              } catch {}
            }
          }
        }}
        seasons={allSeasonsData}
        onSelectEpisode={handleSelectEpisode}
      >
        <NativeHlsPlayer
          key={`${showId}-${seasonNumber}-${episodeNumber}-${activeSource.type}`}
          mediaType="tv"
          mediaId={showId}
          season={seasonNumber}
          episode={episodeNumber}
          fallbackIframeUrl={activeSource.url}
          server={activeSource.type}
          title={`${show?.name || "TV Series"} S${seasonNumber}E${episodeNumber}`}
          poster={backdropUrl || posterUrl || undefined}
        />
      </CinemaPlayer>
    </div>
  );
}
