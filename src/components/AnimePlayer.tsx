"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Server, Maximize2, Minimize2, Info, Play } from "lucide-react";

interface AnimePlayerProps {
  animeId: string;
  animeTitle: string;
  episode: number;
  onAutoNext?: () => void;
}

export function AnimePlayer({ animeId, animeTitle, episode, onAutoNext }: AnimePlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const numericId = animeId.replace(/\D/g, "");
  const embedUrl = `https://vidnest.fun/animepahe/${numericId}/${episode}/sub`;

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [episode]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#462C7D]/30 to-[#831C91]/20 border border-[#D552A3]/20">
            <Server className="w-3.5 h-3.5 text-[#D552A3]" />
            <span className="text-xs font-bold text-white/80">AnimePahe</span>
            <span className="text-[9px] font-extrabold text-[#D552A3] uppercase tracking-widest ml-1">1080p</span>
          </div>
          {hasError && (
            <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-lg font-bold">
              Failed to load
            </span>
          )}
        </div>
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <motion.div
        ref={playerRef}
        key={episode}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-2 ring-white/10 relative"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-white/10 border-t-[#D552A3] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/50 text-sm font-medium">Loading player...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={`${animeTitle} - Episode ${episode}`}
          onLoad={() => { setIsLoading(false); setHasError(false); }}
          onError={() => { setHasError(true); setIsLoading(false); }}
        />
      </motion.div>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/20">
        <Info className="w-2.5 h-2.5" />
        <span>Japanese audio with English subtitles</span>
      </div>
    </div>
  );
}
