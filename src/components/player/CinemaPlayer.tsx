"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Volume2,
  VolumeX,
  Minimize2,
  Cloud,
  Layers,
  Settings,
  Cast,
  Tv,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Server,
  SkipForward,
  Lock,
} from "lucide-react";
import { isEpisodeUpcoming } from "@/lib/episode-availability";
import { ServerOption } from "./ServerSelectorModal";
import { SOURCE_TAG_LABELS, TAG_STYLES, type SourceTag } from "@/lib/streaming-config";
import { DrawerSeason, DrawerEpisode } from "./EpisodeDrawer";
import { PlayerSettingsModal } from "./PlayerSettingsModal";
import { useAmbientColor } from "@/hooks/useAmbientColor";

export interface CinemaPlayerMetadata {
  title: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
  year?: string | number;
  rating?: number;
  contentRating?: string;
  overview?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  backUrl: string;
  tmdbId?: number | string | null;
}

interface CinemaPlayerProps {
  metadata: CinemaPlayerMetadata;
  servers: ServerOption[];
  activeServer: ServerOption;
  onSelectServer: (server: ServerOption) => void;
  seasons?: DrawerSeason[];
  onSelectEpisode?: (season: number, episode: number) => void;
  isAnime?: boolean;
  onReloadSource?: () => void;
  children: ReactNode;
}

