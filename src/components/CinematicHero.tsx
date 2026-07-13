"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { VolumeX, Volume2, X } from "lucide-react";

interface CinematicHeroProps {
  backdropPath?: string | null;
  trailerId?: string | null;
  fallbackTrailerIds?: string[];
  title: string;
  height?: string;
  theme?: "movie" | "tv" | "anime";
  children: React.ReactNode;
}

/**
 * CinematicHero — starts as a beautiful backdrop image and smoothly fades
 * into a muted YouTube trailer after a 2.5-second delay. The user can toggle
 * the mute/unmute state. Moving to another tab or unmounting cleans up the
 * iframe so no audio/video continues in the background.
 */
export function CinematicHero({
  backdropPath,
  trailerId,
  fallbackTrailerIds = [],
  title,
  height = "h-[62vh] md:h-[75vh]",
  theme = "movie",
  children,
}: CinematicHeroProps) {
  const [activeTrailerId, setActiveTrailerId] = useState<string | null>(null);
  const [trailerReady, setTrailerReady] = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(100);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const fallbackIndexRef = useRef(-1);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isScrubbingRef = useRef(false);

  const themeColorClass = theme === "anime" ? "bg-fuchsia-500" : theme === "tv" ? "bg-emerald-500" : "bg-blue-500";

  const backdropUrl = backdropPath
    ? (backdropPath.startsWith('http') ? backdropPath : `https://image.tmdb.org/t/p/w1280${backdropPath}`)
    : null;

  // Build a youtube-nocookie embed URL that autoplays muted on loop
  // We ONLY build this once, so the iframe never reloads when toggling mute!
  const trailerUrl = React.useMemo(() => {
    if (!trailerId) return null;
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1", // Always start muted
      loop: "0", // Don't loop, so we can detect when it ends and close it
      vq: "hd1080", // Try to force highest quality
      hd: "1", // Hint for HD playback
      controls: "0",
      modestbranding: "1",
      rel: "0",
      showinfo: "0",
      iv_load_policy: "3",
      enablejsapi: "1",
      disablekb: "1",
      fs: "0",
      playsinline: "1",
      origin: typeof window !== "undefined" ? window.location.origin : "",
    });
    return `https://www.youtube-nocookie.com/embed/${trailerId}?${params.toString()}`;
  }, [trailerId]);

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

  // Listen to YouTube API to detect when trailer ends or errors
  useEffect(() => {
    if (!activeTrailerId) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com") return;
      try {
        const data = JSON.parse(event.data);

        // Handle direct errors from YouTube
        if (data.event === "onError" || data.event === "error") {
           triggerFallback();
           return;
        }

        if (data.event === "infoDelivery" && data.info) {
          if (data.info.playerState === 1 && !isPlaying) {
            // Force high quality when playing
            iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
              event: "command",
              func: "setPlaybackQuality",
              args: ["hd1080"]
            }), "*");
            setIsPlaying(true);
          }
          if (data.info.playerState === 0) { // 0 = ENDED
            setTrailerVisible(false);
            setTimeout(() => setTrailerReady(false), 1000);
          }
          if (data.info.currentTime !== undefined && !isScrubbingRef.current) {
            setCurrentTime(data.info.currentTime);
          }
          if (data.info.duration !== undefined) {
            setDuration(data.info.duration);
          }
        }
      } catch (e) {}
    };

    window.addEventListener("message", handleMessage);
    
    // Command the iframe to start sending infoDelivery events
    const pingInterval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({
          event: "listening"
        }), "*");
      }
    }, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(pingInterval);
    };
  }, [activeTrailerId, isPlaying, triggerFallback]);

  // Init trailer id and handle fallbacks
  useEffect(() => {
    if (trailerId) {
      fallbackIndexRef.current = -1;
      setActiveTrailerId(trailerId);
    } else {
      setActiveTrailerId(null);
    }
  }, [trailerId]);

  // Start the trailer after a delay once the component mounts
  useEffect(() => {
    mountedRef.current = true;
    if (!activeTrailerId) return;

    // Wait 1.5s before loading the iframe
    delayTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setTrailerReady(true);
      
      // Start an error timer: if it doesn't play in 6s, it probably failed
      errorTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        triggerFallback();
      }, 6000);
    }, 1500);

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [activeTrailerId]);

  // Once it actually starts playing, clear the error timer and fade it in
  useEffect(() => {
    if (isPlaying) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      // Give it just a tiny bit more time to hide YouTube UI before fading in
      const t = setTimeout(() => {
        if (mountedRef.current) setTrailerVisible(true);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [isPlaying]);

  // Pause when the tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
      } else if (trailerVisible) {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [trailerVisible]);

  // Pause trailer when scrolled completely out of view
  useEffect(() => {
    if (!heroRef.current) return;
    
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
  }, [trailerVisible]);

  const toggleMute = () => {
    if (!iframeRef.current?.contentWindow) return;
    
    // Toggle state
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // Send postMessage to YouTube Iframe API without reloading
    const command = newMutedState ? "mute" : "unMute";
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "*"
    );

    // If unmuting and volume was dragged to 0, restore it to a default
    if (!newMutedState && volume === 0) {
      setVolume(100);
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
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
    setCurrentTime(parseFloat(e.target.value));
  };

  const handleSeekEnd = () => {
    isScrubbingRef.current = false;
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [currentTime, true] }),
        "*"
      );
    }
  };

  const handleSeekStart = () => {
    isScrubbingRef.current = true;
  };

  return (
    <div ref={heroRef} className="relative w-full flex flex-col">
      {/* ── Background layer (Fixed 85svh) ──────────────────────────────────────── */}
      <div className={`absolute top-0 left-0 w-full ${height} min-h-[85svh] overflow-hidden z-0`}>
        {/* Backdrop image — always visible, fades out once trailer plays */}
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt={title}
            className={`w-full h-full object-cover object-center md:object-top scale-[1.03] transition-opacity duration-1000 ${
              trailerVisible ? "opacity-0" : "opacity-100"
            }`}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        )}

        {/* YouTube trailer iframe — hidden behind backdrop until ready */}
        {trailerReady && activeTrailerId && (
          <div
            className={`absolute inset-0 transition-opacity duration-1000 ${
              trailerVisible ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          >
            {/* Aspect-ratio cover trick to ensure video fills screen on mobile without letterboxing.
                Calculated to perfectly object-cover the container in 16:9. */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <iframe
                ref={iframeRef}
                src={`https://www.youtube-nocookie.com/embed/${activeTrailerId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&widgetid=1&loop=0&vq=hd1080&hd=1`}
                className="absolute top-1/2 left-1/2 w-[100vw] h-[56.25vw] min-h-[85svh] min-w-[151.11svh] -translate-x-1/2 -translate-y-1/2"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen={false}
                title={`${title} Trailer`}
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ border: "none" }}
              />
            </div>
          </div>
        )}

        {/* Gradient overlays — kept mostly opaque so text remains readable and blending works! */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${trailerVisible ? "opacity-0" : "opacity-100"} bg-gradient-to-t from-background via-background/60 to-transparent z-10`} />
        <div className={`absolute inset-0 transition-opacity duration-1000 ${trailerVisible ? "opacity-0" : "opacity-100"} bg-gradient-to-r from-background/90 via-background/40 to-transparent z-10`} />
        {/* Deep bottom blend — very tall gradient for a seamless transition into the page */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/95 to-transparent z-10" />
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background/60 to-transparent z-10" />
      </div>

      {/* ── Trailer Controls (shown only when trailer is playing) ────── */}
      {activeTrailerId && trailerVisible && (
        <>
        <div className="absolute top-[calc(85svh-4rem)] md:top-[calc(85svh-4.5rem)] right-4 md:right-6 z-30 flex items-center gap-3">
          
          {/* Stop Trailer Button */}
          <button
            onClick={() => {
              setTrailerVisible(false);
              setTimeout(() => setTrailerReady(false), 1000);
            }}
            className="flex items-center bg-black/70 backdrop-blur-md border border-white/30 rounded-full hover:bg-red-500/80 hover:border-red-400/50 transition-all duration-300 shadow-lg px-3 h-10"
            title="Stop trailer"
          >
            <X className="w-4 h-4 text-white shrink-0" />
            <span className="text-white text-xs font-bold whitespace-nowrap ml-1.5">
              Stop
            </span>
          </button>

          {/* Audio Controls */}
          <div className="flex items-center bg-black/70 backdrop-blur-md border border-white/30 rounded-full hover:bg-black/80 transition-all duration-300 shadow-lg px-3 gap-2">
            {/* Volume slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary outline-none"
            />

            {/* Mute button */}
            <button
              onClick={toggleMute}
              className="w-8 h-8 flex items-center justify-center text-white shrink-0 rounded-full hover:text-primary transition-colors duration-200"
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

        {/* Playback Progress Slider */}
        <div className="absolute top-[calc(85svh-1.5rem)] md:top-[calc(85svh-2rem)] left-1/2 -translate-x-1/2 w-[90%] md:w-1/2 z-30 flex items-center gap-3">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3">
            <span className="text-white/90 text-xs md:text-sm font-black uppercase tracking-[0.2em] bg-black/60 backdrop-blur-md px-3 py-1 rounded-md border border-white/20 shadow-lg">Trailer</span>
          </div>
          <div className="relative flex-1 group/slider flex items-center h-6 cursor-pointer">
            <div className="relative w-full h-1 group-hover/slider:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              <div 
                className={`absolute top-0 left-0 h-full ${themeColorClass} transition-all duration-75`} 
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onMouseUp={handleSeekEnd}
              onTouchEnd={handleSeekEnd}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
        </>
      )}

      {/* ── Content Wrapper ────── */}
      <div className="relative z-20 w-full min-h-[85svh] flex items-end pt-[20svh]">
        <div className={`w-full transition-opacity duration-1000 ${trailerVisible && isAtTop ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
