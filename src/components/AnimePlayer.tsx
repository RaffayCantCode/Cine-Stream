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
  malId?: string | null;
  animeTitle: string;
  episode: number;
  onAutoNext?: () => void;
}

function buildSources(animeId: string, malId: string | null | undefined, episode: number): Source[] {
  const numericId = animeId.replace(/\D/g, "");
  const activeMalId = malId ? malId.trim() : numericId;
  const sources: Source[] = [];

  // AnimePahe (Primary - MAL ID)
  sources.push({
    name: "AnimePahe (Primary)",
    url: `https://vidnest.fun/animepahe/${activeMalId}/${episode}/sub?quality=1080`,
    color: "from-[#462C7D]/30 to-[#831C91]/20",
  });

  // AnimePahe (Backup - AniList ID, if different)
  if (activeMalId !== numericId) {
    sources.push({
      name: "AnimePahe (Backup)",
      url: `https://vidnest.fun/animepahe/${numericId}/${episode}/sub?quality=1080`,
      color: "from-[#462C7D]/25 to-[#831C91]/15",
    });
  }

  // GogoAnime (Primary - MAL ID)
  sources.push({
    name: "GogoAnime (Primary)",
    url: `https://vidnest.fun/gogoanime/${activeMalId}/${episode}/sub`,
    color: "from-[#1e293b]/40 to-[#0f172a]/20",
  });

  // GogoAnime (Backup - AniList ID, if different)
  if (activeMalId !== numericId) {
    sources.push({
      name: "GogoAnime (Backup)",
      url: `https://vidnest.fun/gogoanime/${numericId}/${episode}/sub`,
      color: "from-[#1e293b]/30 to-[#0f172a]/15",
    });
  }

  // VidLink (Sub - MAL ID)
  sources.push({
    name: "VidLink (Sub)",
    url: `https://vidlink.pro/anime/${activeMalId}/${episode}/sub`,
    color: "from-[#312e81]/40 to-[#4f46e5]/20",
  });

  // VidNest (Primary - MAL ID)
  sources.push({
    name: "VidNest (Primary)",
    url: `https://vidnest.fun/anime/${activeMalId}/${episode}/sub`,
    color: "from-[#831C91]/30 to-[#D552A3]/20",
  });

  // VidNest (Backup - AniList ID, if different)
  if (activeMalId !== numericId) {
    sources.push({
      name: "VidNest (Backup)",
      url: `https://vidnest.fun/anime/${numericId}/${episode}/sub`,
      color: "from-[#831C91]/20 to-[#D552A3]/10",
    });
  }

  return sources;
}

export function AnimePlayer({ animeId, malId, animeTitle, episode, onAutoNext }: AnimePlayerProps) {
  const sources = buildSources(animeId, malId, episode);
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

  const switchSource = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const next = (sourceIndex + 1) % sources.length;
    setSourceIndex(next);
    setIsLoading(true);
    setHasError(false);
  }, [sourceIndex, sources.length]);

  // Auto-switch source if iframe takes too long (7s timeout)
  useEffect(() => {
    if (!isLoading || hasError) return;
    timerRef.current = setTimeout(() => {
      if (isLoading && !hasError) {
        switchSource();
      }
    }, 7000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isLoading, hasError, sourceIndex, switchSource]);

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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10">
            <span className="text-xs font-bold text-white/85">Playing: {currentSource.name}</span>
          </div>
          {hasError && (
            <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-lg font-bold">
              Failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={switchSource} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all" title="Next source">
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

      {/* CLEAR SOURCES SELECTOR BOX */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#D552A3]" />
            <span className="text-xs font-semibold text-white/90">Select Streaming Server</span>
          </div>
          <span className="text-[10px] text-white/45 font-medium">
            If stream fails, buffers, or does not play, click another server below
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sources.map((source, index) => {
            const isActive = sourceIndex === index;
            return (
              <button
                key={source.name}
                onClick={() => {
                  setSourceIndex(index);
                  setIsLoading(true);
                  setHasError(false);
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-xs font-medium ${
                  isActive
                    ? `bg-gradient-to-r ${source.color} border-[#D552A3]/30 text-white shadow-lg shadow-[#D552A3]/5`
                    : "bg-white/[0.04] hover:bg-white/[0.08] border-white/5 hover:border-white/10 text-white/70 hover:text-white"
                }`}
              >
                <span className="truncate">{source.name}</span>
                {isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D552A3] animate-pulse shrink-0 ml-1.5" />
                ) : (
                  source.name.includes("AnimePahe") && (
                    <span className="text-[9px] font-bold text-[#D552A3] uppercase shrink-0 ml-1.5">1080p</span>
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-white/20">
        <span>Japanese / English audio with English subtitles</span>
        <button onClick={switchSource} className="text-white/30 hover:text-[#D552A3] transition-colors">
          Next Source ({sources[(sourceIndex + 1) % sources.length].name})
        </button>
      </div>
    </div>
  );
}