export function CinemaPlayer({
  metadata,
  servers,
  activeServer,
  onSelectServer,
  seasons,
  onSelectEpisode,
  isAnime = false,
  onReloadSource,
  children,
}: CinemaPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const episodesScrollRef = useRef<HTMLDivElement>(null);

  // Dynamic ambient color from poster
  const ambientPalette = useAmbientColor(metadata.backdropUrl || metadata.posterUrl);

  // HUD Visibility
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Popups state (matching screenshots 2 & 3)
  const [showEpisodeCarousel, setShowEpisodeCarousel] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [playerMode, setPlayerMode] = useState<"native" | "iframe">("native");

  // Reload Source state
  const [reloadKey, setReloadKey] = useState(0);
  const [isReloading, setIsReloading] = useState(false);

  const handleReloadSource = useCallback(() => {
    setIsReloading(true);
    setReloadKey((prev) => prev + 1);
    if (onReloadSource) {
      try {
        onReloadSource();
      } catch {}
    }
    setTimeout(() => {
      setIsReloading(false);
    }, 750);
  }, [onReloadSource]);

  const handleNextSource = useCallback(() => {
    if (!servers || servers.length === 0) return;
    const currentIdx = servers.findIndex(
      (s) => s.key === activeServer.key || s.name === activeServer.name
    );
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % servers.length : 0;
    const nextServer = servers[nextIdx];
    if (nextServer) {
      onSelectServer(nextServer);
    }
  }, [servers, activeServer, onSelectServer]);

  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(metadata.season || 1);

  // Keep selectedSeasonNum in sync with current playing season
  useEffect(() => {
    if (metadata.season && Number(metadata.season) > 0) {
      setSelectedSeasonNum(Number(metadata.season));
    }
  }, [metadata.season]);

  const [activeEpisodeRange, setActiveEpisodeRange] = useState<string | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Video state
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Settings
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [autoSkipIntro, setAutoSkipIntro] = useState(false);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showEpisodeCarousel && !showServerMenu && !showSettingsModal) {
        setShowControls(false);
      }
    }, 3500);
  }, [showEpisodeCarousel, showServerMenu, showSettingsModal]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  const activeSeasonData = seasons?.find((s) => s.season_number === selectedSeasonNum) || seasons?.[0];

  // Helper to check if an episode is upcoming/unreleased
  const isEpisodeUpcomingFn = useCallback((ep: DrawerEpisode, allEpisodes: DrawerEpisode[]): boolean => {
    if (!ep) return false;
    if (ep.air_date && isEpisodeUpcoming(ep.air_date)) return true;

    const epNum = Number(ep.episode_number);
    const idx = allEpisodes.findIndex((e) => Number(e.episode_number) === epNum);
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        const prev = allEpisodes[i];
        if (prev?.air_date && isEpisodeUpcoming(prev.air_date)) {
          return true;
        }
      }
    }

    if (!ep.air_date && !ep.still_path) {
      const hasUpcomingInSeason = allEpisodes.some(
        (e) => e.air_date && isEpisodeUpcoming(e.air_date) && Number(e.episode_number) <= epNum
      );
      if (hasUpcomingInSeason) return true;
    }

    return false;
  }, []);

  // Determine if there is a next episode available (and not upcoming)
  const nextEpisodeInfo = useMemo(() => {
    if (!seasons || seasons.length === 0) return null;

    const curSeasonNum = Number(metadata.season || 1);
    const curEpNum = Number(metadata.episode || 1);

    if (isAnime) {
      const allEps = activeSeasonData?.episodes || seasons[0]?.episodes || [];
      const nextEp = allEps.find((e) => Number(e.episode_number) === curEpNum + 1);
      if (nextEp) {
        if (isEpisodeUpcomingFn(nextEp, allEps)) return null;
        return {
          season: curSeasonNum,
          episode: Number(nextEp.episode_number),
          title: nextEp.name || `Episode ${nextEp.episode_number}`,
        };
      }
      return null;
    }

    // For TV shows
    const curSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum);
    const curSeasonEps = curSeason?.episodes || [];
    const nextInSameSeason = curSeasonEps.find((e) => Number(e.episode_number) === curEpNum + 1);

    if (nextInSameSeason) {
      if (isEpisodeUpcomingFn(nextInSameSeason, curSeasonEps)) return null;
      return {
        season: curSeasonNum,
        episode: Number(nextInSameSeason.episode_number),
        title: nextInSameSeason.name || `Episode ${nextInSameSeason.episode_number}`,
      };
    }

    // Check if next season exists
    const nextSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum + 1);
    if (nextSeason && nextSeason.episodes && nextSeason.episodes.length > 0) {
      const firstEpOfNextSeason = nextSeason.episodes[0];
      if (isEpisodeUpcomingFn(firstEpOfNextSeason, nextSeason.episodes)) return null;
      return {
        season: Number(nextSeason.season_number),
        episode: Number(firstEpOfNextSeason.episode_number || 1),
        title: firstEpOfNextSeason.name || `Episode ${firstEpOfNextSeason.episode_number || 1}`,
      };
    }

    return null;
  }, [seasons, metadata.season, metadata.episode, isAnime, activeSeasonData, isEpisodeUpcomingFn]);

  // Determine if there is a previous episode available
  const prevEpisodeInfo = useMemo(() => {
    if (!seasons || seasons.length === 0) return null;

    const curSeasonNum = Number(metadata.season || 1);
    const curEpNum = Number(metadata.episode || 1);

    if (isAnime) {
      if (curEpNum <= 1) return null;
      const allEps = activeSeasonData?.episodes || seasons[0]?.episodes || [];
      const prevEp = allEps.find((e) => Number(e.episode_number) === curEpNum - 1);
      return {
        season: curSeasonNum,
        episode: prevEp ? Number(prevEp.episode_number) : curEpNum - 1,
        title: prevEp?.name || `Episode ${curEpNum - 1}`,
      };
    }

    // For TV shows
    const curSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum);
    const curSeasonEps = curSeason?.episodes || [];
    if (curEpNum > 1) {
      const prevInSameSeason = curSeasonEps.find((e) => Number(e.episode_number) === curEpNum - 1);
      return {
        season: curSeasonNum,
        episode: prevInSameSeason ? Number(prevInSameSeason.episode_number) : curEpNum - 1,
        title: prevInSameSeason?.name || `Episode ${curEpNum - 1}`,
      };
    }

    // If curEpNum === 1 and curSeasonNum > 1, check previous season
    if (curSeasonNum > 1) {
      const prevSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum - 1);
      if (prevSeason && prevSeason.episodes && prevSeason.episodes.length > 0) {
        const lastEpOfPrevSeason = prevSeason.episodes[prevSeason.episodes.length - 1];
        return {
          season: Number(prevSeason.season_number),
          episode: Number(lastEpOfPrevSeason.episode_number || prevSeason.episodes.length),
          title: lastEpOfPrevSeason.name || `Episode ${lastEpOfPrevSeason.episode_number}`,
        };
      }
    }

    return null;
  }, [seasons, metadata.season, metadata.episode, isAnime, activeSeasonData]);

  // Episode chunk ranges for large seasons (e.g. 50, 100, 1000+ anime episodes)
  const episodeRanges = useMemo(() => {
    const total = activeSeasonData?.episodes?.length || 0;
    if (total <= 24) return [];
    const chunkSize = 25;
    const r: { label: string; start: number; end: number }[] = [];
    for (let i = 1; i <= total; i += chunkSize) {
      const end = Math.min(i + chunkSize - 1, total);
      r.push({ label: `${i}–${end}`, start: i, end });
    }
    return r;
  }, [activeSeasonData]);

  // Default active range based on metadata.episode
  useEffect(() => {
    if (episodeRanges.length > 0) {
      const currentEp = metadata.episode || 1;
      const matchedRange = episodeRanges.find((r) => currentEp >= r.start && currentEp <= r.end);
      if (matchedRange) {
        setActiveEpisodeRange(matchedRange.label);
      } else {
        setActiveEpisodeRange(episodeRanges[0].label);
      }
    } else {
      setActiveEpisodeRange(null);
    }
  }, [episodeRanges, metadata.episode]);

  const displayedEpisodes = useMemo(() => {
    const all = activeSeasonData?.episodes || [];
    if (!activeEpisodeRange || episodeRanges.length === 0) return all;
    const selected = episodeRanges.find((r) => r.label === activeEpisodeRange);
    if (!selected) return all;
    return all.filter((e) => e.episode_number >= selected.start && e.episode_number <= selected.end);
  }, [activeSeasonData, activeEpisodeRange, episodeRanges]);

  // Auto-scroll episode carousel to the current episode card
  useEffect(() => {
    if (showEpisodeCarousel && episodesScrollRef.current) {
      if (episodeRanges.length > 0) {
        const currentEp = metadata.episode || 1;
        const matched = episodeRanges.find((r) => currentEp >= r.start && currentEp <= r.end);
        if (matched && activeEpisodeRange !== matched.label) {
          setActiveEpisodeRange(matched.label);
        }
      }

      const timer = setTimeout(() => {
        const container = episodesScrollRef.current;
        if (!container) return;
        const currentCard = (container.querySelector('[data-current="true"]') ||
          container.querySelector(`[data-episode="${metadata.episode}"]`)) as HTMLElement;
        if (currentCard) {
          currentCard.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showEpisodeCarousel, selectedSeasonNum, activeEpisodeRange, metadata.episode, episodeRanges]);

  const scrollEpisodes = (direction: "left" | "right") => {
    const el = episodesScrollRef.current;
    if (!el) return;

    const canScrollLeft = el.scrollLeft > 15;
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 15;

    if (direction === "left") {
      if (canScrollLeft) {
        el.scrollBy({ left: -Math.max(280, Math.floor(el.clientWidth * 0.7)), behavior: "smooth" });
      } else if (episodeRanges.length > 0) {
        const curIdx = episodeRanges.findIndex((r) => r.label === activeEpisodeRange);
        if (curIdx > 0) {
          const prevRange = episodeRanges[curIdx - 1];
          setActiveEpisodeRange(prevRange.label);
          setTimeout(() => {
            if (episodesScrollRef.current) {
              episodesScrollRef.current.scrollLeft = episodesScrollRef.current.scrollWidth;
            }
          }, 60);
        }
      }
    } else {
      if (canScrollRight) {
        el.scrollBy({ left: Math.max(280, Math.floor(el.clientWidth * 0.7)), behavior: "smooth" });
      } else if (episodeRanges.length > 0) {
        const curIdx = episodeRanges.findIndex((r) => r.label === activeEpisodeRange);
        if (curIdx >= 0 && curIdx < episodeRanges.length - 1) {
          const nextRange = episodeRanges[curIdx + 1];
          setActiveEpisodeRange(nextRange.label);
          setTimeout(() => {
            if (episodesScrollRef.current) {
              episodesScrollRef.current.scrollLeft = 0;
            }
          }, 60);
        }
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Lock body and html scroll so player page perfectly fits screen without overflow
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      className="fixed inset-0 w-full h-[100dvh] max-w-full max-h-full bg-black select-none overflow-hidden flex flex-col justify-between z-50 font-sans touch-none overscroll-none"
      style={ambientPalette.cssVars as React.CSSProperties}
    >
      {/* ── Background Video Screen ── */}
      <div className="absolute inset-0 w-full h-full bg-black z-0 flex items-center justify-center">
        {/* Dynamic Ambient Glow Behind Screen (only on global theme) */}
        <div
          className="absolute inset-0 -z-10 blur-3xl opacity-50 pointer-events-none transition-opacity duration-1000"
          style={{
            background: `radial-gradient(ellipse 90% 70% at 50% 50%, var(--ambient-glow, transparent), transparent 75%)`,
          }}
        />

        <div key={reloadKey} className={`w-full h-full relative transition-all duration-300 ${isTheaterMode ? "max-w-none" : "w-full"}`}>
          {React.isValidElement(children)
            ? React.cloneElement(children as React.ReactElement<any>, {
                onModeChange: setPlayerMode,
                onProgress: (cur: number, dur: number) => {
                  setCurrentTime(cur);
                  if (dur > 0) setDuration(dur);
                },
              })
            : children}
        </div>

        {/* ── Reloading Source Floating Feedback ── */}
        {isReloading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-black/90 border border-white/20 backdrop-blur-md text-xs font-bold text-white flex items-center gap-2 shadow-2xl animate-fade-in pointer-events-none">
            <RotateCcw className="w-4 h-4 animate-spin text-primary" />
            <span>Reloading current source...</span>
          </div>
        )}
      </div>

      {/* ── Top Bar Hover Detector (keeps bar active when hovering top 70px) ── */}
      <div
        onMouseEnter={() => setShowControls(true)}
        className="fixed top-0 inset-x-0 h-20 z-30 pointer-events-auto"
      />

      {/* ── Top Cinema Navigation Bar ── */}
      <div
        onMouseEnter={() => setShowControls(true)}
        className={`fixed top-0 inset-x-0 z-40 h-20 px-4 sm:px-6 md:px-8 flex items-center justify-between bg-gradient-to-b from-black via-black/90 to-transparent backdrop-blur-md pt-2 pb-6 transition-all duration-300 ${
          showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        {/* Left: Back to Media Page Button */}
        <Link
          href={metadata.backUrl}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/15 backdrop-blur-md transition-all shadow-md cursor-pointer group"
          title="Back to Details"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">Back</span>
        </Link>

        {/* Center: Title & Episode Subtitle & Source Badge */}
        <div className="flex flex-col items-center text-center max-w-[40%] sm:max-w-[48%] truncate px-2">
          <div className="flex items-center justify-center gap-2 max-w-full">
            <h2 className="text-xs sm:text-sm md:text-base font-black text-white tracking-tight drop-shadow-md truncate">
              {metadata.title}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shrink-0 shadow-sm">
              {activeServer.name || "Source 1"}
            </span>
          </div>
          <span className="text-[10px] sm:text-xs text-white/60 font-semibold drop-shadow-sm truncate">
            {isAnime && metadata.episode
              ? `Episode ${metadata.episode}${metadata.episodeTitle ? ` • ${metadata.episodeTitle}` : ""}`
              : metadata.season && metadata.episode
              ? `S${metadata.season} E${metadata.episode}${metadata.episodeTitle ? ` • ${metadata.episodeTitle}` : ""}`
              : metadata.year || ""}
          </span>
        </div>

        {/* Right: Quick Action Buttons (Episodes, Servers, Next Source, Reload) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Episodes Drawer Button (if TV/Anime) */}
          {seasons && seasons.length > 0 && (
            <button
              onClick={() => {
                setShowEpisodeCarousel(!showEpisodeCarousel);
                setShowServerMenu(false);
              }}
              className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                showEpisodeCarousel
                  ? "bg-white text-black shadow-lg"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md"
              }`}
              title="Episode List"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden md:inline">Episodes</span>
            </button>
          )}

          {/* Sources Button */}
          <button
            onClick={() => {
              setShowServerMenu(!showServerMenu);
              setShowEpisodeCarousel(false);
            }}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              showServerMenu
                ? "bg-white text-black shadow-lg"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md"
            }`}
            title="Switch Source"
          >
            <Cloud className="w-4 h-4" />
            <span className="hidden md:inline">Sources</span>
          </button>

          {/* Next Source Button */}
          {servers && servers.length > 1 && (
            <button
              onClick={handleNextSource}
              className="px-2.5 sm:px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md active:scale-95"
              title="Next Source"
            >
              <SkipForward className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Next Source</span>
            </button>
          )}

          {/* Reload Source Button */}
          <button
            onClick={handleReloadSource}
            disabled={isReloading}
            className="px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md active:scale-95 disabled:opacity-60"
            title="Reload Current Source"
          >
            <RotateCcw className={`w-4 h-4 ${isReloading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden md:inline">{isReloading ? "Reloading..." : "Reload"}</span>
          </button>
        </div>
      </div>

      {/* ── Floating Episode Horizontal Carousel (Screenshot 2) ── */}
      {showEpisodeCarousel && seasons && seasons.length > 0 && (
        <div className="relative z-40 mx-4 sm:mx-8 mb-2 p-5 rounded-3xl bg-[#18181b]/95 border border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              {seasons.length > 1 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {seasons.map((s) => (
                    <button
                      key={s.id || s.season_number}
                      onClick={() => setSelectedSeasonNum(s.season_number)}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        selectedSeasonNum === s.season_number
                          ? "bg-white text-black shadow"
                          : "bg-white/10 text-white/60 hover:text-white"
                      }`}
                    >
                      {s.name || `Season ${s.season_number}`}
                    </button>
                  ))}
                </div>
              ) : (
                <h3 className="text-sm font-extrabold text-white">
                  {activeSeasonData?.name || (isAnime ? "Episodes" : `Season ${selectedSeasonNum}`)}
                </h3>
              )}

              {/* Episode Range Selector for Long Shows / Anime (e.g. 1-25, 26-50, 951-1000) */}
              {episodeRanges.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-sm sm:max-w-md hide-scrollbar py-0.5">
                  {episodeRanges.map((r) => (
                    <button
                      key={r.label}
                      onClick={() => setActiveEpisodeRange(r.label)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 transition-all cursor-pointer ${
                        activeEpisodeRange === r.label
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {prevEpisodeInfo && (
                <button
                  onClick={() => {
                    if (onSelectEpisode) {
                      onSelectEpisode(prevEpisodeInfo.season, prevEpisodeInfo.episode);
                      setShowEpisodeCarousel(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-black text-xs shadow-md border border-white/15 transition-all cursor-pointer group"
                  title={`Jump to Previous Episode (${isAnime ? `EP ${prevEpisodeInfo.episode}` : `S${prevEpisodeInfo.season}E${prevEpisodeInfo.episode}`})`}
                >
                  <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="tracking-tight">Prev Ep</span>
                  <span className="text-[10px] font-bold opacity-75">
                    {isAnime ? `EP ${prevEpisodeInfo.episode}` : `S${prevEpisodeInfo.season}E${prevEpisodeInfo.episode}`}
                  </span>
                </button>
              )}

              {nextEpisodeInfo && (
                <button
                  onClick={() => {
                    if (onSelectEpisode) {
                      onSelectEpisode(nextEpisodeInfo.season, nextEpisodeInfo.episode);
                      setShowEpisodeCarousel(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-black text-xs shadow-md border border-white/20 transition-all cursor-pointer group"
                  title={`Jump to Next Episode (${isAnime ? `EP ${nextEpisodeInfo.episode}` : `S${nextEpisodeInfo.season}E${nextEpisodeInfo.episode}`})`}
                >
                  <span className="tracking-tight">Next Ep</span>
                  <span className="text-[10px] font-bold opacity-80">
                    {isAnime ? `EP ${nextEpisodeInfo.episode}` : `S${nextEpisodeInfo.season}E${nextEpisodeInfo.episode}`}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              <button
                onClick={() => setShowEpisodeCarousel(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Episode Cards Row with Left/Right Arrows */}
          <div className="relative group/episodes flex items-center">
            <button
              onClick={() => scrollEpisodes("left")}
              className="absolute -left-2 z-10 w-9 h-9 rounded-full bg-black/80 hover:bg-black text-white border border-white/20 flex items-center justify-center shadow-xl cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div
              ref={episodesScrollRef}
              className="flex items-start gap-4 overflow-x-auto py-1 px-4 hide-scrollbar w-full"
            >
              {displayedEpisodes.map((ep) => {
                const isCurrentPlaying = isAnime
                  ? Number(metadata.episode) === Number(ep.episode_number)
                  : Number(metadata.season || 1) === Number(selectedSeasonNum) && Number(metadata.episode) === Number(ep.episode_number);
                const isUpcoming = isEpisodeUpcomingFn(ep, activeSeasonData?.episodes || []);
                const thumbUrl = ep.still_path
                  ? ep.still_path.startsWith("http")
                    ? ep.still_path
                    : `https://image.tmdb.org/t/p/w300${ep.still_path}`
                  : null;

                return (
                  <button
                    key={ep.id || ep.episode_number}
                    data-current={isCurrentPlaying ? "true" : undefined}
                    data-episode={ep.episode_number}
                    disabled={isUpcoming}
                    onClick={() => {
                      if (isUpcoming) return;
                      if (onSelectEpisode) {
                        onSelectEpisode(selectedSeasonNum, ep.episode_number);
                        setShowEpisodeCarousel(false);
                      }
                    }}
                    className={`w-[240px] sm:w-[260px] shrink-0 text-left rounded-2xl overflow-hidden border transition-all group/card ${
                      isUpcoming
                        ? "bg-[#18181b]/50 border-white/5 opacity-60 cursor-not-allowed"
                        : isCurrentPlaying
                        ? "bg-emerald-950/40 border-emerald-500/80 ring-2 ring-emerald-500/60 shadow-xl shadow-emerald-500/20 cursor-pointer"
                        : "bg-[#27272a]/70 border-white/10 hover:bg-[#27272a] hover:border-white/20 cursor-pointer"
                    }`}
                  >
                    {/* Thumbnail with S1E1 or EP Badge */}
                    <div className="relative w-full aspect-video bg-black/60 overflow-hidden">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={ep.name}
                          className={`w-full h-full object-cover transition-transform duration-300 ${
                            isUpcoming ? "" : "group-hover/card:scale-105"
                          }`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 font-bold text-xs">
                          EP {ep.episode_number}
                        </div>
                      )}

                      {/* Upcoming Overlay */}
                      {isUpcoming && (
                        <div className="absolute inset-0 z-10 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5">
                          <Lock className="w-5 h-5 text-white/60" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Upcoming</span>
                        </div>
                      )}

                      {/* Pill Badge on Thumbnail (Current + Season/Ep) */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap max-w-[calc(100%-1rem)]">
                        <span className="px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md text-[10px] font-extrabold text-white uppercase tracking-wider border border-white/15 shadow">
                          {isAnime ? `EP ${ep.episode_number}` : `S${selectedSeasonNum}E${ep.episode_number}`}
                        </span>
                        {isCurrentPlaying && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 border border-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                            Current
                          </span>
                        )}
                      </div>

                      {/* Filler Tag Badge */}
                      {ep.isFiller && !isUpcoming && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow-md border border-amber-300">
                          Filler
                        </div>
                      )}
                    </div>

                    {/* Episode Info */}
                    <div className="p-3.5 space-y-1">
                      <h4 className={`text-xs sm:text-sm font-bold line-clamp-1 transition-colors ${
                        isCurrentPlaying ? "text-emerald-400 font-extrabold" : isUpcoming ? "text-white/40" : "text-white group-hover/card:text-primary"
                      }`}>
                        {ep.name || `Episode ${ep.episode_number}`}
                      </h4>
                      {ep.overview && (
                        <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                          {ep.overview}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}

              {nextEpisodeInfo && (
                <button
                  onClick={() => {
                    if (onSelectEpisode) {
                      onSelectEpisode(nextEpisodeInfo.season, nextEpisodeInfo.episode);
                      setShowEpisodeCarousel(false);
                    }
                  }}
                  className="w-[180px] sm:w-[200px] shrink-0 text-left rounded-2xl overflow-hidden border border-dashed border-primary/40 hover:border-primary bg-primary/10 hover:bg-primary/20 transition-all p-5 flex flex-col items-center justify-center gap-2.5 group/next cursor-pointer self-stretch text-center"
                >
                  <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary group-hover/next:scale-110 group-hover/next:bg-primary group-hover/next:text-black transition-all shadow-md">
                    <SkipForward className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <span className="block text-xs font-black text-white">Next Episode</span>
                    <span className="block text-[11px] font-bold text-primary truncate max-w-[160px] mt-0.5">
                      {isAnime ? `EP ${nextEpisodeInfo.episode}` : `S${nextEpisodeInfo.season}E${nextEpisodeInfo.episode}`}
                    </span>
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={() => scrollEpisodes("right")}
              className="absolute -right-2 z-10 w-9 h-9 rounded-full bg-black/80 hover:bg-black text-white border border-white/20 flex items-center justify-center shadow-xl cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Server Selection Popup ── */}
      {showServerMenu && (
        <div className="absolute right-4 sm:right-12 bottom-24 z-40 w-72 sm:w-80 bg-[#18181b]/95 border border-white/15 rounded-2xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-fade-in space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-primary" />
              <h4 className="text-xs font-extrabold text-white">Stream Sources</h4>
            </div>
            <button
              onClick={() => setShowServerMenu(false)}
              className="text-white/50 hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {servers.map((server, idx) => {
              const isActive =
                activeServer.key === server.type ||
                activeServer.type === server.type ||
                activeServer.key === server.key ||
                activeServer.name === server.name;

              const tagKey = (server.tag || (server.quality ? server.quality.toLowerCase() : "")) as SourceTag;
              const tagLabel =
                tagKey && SOURCE_TAG_LABELS[tagKey]
                  ? SOURCE_TAG_LABELS[tagKey]
                  : server.quality || (idx === 0 ? "Recommended" : idx <= 2 ? "Best" : idx <= 3 ? "Good" : "Backup");

              const tagStyle =
                (tagKey && TAG_STYLES[tagKey]) ||
                (server.quality === "Best"
                  ? "bg-emerald-400/15 text-emerald-300 border-emerald-300/25"
                  : server.quality === "Good"
                  ? "bg-cyan-400/15 text-cyan-300 border-cyan-300/25"
                  : server.quality === "Stable"
                  ? "bg-violet-400/15 text-violet-300 border-violet-300/25"
                  : "bg-amber-400/15 text-amber-300 border-amber-300/25");

              return (
                <button
                  key={server.key || server.type || idx}
                  onClick={() => {
                    onSelectServer(server);
                    setShowServerMenu(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-white/15 text-white ring-1 ring-white/30 shadow-md"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isActive
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                          : "bg-white/30"
                      }`}
                    />
                    <span className="truncate">{`Source ${idx + 1}`}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wide uppercase ${tagStyle}`}
                    >
                      {tagLabel}
                    </span>
                    {isActive && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom Cinema Control Bar (ONLY rendered for native HLS player so no duplicate scrubbers on iframes) ── */}
      {playerMode === "native" && (
        <div
          className={`relative z-30 w-full px-6 pb-6 pt-10 bg-gradient-to-t from-black via-black/70 to-transparent transition-opacity duration-300 ${
            showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Timeline Scrubber Line */}
          <div className="w-full h-1 bg-white/20 hover:h-1.5 rounded-full relative mb-4 cursor-pointer transition-all">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            {/* Left Controls: Play, Rewind 10, FastForward 10, Volume, Time */}
            <div className="flex items-center gap-4 sm:gap-5">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-white hover:scale-110 transition-transform cursor-pointer"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <button
                onClick={() => {}}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Rewind 10s"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={() => {}}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Forward 10s"
              >
                <FastForward className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <span className="text-xs font-semibold text-white/70 tracking-wide">
                {formatTime(currentTime)} / {formatTime(duration || 3217)}
              </span>
            </div>

            {/* Right Controls: [Episodes] [Theater] [Servers] [Subtitles] [Settings] [Fullscreen] */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Episodes Drawer Icon (Screenshot 2) */}
              {seasons && seasons.length > 0 && (
                <button
                  onClick={() => {
                    setShowEpisodeCarousel(!showEpisodeCarousel);
                    setShowServerMenu(false);
                  }}
                  className={`p-1 text-white transition-colors cursor-pointer ${
                    showEpisodeCarousel ? "text-primary" : "text-white/80 hover:text-white"
                  }`}
                  title="Episode List"
                >
                  <Layers className="w-5 h-5" />
                </button>
              )}

              {/* Screen / Theater Mode Icon */}
              <button
                onClick={() => setIsTheaterMode(!isTheaterMode)}
                className={`p-1 text-white transition-colors cursor-pointer ${
                  isTheaterMode ? "text-primary" : "text-white/80 hover:text-white"
                }`}
                title="Screen Mode"
              >
                <Tv className="w-5 h-5" />
              </button>

              {/* Sources Cloud Icon */}
              <button
                onClick={() => {
                  setShowServerMenu(!showServerMenu);
                  setShowEpisodeCarousel(false);
                }}
                className={`p-1 text-white transition-colors cursor-pointer ${
                  showServerMenu ? "text-primary" : "text-white/80 hover:text-white"
                }`}
                title="Sources"
              >
                <Cloud className="w-5 h-5" />
              </button>

              {/* Next Source Icon */}
              {servers && servers.length > 1 && (
                <button
                  onClick={handleNextSource}
                  className="p-1 text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
                  title="Next Source"
                >
                  <SkipForward className="w-5 h-5 text-primary" />
                </button>
              )}

              {/* Reload Source Icon */}
              <button
                onClick={handleReloadSource}
                disabled={isReloading}
                className="p-1 text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95 disabled:opacity-60"
                title="Reload Current Source"
              >
                <RotateCcw className={`w-5 h-5 ${isReloading ? "animate-spin text-primary" : ""}`} />
              </button>

              {/* Settings Icon */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-1 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <PlayerSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        playbackSpeed={playbackSpeed}
        onSpeedChange={setPlaybackSpeed}
        autoPlayNext={autoPlayNext}
        onToggleAutoPlayNext={() => setAutoPlayNext(!autoPlayNext)}
        autoSkipIntro={autoSkipIntro}
        onToggleAutoSkipIntro={() => setAutoSkipIntro(!autoSkipIntro)}
      />
    </div>
  );
}
