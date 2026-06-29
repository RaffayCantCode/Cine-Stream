"use client";

import React, { useState, useEffect, useRef } from "react";
import { VolumeX, Volume2 } from "lucide-react";

interface CinematicHeroProps {
  backdropPath?: string | null;
  trailerId?: string | null;
  title: string;
  height?: string;
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
  title,
  height = "h-[62vh] md:h-[75vh]",
  children,
}: CinematicHeroProps) {
  const [trailerReady, setTrailerReady] = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mountedRef = useRef(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const backdropUrl = backdropPath
    ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
    : null;

  // Build a youtube-nocookie embed URL that autoplays muted on loop
  // We ONLY build this once, so the iframe never reloads when toggling mute!
  const trailerUrl = React.useMemo(() => {
    if (!trailerId) return null;
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1", // Always start muted
      loop: "1",
      controls: "0",
      modestbranding: "1",
      rel: "0",
      showinfo: "0",
      iv_load_policy: "3",
      playlist: trailerId,
      enablejsapi: "1",
      disablekb: "1",
      fs: "0",
      playsinline: "1",
      origin: typeof window !== "undefined" ? window.location.origin : "",
    });
    return `https://www.youtube-nocookie.com/embed/${trailerId}?${params.toString()}`;
  }, [trailerId]);

  // Start the trailer after a delay once the component mounts
  useEffect(() => {
    mountedRef.current = true;
    if (!trailerId) return;

    // Wait 1.5s before showing the trailer
    delayTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setTrailerReady(true);
      // Then give the iframe ~0.5s to buffer before starting the crossfade
      fadeTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setTrailerVisible(true);
      }, 500);
    }, 1500);

    return () => {
      mountedRef.current = false;
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [trailerId]);

  // When the trailer prop changes (e.g. season switch), reset and restart
  useEffect(() => {
    setTrailerReady(false);
    setTrailerVisible(false);

    if (!trailerId) return;
    const t1 = setTimeout(() => {
      if (!mountedRef.current) return;
      setTrailerReady(true);
      const t2 = setTimeout(() => {
        if (!mountedRef.current) return;
        setTrailerVisible(true);
      }, 500);
      fadeTimerRef.current = t2;
    }, 1500);
    delayTimerRef.current = t1;
  }, [trailerId]);

  // Pause when the tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTrailerVisible(false);
      } else if (trailerId) {
        setTrailerVisible(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [trailerId]);

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
  };

  return (
    <div className="relative w-full flex flex-col">
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
        {trailerId && trailerReady && trailerUrl && (
          <div
            className={`absolute inset-0 transition-opacity duration-1000 ${
              trailerVisible ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          >
            {/* Aspect-ratio cover trick to ensure video fills screen on mobile without letterboxing.
                Calculated to perfectly object-cover the 85svh container in 16:9, then scaled up by 1.35x 
                and shifted up slightly (-52%) to hide YouTube's top UI buttons (Watch Later, Share, etc.) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <iframe
                ref={iframeRef}
                src={trailerUrl}
                className="absolute top-1/2 left-1/2 w-[max(135vw,205svh)] h-[max(76vw,115svh)] -translate-x-1/2 -translate-y-[52%]"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen={false}
                title={`${title} Trailer`}
                referrerPolicy="strict-origin-when-cross-origin"
                style={{ border: "none" }}
              />
            </div>
          </div>
        )}

        {/* Gradient overlays — same on both backdrop and trailer */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${trailerVisible ? "opacity-0" : "bg-gradient-to-t from-background via-background/80 to-black/10 opacity-100"} z-10`} />
        <div className={`absolute inset-0 transition-opacity duration-1000 ${trailerVisible ? "opacity-0" : "bg-gradient-to-r from-background/90 via-background/40 to-transparent opacity-100"} z-10`} />
        <div className={`absolute inset-x-0 bottom-0 h-40 transition-opacity duration-1000 ${trailerVisible ? "bg-gradient-to-t from-background to-transparent opacity-100" : "opacity-0"} z-10`} />
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background/60 to-transparent z-10" />
      </div>

      {/* ── Mute toggle (shown only when trailer is playing) ────── */}
      {trailerId && trailerVisible && (
        <button
          onClick={toggleMute}
          className="absolute top-[calc(85svh-4rem)] md:top-[calc(85svh-4.5rem)] right-4 md:right-6 z-30 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition-all duration-200"
          title={isMuted ? "Unmute trailer" : "Mute trailer"}
          aria-label={isMuted ? "Unmute trailer" : "Mute trailer"}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      )}

      {/* ── Content Wrapper (Pushes down when trailer plays) ────── */}
      <div 
        className={`relative z-20 w-full transition-all duration-1000 ease-out flex items-end ${
          trailerVisible ? "pt-[85svh]" : "min-h-[85svh] pt-[20svh]"
        }`}
      >
        <div className={`w-full transition-opacity duration-1000 ${trailerVisible ? "opacity-70 hover:opacity-100" : "opacity-100"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
