"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Server, Maximize2, Info, RotateCcw } from "lucide-react";

interface Source {
  name: string;
  url: string;
  color: string;
}

interface AnimePlayerProps {
  animeId: string;
  animeTitle: string;
  episode: number;
  onAutoNext?: () => void;
}

function buildSources(animeId: string, episode: number): Source[] {
  const numericId = animeId.replace(/\D/g, "");
  return [
    {
      name: "AnimePahe",
      url: `https://vidnest.fun/animepahe/${numericId}/${episode}/sub`,
      color: "from-[#462C7D]/30 to-[#831C91]/20",
    },
    {
      name: "VidNest",
      url: `https://vidnest.fun/anime/${numericId}/${episode}/sub`,
      color: "from-[#831C91]/30 to-[#D552A3]/20",
    },
  ];
}

export function AnimePlayer({ animeId, animeTitle, episode, onAutoNext }: AnimePlayerProps) {
  const sources = buildSources(animeId, episode);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSource = sources[sourceIndex];

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setSourceIndex(0);
  }, [episode]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

  // Auto-switch source if iframe takes too long (15s timeout)
  useEffect(() => {
    if (!isLoading || hasError) return;
    timerRef.current = setTimeout(() => {
      if (isLoading && !hasError) {
        switchSource();
      }
    }, 15000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isLoading, hasError, sourceIndex]);

  const switchSource = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const next = (sourceIndex + 1) % sources.length;
    setSourceIndex(next);
    setIsLoading(true);
    setHasError(false);
  }, [sourceIndex, sources.length]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (iframeRef.current?.requestFullscreen) {
          await iframeRef.current.requestFullscreen();
        } else if (playerRef.current?.requestFullscreen) {
          await playerRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={switchSource}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${currentSource.color} border border-[#D552A3]/20 hover:opacity-80 transition-opacity`}
            title="Switch source"
          >
            <Server className="w-3.5 h-3.5 text-[#D552A3]" />
            <span className="text-xs font-bold text-white/80">{currentSource.name}</span>
            <span className="text-[9px] font-extrabold text-[#D552A3] uppercase tracking-widest ml-1">1080p</span>
          </button>
          {hasError && (
            <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-lg font-bold">
              Failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={switchSource} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all" title="Switch source">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <motion.div
        ref={playerRef}
        key={`${episode}-${sourceIndex}`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-2 ring-white/10 relative"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-white/10 border-t-[#D552A3] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/50 text-sm font-medium">Loading {currentSource.name}...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={currentSource.url}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={`${animeTitle} - Episode ${episode}`}
          onLoad={() => { setIsLoading(false); setHasError(false); if (timerRef.current) clearTimeout(timerRef.current); }}
          onError={() => { setHasError(true); setIsLoading(false); if (timerRef.current) clearTimeout(timerRef.current); }}
        />
      </motion.div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-white/20">
        <span>Japanese audio with English subtitles</span>
        <button onClick={switchSource} className="text-white/30 hover:text-[#D552A3] transition-colors">
          {sourceIndex === 0 ? "Switch to VidNest" : "Switch to AnimePahe"}
        </button>
      </div>
    </div>
  );
}
