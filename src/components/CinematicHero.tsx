"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { VolumeX, Volume2, X, Play, Pause, Film } from "lucide-react";

export const CinematicHeroContext = React.createContext<{ playTrailer: () => void; hasTrailer: boolean }>({
  playTrailer: () => {},
  hasTrailer: false,
});

export const useCinematicHero = () => React.useContext(CinematicHeroContext);

interface CinematicHeroProps {
  backdropPath?: string | null;
  trailerId?: string | null;
  fallbackTrailerIds?: string[];
  title: string;
  height?: string;
  theme?: "movie" | "tv" | "anime";
  children: React.ReactNode;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * CinematicHero — starts as a beautiful backdrop image. On desktop, clicking the Trailer
 * button unmutes and plays the background video hero. On mobile, auto-play is disabled
 * and clicking Trailer opens a clean 16:9 fullscreen video modal.
 */
export function CinematicHero({
  backdropPath,
  trailerId,
  fallbackTrailerIds = [],
  title,
  height = "min-h-[560px] sm:min-h-[600px] md:h-[75vh] md:min-h-[540px]",
  theme = "movie",
  children,
}: CinematicHeroProps) {
  const [activeTrailerId, setActiveTrailerId] = useState<string | null>(null);
  const [trailerReady, setTrailerReady] = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackIndexRef = useRef(-1);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isScrubbingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastTimeReceivedAtRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Sync ref with currentTime state
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (!isScrubbingRef.current) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (!isScrubbingRef.current) {
      setShowControls(false);
    }
  }, []);

  const themeColorClass = theme === "anime" ? "bg-fuchsia-500" : theme === "tv" ? "bg-emerald-500" : "bg-blue-500";

  const backdropUrl = backdropPath
    ? (backdropPath.startsWith('http') ? backdropPath : `https://image.tmdb.org/t/p/w1280${backdropPath}`)
    : null;

  // Detect mobile viewport (width < 768px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile, { passive: true });
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const playTrailer = useCallback(() => {
    if (!activeTrailerId) return;
    if (isMobile) {
      setShowTrailerModal(true);
    } else {
      setTrailerReady(true);
      setTrailerVisible(true);
      setIsMuted(false);
      const startVolume = 50;
      setVolume(startVolume);
      const sendUnmute = () => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [startVolume] }), "*");
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
        }
      };
      sendUnmute();
      setTimeout(sendUnmute, 300);
      setTimeout(sendUnmute, 800);
    }
  }, [activeTrailerId, isMobile]);

  // Track scroll position for scroll anchoring
  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY < 100);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const triggerFallback = useCallback(() => {
    fallbackIndexRef.current += 1;
    if (fallbackIndexRef.current < fallbackTrailerIds.length) {
      setTrailerReady(false);
      setIsPlaying(false);
      setTrailerVisible(false);
      setTimeout(() => setActiveTrailerId(fallbackTrailerIds[fallbackIndexRef.current]), 100);
    } else {
      setTrailerReady(false);
      setIsPlaying(false);
      setTrailerVisible(false);
    }
  }, [fallbackTrailerIds]);

  // Smooth 60fps real-time progress bar ticker when playing
  useEffect(() => {
    if (!isPlaying || isScrubbingRef.current || !trailerVisible) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const tick = () => {
      if (lastTimeReceivedAtRef.current > 0 && !isScrubbingRef.current) {
        const elapsed = (performance.now() - lastTimeReceivedAtRef.current) / 1000;
        const estimated = lastTimeRef.current + elapsed;
        if (duration > 0 && estimated >= duration) {
          setCurrentTime(duration);
        } else {
          setCurrentTime(Math.max(0, estimated));
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, trailerVisible, duration]);

  // Listen to YouTube API postMessage events & poll time/duration
  useEffect(() => {
    if (!activeTrailerId || isMobile) return;

    const handleMessage = (event: MessageEvent) => {
      // Validate origin safely for YouTube domains
      if (!event.origin.includes("youtube.com") && !event.origin.includes("youtube-nocookie.com")) return;

      try {
        let data = event.data;
        if (typeof data === "string") {
          data = JSON.parse(data);
        }
        if (!data || typeof data !== "object") return;

        // Handle direct errors from YouTube
        if (data.event === "onError" || data.event === "error") {
          triggerFallback();
          return;
        }

        if (data.event === "infoDelivery" && data.info) {
          const info = data.info;

          if (info.playerState !== undefined) {
            if (info.playerState === 1) { // 1 = PLAYING
              setIsPlaying(true);
              // Force high quality when playing starts
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
                event: "command",
                func: "setPlaybackQuality",
                args: ["hd1080"]
              }), "*");
            } else if (info.playerState === 2) { // 2 = PAUSED
              setIsPlaying(false);
            } else if (info.playerState === 0) { // 0 = ENDED
              setIsPlaying(false);
              setTrailerVisible(false);
              setCurrentTime(0);
              lastTimeRef.current = 0;
              lastTimeReceivedAtRef.current = 0;
              setTimeout(() => setTrailerReady(false), 1000);
            }
          }

          if (info.currentTime !== undefined && typeof info.currentTime === "number") {
            lastTimeRef.current = info.currentTime;
            lastTimeReceivedAtRef.current = performance.now();
            if (!isScrubbingRef.current && !isPlaying) {
              setCurrentTime(info.currentTime);
            }
          }
          if (info.duration !== undefined && typeof info.duration === "number" && info.duration > 0) {
            setDuration(info.duration);
          }
        }
      } catch (e) {}
    };

    window.addEventListener("message", handleMessage);

    // Periodically poll player state, time and duration from YouTube iframe
    const pollInterval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: "listening",
          id: 1
        }), "*");
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: "command",
          func: "getCurrentTime",
          args: []
        }), "*");
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: "command",
          func: "getDuration",
          args: []
        }), "*");
      }
    }, 250);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(pollInterval);
    };
  }, [activeTrailerId, triggerFallback, isMobile, isPlaying]);

  // Handle global mouseup / touchend for scrubbing
  useEffect(() => {
    const handleGlobalSeekEnd = () => {
      if (isScrubbingRef.current) {
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [currentTimeRef.current, true] }),
            "*"
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "playVideo", args: [] }),
            "*"
          );
        }
      }
    };

    window.addEventListener("mouseup", handleGlobalSeekEnd);
    window.addEventListener("touchend", handleGlobalSeekEnd);
    return () => {
      window.removeEventListener("mouseup", handleGlobalSeekEnd);
      window.removeEventListener("touchend", handleGlobalSeekEnd);
    };
  }, []);

  // Init trailer id and handle fallbacks
  useEffect(() => {
    if (trailerId) {
      fallbackIndexRef.current = -1;
      setActiveTrailerId(trailerId);
    } else {
      setActiveTrailerId(null);
    }
  }, [trailerId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Pause when the tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
      } else if (trailerVisible && !isMobile) {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [trailerVisible, isMobile]);

  // Pause trailer when scrolled completely out of view
  useEffect(() => {
    if (!heroRef.current || isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!iframeRef.current?.contentWindow) return;

        if (entry.isIntersecting) {
          if (trailerVisible) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
          }
        } else {
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
        }
      },
      { threshold: 0 }
    );

    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, [trailerVisible, isMobile]);

  const togglePlayPause = () => {
    if (!iframeRef.current?.contentWindow) return;
    if (isPlaying) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
        "*"
      );
      setIsPlaying(false);
    } else {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "*"
      );
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!iframeRef.current?.contentWindow) return;
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    const command = newMutedState ? "mute" : "unMute";
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "*"
    );

    if (!newMutedState && volume === 0) {
      setVolume(50);
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [50] }),
        "*"
      );
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [newVol] }),
        "*"
      );

      if (newVol === 0 && !isMuted) {
        setIsMuted(true);
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "mute", args: [] }),
          "*"
        );
      } else if (newVol > 0 && isMuted) {
        setIsMuted(false);
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "unMute", args: [] }),
          "*"
        );
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (!isScrubbingRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [val, true] }),
        "*"
      );
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "*"
      );
    }
  };

  const handleSeekStart = () => {
    isScrubbingRef.current = true;
    setIsScrubbing(true);
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div ref={heroRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="relative w-full flex flex-col">
      {/* ── Background layer ──────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden z-0">
        {/* Backdrop image — visible when trailer is not visible */}
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt={title}
            className={`w-full h-full object-cover object-center md:object-top scale-[1.03] transition-opacity duration-1000 ${
              trailerVisible && !isMobile ? "opacity-0" : "opacity-100"
            }`}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        )}

        {/* YouTube background trailer iframe (DESKTOP ONLY) */}
        {!isMobile && trailerReady && activeTrailerId && (
          <div
            className={`absolute inset-0 transition-opacity duration-1000 ${
              trailerVisible ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <iframe
                ref={iframeRef}
                src={`https://www.youtube-nocookie.com/embed/${activeTrailerId}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}&widgetid=1&loop=0&vq=hd1080&hd=1`}
                className="absolute top-1/2 left-1/2 w-[100vw] h-[56.25vw] min-h-full min-w-[177.78%] -translate-x-1/2 -translate-y-1/2"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen={false}
                title={`${title} Trailer`}
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ border: "none" }}
              />
            </div>
          </div>
        )}

        {/* Gradient overlays */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${trailerVisible && !isMobile ? "opacity-0" : "opacity-100"} bg-gradient-to-t from-background via-background/60 to-transparent z-10`} />
        <div className={`absolute inset-0 transition-opacity duration-1000 ${trailerVisible && !isMobile ? "opacity-0" : "opacity-100"} bg-gradient-to-r from-background/90 via-background/40 to-transparent z-10`} />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/95 to-transparent z-10" />
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background/60 to-transparent z-10" />
      </div>

      {/* ── Fullscreen Video Modal for Mobile / Direct Trailer Click ───── */}
      {showTrailerModal && activeTrailerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-fadeIn">
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <button
              onClick={() => setShowTrailerModal(false)}
              className="absolute top-3 right-3 z-50 bg-black/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors border border-white/20 shadow-lg"
              aria-label="Close Trailer"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${activeTrailerId}?autoplay=1&mute=0&controls=1&rel=0&playsinline=1`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${title} Trailer`}
            />
          </div>
        </div>
      )}

      {/* ── Background Desktop Trailer Controls (shown only when playing on desktop) ────── */}
      {!isMobile && activeTrailerId && trailerVisible && (
        <div className={`transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          {/* Top right / middle controls for Stop, Volume */}
          <div className={`absolute bottom-16 md:bottom-20 right-4 md:right-6 z-30 flex items-center gap-3 transition-opacity duration-300 ${isScrubbing ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            {/* Stop Button */}
            <button
              onClick={() => {
                setTrailerVisible(false);
                setIsMuted(true);
                setIsPlaying(false);
                setCurrentTime(0);
                setTimeout(() => setTrailerReady(false), 500);
              }}
              className="flex items-center bg-black/70 backdrop-blur-md border border-white/30 rounded-full hover:bg-red-500/80 hover:border-red-400/50 transition-all duration-300 shadow-lg px-3 h-10"
              title="Stop trailer"
            >
              <X className="w-4 h-4 text-white shrink-0" />
              <span className="text-white text-xs font-bold whitespace-nowrap ml-1.5">
                Stop
              </span>
            </button>

            {/* Volume Control */}
            <div className="flex items-center bg-black/70 backdrop-blur-md border border-white/30 rounded-full hover:bg-black/80 transition-all duration-300 shadow-lg px-3 gap-2 h-10">
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary outline-none"
              />
              <button
                onClick={toggleMute}
                className="w-7 h-7 flex items-center justify-center text-white shrink-0 rounded-full hover:text-primary transition-colors duration-200"
                title={isMuted ? "Unmute trailer" : "Mute trailer"}
                aria-label={isMuted ? "Unmute trailer" : "Mute trailer"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Bottom Progress Bar & Time Display */}
          <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 w-[92%] md:w-3/4 max-w-3xl z-30 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 shadow-2xl">
            {/* Play/Pause icon indicator */}
            <button
              onClick={togglePlayPause}
              className="text-white/80 hover:text-white transition-colors shrink-0"
              aria-label={isPlaying ? "Pause trailer" : "Play trailer"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            {/* Time readout */}
            <span className="text-white/80 font-mono text-xs shrink-0 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Progress Slider */}
            <div className="relative flex-1 group/slider flex items-center h-5 cursor-pointer">
              <div className="relative w-full h-1.5 group-hover/slider:h-2 bg-white/20 rounded-full overflow-hidden transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                <div
                  className={`absolute top-0 left-0 h-full ${themeColorClass} transition-all duration-75`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 100}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>

            {/* Trailer Badge */}
            <span className="text-white/90 text-[10px] md:text-xs font-black uppercase tracking-[0.15em] bg-white/10 px-2 py-0.5 rounded border border-white/20 shrink-0 select-none">
              Trailer
            </span>
          </div>
        </div>
      )}

      {/* ── Content Wrapper ────── */}
      <CinematicHeroContext.Provider value={{ playTrailer, hasTrailer: Boolean(activeTrailerId) }}>
        <div className={`relative z-20 w-full ${height} flex flex-col justify-end pt-20 sm:pt-24 md:pt-16 pb-6 md:pb-8`}>
          <div className={`w-full transition-opacity duration-1000 ${trailerVisible && isAtTop && !isMobile ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            {children}
          </div>
        </div>
      </CinematicHeroContext.Provider>
    </div>
  );
}

