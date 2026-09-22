"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Cloud,
  Layers,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Server,
  Lock,
  Menu,
  ChevronUp,
} from "lucide-react";
import { isEpisodeUpcoming } from "@/lib/episode-availability";
import { ServerOption } from "./ServerSelectorModal";
import { SOURCE_TAG_LABELS, TAG_STYLES, type SourceTag } from "@/lib/streaming-config";
import { DrawerSeason, DrawerEpisode } from "./EpisodeDrawer";
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

const CarouselThumbnail = React.memo(function CarouselThumbnail({
  thumbUrl,
  title,
  episodeNumber,
  isUpcoming,
}: {
  thumbUrl: string | null;
  title: string;
  episodeNumber: number;
  isUpcoming?: boolean;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(thumbUrl);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgSrc(thumbUrl);
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [thumbUrl]);

  // Network adaptive fallback on slow connection (>5s)
  useEffect(() => {
    if (isLoaded || hasError || !imgSrc) return;
    const timer = setTimeout(() => {
      if (!isLoaded && !hasError) {
        if (imgSrc.includes("/w780/")) {
          setImgSrc((prev) => (prev ? prev.replace("/w780/", "/w300/") : null));
        } else if (imgSrc.includes("/w300/")) {
          setImgSrc((prev) => (prev ? prev.replace("/w300/", "/w185/") : null));
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [imgSrc, isLoaded, hasError]);

  const handleImageError = () => {
    if (imgSrc && imgSrc.includes("/w780/")) {
      setImgSrc(imgSrc.replace("/w780/", "/w500/"));
    } else if (imgSrc && imgSrc.includes("/w500/")) {
      setImgSrc(imgSrc.replace("/w500/", "/w300/"));
    } else if (imgSrc && imgSrc.includes("/w300/")) {
      setImgSrc(imgSrc.replace("/w300/", "/w185/"));
    } else if (imgSrc && imgSrc.includes("/w185/")) {
      setImgSrc(imgSrc.replace("/w185/", "/original/"));
    } else {
      setHasError(true);
    }
  };

  const showImg = imgSrc && !hasError;

  return (
    <div className="relative w-full h-full overflow-hidden bg-black/60">
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent animate-pulse pointer-events-none" />
      )}
      {showImg ? (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={title}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={handleImageError}
          className={`w-full h-full object-cover transition-opacity duration-500 ease-out ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${isUpcoming ? "" : "group-hover/card:scale-105"}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#262E36]/90 to-[#12161B] text-white/30 font-bold text-xs select-none p-1">
          <Play className="w-5 h-5 text-white/20 mb-1" />
          <span>EP {episodeNumber}</span>
        </div>
      )}
    </div>
  );
});

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
  const rangeScrollRef = useRef<HTMLDivElement>(null);

  const [canScrollRangeLeft, setCanScrollRangeLeft] = useState(false);
  const [canScrollRangeRight, setCanScrollRangeRight] = useState(false);

  // Dynamic ambient color from poster
  const ambientPalette = useAmbientColor(metadata.backdropUrl || metadata.posterUrl);



  // Popups state (matching screenshots 2 & 3)
  const [showEpisodeCarousel, setShowEpisodeCarousel] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [playerMode, setPlayerMode] = useState<"native" | "iframe">(isAnime ? "iframe" : "native");
  const [showTopBar, setShowTopBar] = useState(true);
  const [showDropdownMenu, setShowDropdownMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdownMenu) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target?.closest?.('[data-menu-toggle]')) return;
        setShowDropdownMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showDropdownMenu]);

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

  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(metadata.season || 1);

  // Keep selectedSeasonNum in sync with current playing season
  useEffect(() => {
    if (metadata.season && Number(metadata.season) > 0) {
      setSelectedSeasonNum(Number(metadata.season));
    }
  }, [metadata.season]);

  const [activeEpisodeRange, setActiveEpisodeRange] = useState<string | null>(null);
  // Video state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (containerRef.current) {
        const iframes = containerRef.current.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({ cmd: "PLAY_TOGGLE" }), "*");
            iframe.contentWindow.postMessage({ cmd: "PLAY_TOGGLE" }, "*");
            iframe.contentWindow.postMessage({ command: next ? "play" : "pause" }, "*");
            iframe.contentWindow.postMessage(JSON.stringify({ event: next ? "play" : "pause" }), "*");
          }
        });
      }
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as any;
    const isFull = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
    if (!isFull) {
      const el = (containerRef.current || document.documentElement) as any;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } else {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
      else if (doc.msExitFullscreen) doc.msExitFullscreen();
    }
  }, []);

  const handleToggleTopBar = useCallback(() => {
    setShowTopBar((prev) => {
      if (prev) {
        setShowEpisodeCarousel(false);
        setShowServerMenu(false);
      }
      return !prev;
    });
  }, []);

  const handleMenuButtonClick = useCallback(() => {
    // On desktop / tablet (>= 640px), pressing the menu button shows the top bar fully again
    if (typeof window !== "undefined" && window.innerWidth >= 640) {
      setShowTopBar(true);
      setShowDropdownMenu(false);
    } else {
      // On mobile (< 640px), toggle controls dropdown
      setShowDropdownMenu((prev) => !prev);
    }
  }, []);

  const broadcastFullscreenState = useCallback((state?: boolean) => {
    const doc = document as any;
    const isFull = state !== undefined ? state : Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
    if (containerRef.current) {
      const iframes = containerRef.current.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ megaFullscreenState: isFull }, "*");
            iframe.contentWindow.postMessage(JSON.stringify({ megaFullscreenState: isFull }), "*");
            iframe.contentWindow.postMessage({ command: isFull ? "enterFullscreen" : "exitFullscreen" }, "*");
            iframe.contentWindow.postMessage(JSON.stringify({ command: isFull ? "enterFullscreen" : "exitFullscreen" }), "*");
            iframe.contentWindow.postMessage({ type: isFull ? "enterFullscreen" : "exitFullscreen" }, "*");
            iframe.contentWindow.postMessage({ event: isFull ? "fullscreen_on" : "fullscreen_off" }, "*");
          }
        } catch {}
      });
    }
  }, []);

  // Periodically handshake with iframes so embedded players bind to parent fullscreen
  useEffect(() => {
    broadcastFullscreenState();
    const timers = [100, 300, 600, 1200, 2500, 5000, 8000].map((ms) =>
      setTimeout(() => broadcastFullscreenState(), ms)
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [broadcastFullscreenState, reloadKey]);

  // Synchronize source player and site controls fullscreen:
  // Intercept any fullscreen request from child video or iframe and redirect it to the cinema player container.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const patchMediaElement = (el: any) => {
      if (!el || el.__cinemaFsPatched) return;
      el.__cinemaFsPatched = true;

      const originalRequestFullscreen = el.requestFullscreen?.bind(el);
      const customRequestFullscreen = function (this: any, options?: FullscreenOptions) {
        if (container.requestFullscreen) {
          return container.requestFullscreen(options);
        }
        if ((container as any).webkitRequestFullscreen) {
          return (container as any).webkitRequestFullscreen();
        }
        if ((container as any).mozRequestFullScreen) {
          return (container as any).mozRequestFullScreen();
        }
        if ((container as any).msRequestFullscreen) {
          return (container as any).msRequestFullscreen();
        }
        return originalRequestFullscreen ? originalRequestFullscreen(options) : Promise.resolve();
      };

      try {
        el.requestFullscreen = customRequestFullscreen;
        el.webkitRequestFullscreen = customRequestFullscreen;
        el.mozRequestFullScreen = customRequestFullscreen;
        el.msRequestFullscreen = customRequestFullscreen;
      } catch {}
    };

    const patchAll = () => {
      container.querySelectorAll("video").forEach(patchMediaElement);
      container.querySelectorAll("iframe").forEach(patchMediaElement);
    };

    patchAll();
    const observer = new MutationObserver(() => {
      patchAll();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const fsElement = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
      const isFull = Boolean(fsElement);
      setIsFullscreen(isFull);

      // If an iframe or child video entered native fullscreen on its own,
      // re-target/promote fullscreen to containerRef.current immediately!
      // This ensures Cine-Stream's top bar and menu button stay rendered on top.
      if (isFull && fsElement && fsElement !== containerRef.current && containerRef.current) {
        const retargetToContainer = () => {
          try {
            const container = containerRef.current;
            if (!container) return;
            const req =
              container.requestFullscreen ||
              (container as any).webkitRequestFullscreen ||
              (container as any).mozRequestFullScreen ||
              (container as any).msRequestFullscreen;
            if (req) {
              const p = req.call(container);
              if (p && typeof p.catch === "function") {
                p.catch(() => {});
              }
            }
          } catch {}
        };

        retargetToContainer();
        requestAnimationFrame(retargetToContainer);
        setTimeout(retargetToContainer, 50);
      }

      // Note: Do NOT auto-hide showTopBar on fullscreen! Top bar stays visible so site controls are always accessible.
      broadcastFullscreenState(isFull);
    };

    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      const doc = document as any;
      let data = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          data = { command: data };
        }
      }
      if (!data || typeof data !== "object") return;

      const cmd = (data.megaCommand || data.command || data.event || data.type || data.action || "").toString();

      if (
        cmd === "toggleFullscreen" ||
        cmd === "toggle_fullscreen" ||
        cmd === "fullscreen" ||
        cmd === "requestFullscreen" ||
        cmd === "request_fullscreen" ||
        cmd === "enterFullscreen" ||
        cmd === "enter_fullscreen"
      ) {
        const el = (containerRef.current || document.documentElement) as any;
        const isFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
        if (!isFull || doc.fullscreenElement !== containerRef.current) {
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
          else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
          else if (el.msRequestFullscreen) el.msRequestFullscreen();
        } else if (cmd === "toggleFullscreen" || cmd === "toggle_fullscreen") {
          toggleFullscreen();
        }
      } else if (
        cmd === "exitFullscreen" ||
        cmd === "exit_fullscreen"
      ) {
        if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
          if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
          else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
          else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
          else if (doc.msExitFullscreen) doc.msExitFullscreen();
        }
      } else if (cmd === "getFullscreenState" || data.megaCommand === "getFullscreenState") {
        const isFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
        if (e.source) {
          try {
            (e.source as Window).postMessage(
              { megaFullscreenState: isFull },
              "*"
            );
            (e.source as Window).postMessage(
              JSON.stringify({ megaFullscreenState: isFull }),
              "*"
            );
          } catch {}
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key.toLowerCase() === "m" || e.key.toLowerCase() === "h") {
        e.preventDefault();
        handleToggleTopBar();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleFullscreen, handleTogglePlay, handleToggleTopBar]);



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

  const checkRangeScroll = useCallback(() => {
    if (rangeScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rangeScrollRef.current;
      setCanScrollRangeLeft(scrollLeft > 0);
      setCanScrollRangeRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  const scrollRange = useCallback((direction: "left" | "right") => {
    if (rangeScrollRef.current) {
      const scrollAmount = direction === "left" ? -180 : 180;
      rangeScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const el = rangeScrollRef.current;
    if (el) {
      checkRangeScroll();
      el.addEventListener("scroll", checkRangeScroll);
      window.addEventListener("resize", checkRangeScroll);
      return () => {
        el.removeEventListener("scroll", checkRangeScroll);
        window.removeEventListener("resize", checkRangeScroll);
      };
    }
  }, [checkRangeScroll, showEpisodeCarousel, episodeRanges.length]);

  useEffect(() => {
    if (showEpisodeCarousel && rangeScrollRef.current) {
      const timer = setTimeout(() => {
        const activeBtn = rangeScrollRef.current?.querySelector('[data-active="true"]');
        if (activeBtn) {
          activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showEpisodeCarousel, activeEpisodeRange]);

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



  // Lock body and html scroll so player page perfectly fits screen without overflow
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-cinema-player="true"
      className="fixed inset-0 w-full h-full max-w-none max-h-none bg-black select-none overflow-hidden z-50 font-sans overscroll-none"
      style={{
        width: "100%",
        height: "100%",
        ...(ambientPalette.cssVars as React.CSSProperties),
      }}
    >
      {/* ── Main Streaming Viewport: Fullscreen viewport, never shifts or creates black side bars (Base Layer: z-0) ── */}
      <main
        className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden z-0 pointer-events-auto"
        style={{ width: "100%", height: "100%" }}
      >
        {/* Dynamic Ambient Glow Behind Screen */}
        <div
          className="absolute inset-0 -z-10 blur-3xl opacity-40 pointer-events-none transition-opacity duration-1000"
          style={{
            background: `radial-gradient(ellipse 90% 70% at 50% 50%, var(--ambient-glow, transparent), transparent 75%)`,
          }}
        />

        <div
          key={reloadKey}
          className="absolute inset-0 w-full h-full flex items-center justify-center"
          style={{ width: "100%", height: "100%" }}
        >
          {React.isValidElement(children)
            ? React.cloneElement(children as React.ReactElement<any>, {
                onModeChange: setPlayerMode,
                isPlaying,
                onTogglePlay: setIsPlaying,
              })
            : children}
        </div>

        {/* ── Transparent Source Fullscreen Click Interceptor ──
            Positioned over the bottom-right corner where video players (Megaplay, Vidnest, Embedmaster, etc.)
            render their fullscreen button. Catches clicks with native user activation, triggering container
            fullscreen so Cine-Stream's top bar and menu button are always visible on all sources. */}
        <button
          type="button"
          aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          title={isFullscreen ? "Exit Fullscreen (Press F)" : "Fullscreen (Press F)"}
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="absolute bottom-0 right-0 w-12 h-12 sm:w-14 sm:h-14 z-30 cursor-pointer bg-transparent hover:bg-white/[0.04] active:bg-white/10 transition-colors focus:outline-none touch-manipulation"
        />

        {/* Reloading Source Floating Feedback */}
        {isReloading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-black/90 border border-white/20 backdrop-blur-md text-xs font-bold text-white flex items-center gap-2 shadow-2xl animate-fade-in pointer-events-none">
            <RotateCcw className="w-4 h-4 animate-spin text-primary" />
            <span>Reloading current source...</span>
          </div>
        )}
      </main>

      {/* ── Top Bar: Single Site Control Layer (Floating Overlay on tablet/desktop when showTopBar is true: z-50) ── */}
      {showTopBar && (
        <header className="hidden sm:flex absolute top-0 inset-x-0 h-14 sm:h-16 z-50 px-3 sm:px-6 items-center justify-between bg-zinc-950/85 border-b border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-auto shadow-2xl">
          {/* Left: Back / Exit Button */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={metadata.backUrl}
              className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/15 backdrop-blur-md transition-all shadow-md cursor-pointer shrink-0 group"
              title="Back to Details"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>

          {/* Center: Title & Episode Subtitle & Source Badge */}
          <div className="flex flex-col items-center text-center max-w-[34%] sm:max-w-[48%] truncate px-2">
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

          {/* Right: Site Control Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Episode selection (if TV/Anime with episodes) */}
            {seasons && seasons.length > 0 && (
              <button
                onClick={() => {
                  setShowEpisodeCarousel(!showEpisodeCarousel);
                  setShowServerMenu(false);
                }}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
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

            {/* Sources selection */}
            <button
              onClick={() => {
                setShowServerMenu(!showServerMenu);
                setShowEpisodeCarousel(false);
              }}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                showServerMenu
                  ? "bg-white text-black shadow-lg"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md"
              }`}
              title="Switch Source"
            >
              <Cloud className="w-4 h-4" />
              <span className="hidden md:inline">Sources</span>
            </button>

            {/* Reload Source Button */}
            <button
              onClick={handleReloadSource}
              disabled={isReloading}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md active:scale-95 disabled:opacity-60"
              title="Reload Current Source"
            >
              <RotateCcw className={`w-4 h-4 ${isReloading ? "animate-spin text-primary" : ""}`} />
              <span className="hidden lg:inline">{isReloading ? "Reloading..." : "Reload"}</span>
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md active:scale-95"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* Hide Top Bar Button (Brighter & on the right) */}
            <button
              onClick={handleToggleTopBar}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-lg bg-white/25 hover:bg-white/35 active:scale-95 text-white border border-white/40 hover:border-white/60 backdrop-blur-md hover:shadow-white/10 shrink-0 group"
              title="Hide Top Bar (Press M to toggle)"
            >
              <ChevronUp className="w-4 h-4 text-white drop-shadow group-hover:-translate-y-0.5 transition-transform" />
              <span className="hidden sm:inline text-white font-black tracking-wide">Hide</span>
            </button>
          </div>
        </header>
      )}

      {/* ── Floating Top-Right Menu Button ──
          Mobile: Always visible, toggles controls dropdown
          Desktop: Visible ONLY when top bar is hidden, clicking it restores the top bar fully ── */}
      <div className={`absolute top-3 right-3 z-50 pointer-events-auto ${showTopBar ? "sm:hidden" : ""}`}>
        <button
          data-menu-toggle="true"
          onClick={handleMenuButtonClick}
          className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-zinc-950/85 hover:bg-zinc-900/95 active:scale-95 text-white font-bold text-xs border border-white/20 backdrop-blur-xl shadow-2xl transition-all duration-200 cursor-pointer group hover:ring-2 hover:ring-primary/40 hover:scale-105"
          title={showTopBar ? "Menu" : "Show Controls & Top Bar"}
        >
          {showDropdownMenu ? (
            <X className="w-4 h-4 text-primary" />
          ) : (
            <Menu className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
          )}
          <span className="text-[11px] font-extrabold tracking-wide text-white/90">
            {showDropdownMenu ? "Close" : "Menu"}
          </span>
        </button>

        {/* Floating Dropdown Menu Popover (Mobile Only) */}
        {showDropdownMenu && (
          <div
            ref={dropdownRef}
            className="sm:hidden absolute top-12 right-0 w-72 sm:w-80 max-h-[85vh] overflow-y-auto rounded-2xl bg-zinc-950/95 border border-white/15 backdrop-blur-2xl shadow-2xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 z-50 text-white select-none custom-scrollbar"
          >
            {/* Media Title & Current Info */}
            <div className="px-2.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-black truncate text-white">{metadata.title}</h3>
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[9px] font-black uppercase shrink-0">
                  {activeServer.name || "Source 1"}
                </span>
              </div>
              <p className="text-[10px] text-white/60 font-semibold truncate mt-0.5">
                {isAnime && metadata.episode
                  ? `Episode ${metadata.episode}${metadata.episodeTitle ? ` • ${metadata.episodeTitle}` : ""}`
                  : metadata.season && metadata.episode
                  ? `S${metadata.season} E${metadata.episode}${metadata.episodeTitle ? ` • ${metadata.episodeTitle}` : ""}`
                  : metadata.year || ""}
              </p>
            </div>

            {/* Primary Top Action Buttons: Back & Fullscreen */}
            <div className="grid grid-cols-2 gap-1.5">
              <Link
                href={metadata.backUrl}
                onClick={() => setShowDropdownMenu(false)}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold transition-all border border-white/10 text-white cursor-pointer"
                title="Back to Details"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  toggleFullscreen();
                  setShowDropdownMenu(false);
                }}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold transition-all border border-white/10 text-white cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4 text-amber-400" /> : <Maximize className="w-4 h-4 text-sky-400" />}
                <span>{isFullscreen ? "Exit Full" : "Fullscreen"}</span>
              </button>
            </div>

            {/* Interactive Player Controls */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              {/* Episodes Drawer (if TV/Anime) */}
              {seasons && seasons.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowEpisodeCarousel(true);
                    setShowServerMenu(false);
                    setShowDropdownMenu(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    showEpisodeCarousel
                      ? "bg-white text-black border-white"
                      : "bg-white/10 hover:bg-white/20 text-white border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Episodes</span>
                  </div>
                  <span className="text-[10px] opacity-70">
                    {metadata.season ? `S${metadata.season}` : ""} {metadata.episode ? `Ep ${metadata.episode}` : ""}
                  </span>
                </button>
              )}

              {/* Sources Switcher */}
              <button
                type="button"
                onClick={() => {
                  setShowServerMenu(true);
                  setShowEpisodeCarousel(false);
                  setShowDropdownMenu(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  showServerMenu
                    ? "bg-white text-black border-white"
                    : "bg-white/10 hover:bg-white/20 text-white border-white/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  <span>Sources</span>
                </div>
                <span className="text-[10px] text-primary font-bold">
                  {activeServer.name || "Source 1"}
                </span>
              </button>

              {/* Reload Source */}
              <button
                type="button"
                onClick={() => {
                  handleReloadSource();
                }}
                disabled={isReloading}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold transition-all border border-white/10 text-white cursor-pointer disabled:opacity-60"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className={`w-4 h-4 ${isReloading ? "animate-spin text-primary" : "text-sky-400"}`} />
                  <span>{isReloading ? "Reloading..." : "Reload Player"}</span>
                </div>
                <span className="text-[10px] text-white/50">Refresh</span>
              </button>

            </div>
          </div>
        )}
      </div>

      {/* ── Modal Backdrops ── */}
      {(showEpisodeCarousel || showServerMenu) && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => {
            setShowEpisodeCarousel(false);
            setShowServerMenu(false);
          }}
        />
      )}

      {/* ── Floating Episode Horizontal Carousel ── */}
      {showEpisodeCarousel && seasons && seasons.length > 0 && (
        <div className="fixed top-16 sm:top-18 inset-x-0 z-50 mx-2 sm:mx-8 p-4 sm:p-5 rounded-3xl bg-[#18181b]/95 border border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-fade-in space-y-3 max-h-[calc(100dvh-5rem)] overflow-y-auto">
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => scrollRange("left")}
                    disabled={!canScrollRangeLeft}
                    className={`p-1 rounded-full transition-all flex items-center justify-center shrink-0 ${
                      canScrollRangeLeft ? "bg-white/10 hover:bg-white/20 text-white cursor-pointer" : "text-white/30 cursor-not-allowed"
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div 
                    ref={rangeScrollRef}
                    className="flex items-center gap-1.5 overflow-x-auto max-w-sm sm:max-w-md hide-scrollbar scroll-smooth py-0.5"
                  >
                    {episodeRanges.map((r) => {
                      const isActive = activeEpisodeRange === r.label;
                      return (
                        <button
                          key={r.label}
                          data-active={isActive ? "true" : "false"}
                          onClick={() => setActiveEpisodeRange(r.label)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 transition-all cursor-pointer ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow"
                              : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => scrollRange("right")}
                    disabled={!canScrollRangeRight}
                    className={`p-1 rounded-full transition-all flex items-center justify-center shrink-0 ${
                      canScrollRangeRight ? "bg-white/10 hover:bg-white/20 text-white cursor-pointer" : "text-white/30 cursor-not-allowed"
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
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
                    : `https://image.tmdb.org/t/p/w780${ep.still_path}`
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
                      <CarouselThumbnail
                        thumbUrl={thumbUrl}
                        title={ep.name}
                        episodeNumber={ep.episode_number}
                        isUpcoming={isUpcoming}
                      />

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
        <div className="fixed top-16 sm:top-18 right-3 sm:right-8 z-50 w-72 sm:w-80 max-h-[calc(100dvh-5rem)] overflow-y-auto bg-[#18181b]/95 border border-white/15 rounded-2xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl animate-fade-in space-y-3">
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
    </div>
  );
}
