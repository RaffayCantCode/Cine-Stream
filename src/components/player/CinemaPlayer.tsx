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
  Subtitles,
  Settings,
  Cast,
  Tv,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { ServerOption } from "./ServerSelectorModal";
import { DrawerSeason, DrawerEpisode } from "./EpisodeDrawer";
import { PlayerSettingsModal } from "./PlayerSettingsModal";
import { SubtitleSettingsModal, type SubtitleConfig } from "./SubtitleSettingsModal";
import { OpenSubtitlesPicker, type SubtitleCueItem } from "./OpenSubtitlesPicker";
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
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [showOpenSubtitlesPicker, setShowOpenSubtitlesPicker] = useState(false);
  const [playerMode, setPlayerMode] = useState<"native" | "iframe">("native");

  // Active OpenSubtitles track & parsed cues
  const [activeOsSub, setActiveOsSub] = useState<{
    url: string;
    label: string;
    cues?: SubtitleCueItem[];
  } | null>(null);

  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(metadata.season || 1);
  const [activeEpisodeRange, setActiveEpisodeRange] = useState<string | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Video state
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Active Subtitle Cue Text synced with currentTime
  const activeSubtitleText = useMemo(() => {
    if (!activeOsSub?.cues || activeOsSub.cues.length === 0) return null;
    const match = activeOsSub.cues.find(
      (c) => currentTime >= c.start && currentTime <= c.end
    );
    return match?.text || null;
  }, [activeOsSub, currentTime]);

  // Settings
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [autoSkipIntro, setAutoSkipIntro] = useState(false);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({
    fontSize: "medium",
    fontColor: "#FFFFFF",
    bgColor: "#000000",
    bgOpacity: 50,
  });

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showEpisodeCarousel && !showServerMenu && !showSettingsModal && !showSubtitleModal) {
        setShowControls(false);
      }
    }, 3500);
  }, [showEpisodeCarousel, showServerMenu, showSettingsModal, showSubtitleModal]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  const activeSeasonData = seasons?.find((s) => s.season_number === selectedSeasonNum) || seasons?.[0];

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
      const timer = setTimeout(() => {
        const container = episodesScrollRef.current;
        if (!container) return;
        const currentCard = container.querySelector('[data-current="true"]') as HTMLElement;
        if (currentCard) {
          const scrollTarget = currentCard.offsetLeft - container.offsetWidth / 2 + currentCard.offsetWidth / 2;
          container.scrollTo({ left: Math.max(0, scrollTarget), behavior: "smooth" });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showEpisodeCarousel, selectedSeasonNum, activeEpisodeRange, metadata.episode]);

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

        <div className={`w-full h-full relative transition-all duration-300 ${isTheaterMode ? "max-w-none" : "w-full"}`}>
          {React.isValidElement(children)
            ? React.cloneElement(children as React.ReactElement<any>, {
                customSubtitle: activeOsSub,
                subtitleSettings: subtitleConfig,
                onModeChange: setPlayerMode,
                onProgress: (cur: number, dur: number) => {
                  setCurrentTime(cur);
                  if (dur > 0) setDuration(dur);
                },
              })
            : children}
        </div>

        {/* ── Dynamic OpenSubtitles Live Text Overlay (Centered Bottom with Smart Offset) ── */}
        {activeSubtitleText && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 max-w-[90%] sm:max-w-[80%] text-center transition-all duration-300 ${
              showControls ? "bottom-24 sm:bottom-28 md:bottom-32" : "bottom-6 sm:bottom-8 md:bottom-10"
            }`}
          >
            <span
              className="inline-block px-3.5 py-1.5 rounded-xl font-bold leading-relaxed shadow-2xl backdrop-blur-xs select-none"
              style={{
                color: subtitleConfig.fontColor || "#FFFFFF",
                backgroundColor: `rgba(0, 0, 0, ${(subtitleConfig.bgOpacity ?? 60) / 100})`,
                fontSize:
                  subtitleConfig.fontSize === "small"
                    ? "13px"
                    : subtitleConfig.fontSize === "medium"
                    ? "17px"
                    : subtitleConfig.fontSize === "large"
                    ? "22px"
                    : "28px",
                textShadow: "0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)",
              }}
            >
              {activeSubtitleText}
            </span>
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

        {/* Center: Title & Episode Subtitle */}
        <div className="flex flex-col items-center text-center max-w-[40%] sm:max-w-[50%] truncate px-2">
          <h2 className="text-xs sm:text-sm md:text-base font-black text-white tracking-tight drop-shadow-md truncate">
            {metadata.title}
          </h2>
          <span className="text-[10px] sm:text-xs text-white/60 font-semibold drop-shadow-sm truncate">
            {metadata.season && metadata.episode
              ? `S${metadata.season} E${metadata.episode}${metadata.episodeTitle ? ` • ${metadata.episodeTitle}` : ""}`
              : metadata.year || ""}
          </span>
        </div>

        {/* Right: Quick Action Buttons (Episodes, Servers, OpenSubtitles, Fullscreen) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Episodes Drawer Button (if TV/Anime) */}
          {seasons && seasons.length > 0 && (
            <button
              onClick={() => {
                setShowEpisodeCarousel(!showEpisodeCarousel);
                setShowServerMenu(false);
                setShowOpenSubtitlesPicker(false);
                setShowSubtitleModal(false);
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

          {/* Servers Button */}
          <button
            onClick={() => {
              setShowServerMenu(!showServerMenu);
              setShowEpisodeCarousel(false);
              setShowOpenSubtitlesPicker(false);
              setShowSubtitleModal(false);
            }}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              showServerMenu
                ? "bg-white text-black shadow-lg"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md"
            }`}
            title="Switch Server"
          >
            <Cloud className="w-4 h-4" />
            <span className="hidden md:inline">Servers</span>
          </button>

          {/* OpenSubtitles Button */}
          <button
            onClick={() => {
              setShowOpenSubtitlesPicker(true);
              setShowServerMenu(false);
              setShowEpisodeCarousel(false);
              setShowSubtitleModal(false);
            }}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              showOpenSubtitlesPicker || activeOsSub
                ? "bg-emerald-500 text-black shadow-lg"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md"
            }`}
            title="Community Subtitles"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden md:inline">Subtitles</span>
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
                  {activeSeasonData?.name || `Season ${selectedSeasonNum}`}
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

            <button
              onClick={() => setShowEpisodeCarousel(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
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
              className="flex items-start gap-4 overflow-x-auto py-1 px-4 hide-scrollbar w-full scroll-smooth"
            >
              {displayedEpisodes.map((ep) => {
                const isCurrentPlaying =
                  metadata.season === selectedSeasonNum && metadata.episode === ep.episode_number;
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
                    onClick={() => {
                      if (onSelectEpisode) {
                        onSelectEpisode(selectedSeasonNum, ep.episode_number);
                        setShowEpisodeCarousel(false);
                      }
                    }}
                    className={`w-[240px] sm:w-[260px] shrink-0 text-left rounded-2xl overflow-hidden border transition-all group/card cursor-pointer ${
                      isCurrentPlaying
                        ? "bg-white/10 border-white/40 ring-1 ring-white/30 shadow-lg"
                        : "bg-[#27272a]/70 border-white/10 hover:bg-[#27272a] hover:border-white/20"
                    }`}
                  >
                    {/* Thumbnail with S1E1 Badge */}
                    <div className="relative w-full aspect-video bg-black/60 overflow-hidden">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={ep.name}
                          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 font-bold text-xs">
                          EP {ep.episode_number}
                        </div>
                      )}

                      {/* Pill Badge on Thumbnail */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-extrabold text-white uppercase tracking-wider border border-white/10">
                        {isCurrentPlaying ? `S${selectedSeasonNum}E${ep.episode_number} • Now Playing` : `S${selectedSeasonNum}E${ep.episode_number}`}
                      </div>

                      {/* Filler Tag Badge */}
                      {ep.isFiller && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow-md">
                          Filler
                        </div>
                      )}
                    </div>

                    {/* Episode Info */}
                    <div className="p-3.5 space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover/card:text-primary transition-colors">
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

      {/* ── Floating Server Selection Popup (Screenshot 3) ── */}
      {showServerMenu && (
        <div className="absolute right-6 sm:right-12 bottom-24 z-40 w-64 bg-[#18181b]/95 border border-white/15 rounded-2xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-fade-in space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h4 className="text-xs font-extrabold text-white">Servers</h4>
            <button
              onClick={() => setShowServerMenu(false)}
              className="text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {servers.map((server, idx) => {
              const isActive =
                activeServer.key === server.type ||
                activeServer.type === server.type ||
                activeServer.name === server.name;

              return (
                <button
                  key={server.key || server.type || idx}
                  onClick={() => {
                    onSelectServer(server);
                    setShowServerMenu(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-white/15 text-white ring-1 ring-white/30"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-[11px]">{idx % 2 === 0 ? "🇺🇸" : "⚡"}</span>
                    <span className="truncate">{server.name}</span>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
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

              {/* Servers Cloud Icon (Screenshot 3) */}
              <button
                onClick={() => {
                  setShowServerMenu(!showServerMenu);
                  setShowEpisodeCarousel(false);
                }}
                className={`p-1 text-white transition-colors cursor-pointer ${
                  showServerMenu ? "text-primary" : "text-white/80 hover:text-white"
                }`}
                title="Servers"
              >
                <Cloud className="w-5 h-5" />
              </button>

              {/* OpenSubtitles Icon */}
              <button
                onClick={() => {
                  setShowOpenSubtitlesPicker(true);
                  setShowSubtitleModal(false);
                  setShowServerMenu(false);
                  setShowEpisodeCarousel(false);
                }}
                className={`p-1 text-white transition-colors cursor-pointer ${
                  showOpenSubtitlesPicker || activeOsSub ? "text-emerald-400" : "text-white/80 hover:text-white"
                }`}
                title="OpenSubtitles (Community Subs)"
              >
                <Globe className="w-5 h-5" />
              </button>

              {/* Subtitles Style Icon */}
              <button
                onClick={() => {
                  setShowSubtitleModal(true);
                  setShowOpenSubtitlesPicker(false);
                  setShowServerMenu(false);
                  setShowEpisodeCarousel(false);
                }}
                className="p-1 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Subtitles Style"
              >
                <Subtitles className="w-5 h-5" />
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

      {/* OpenSubtitles Community Subtitle Picker */}
      <OpenSubtitlesPicker
        isOpen={showOpenSubtitlesPicker}
        onClose={() => setShowOpenSubtitlesPicker(false)}
        tmdbId={metadata.tmdbId}
        season={metadata.season}
        episode={metadata.episode}
        onSelectSubtitle={(url, label) => {
          setActiveOsSub({ url, label });
        }}
      />

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

      {/* Subtitles Modal */}
      <SubtitleSettingsModal
        isOpen={showSubtitleModal}
        onClose={() => setShowSubtitleModal(false)}
        config={subtitleConfig}
        onChange={setSubtitleConfig}
        onOpenSubtitlesSearch={() => setShowOpenSubtitlesPicker(true)}
      />
    </div>
  );
}
