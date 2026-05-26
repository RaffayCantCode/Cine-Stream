"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, Server, Maximize2, ChevronRight, RotateCcw, Loader2 } from "lucide-react";
import { StreamingSource, getStreamingSources } from "@/lib/streaming-fetch";

interface VideoPlayerProps {
  type: "movie" | "tv";
  id: number;
  season?: number;
  episode?: number;
  title?: string;
}

const SOURCE_STYLES: Record<string, { bg: string; badge: string }> = {
  cinesrc: { bg: "bg-[#831C91]", badge: "bg-[#831C91]/20 text-[#D552A3]" },
  vidsrcmov: { bg: "bg-cyan-600", badge: "bg-cyan-500/20 text-cyan-300" },
  vidking: { bg: "bg-fuchsia-600", badge: "bg-fuchsia-500/20 text-fuchsia-300" },
  vidlink: { bg: "bg-emerald-600", badge: "bg-emerald-500/20 text-emerald-300" },
  "2embed": { bg: "bg-amber-600", badge: "bg-amber-500/20 text-amber-300" },
  autoembed: { bg: "bg-blue-600", badge: "bg-blue-500/20 text-blue-300" },
};

export function VideoPlayer({ type, id, season, episode, title }: VideoPlayerProps) {
  const sources = useMemo(() => getStreamingSources(type, id, season, episode), [type, id, season, episode]);
  const [currentSource, setCurrentSource] = useState<StreamingSource>(sources[0]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentStyle = SOURCE_STYLES[currentSource?.type] || SOURCE_STYLES.cinesrc;

  useEffect(() => {
    setCurrentSource(sources[0]);
    setError(null);
    setIsLoading(true);
  }, [sources]);

  const handleSourceChange = (source: StreamingSource) => {
    setCurrentSource(source);
    setError(null);
    setIsLoading(true);
    setShowSources(false);
  };

  const handleIframeError = () => {
    const currentIndex = sources.findIndex((s) => s.name === currentSource.name);
    const nextSource = sources[currentIndex + 1];
    if (nextSource) {
      setError(`${currentSource.name} failed, trying ${nextSource.name}...`);
      setTimeout(() => {
        setCurrentSource(nextSource);
        setError(null);
      }, 1200);
    } else {
      setError("All streaming sources failed. Please try again later.");
    }
  };

  const requestFullscreen = async () => {
    const iframe = iframeRef.current;
    if (iframe?.requestFullscreen) {
      try { await iframe.requestFullscreen(); return; } catch { }
    }
    const el = playerContainerRef.current;
    if (!el) return;
    const anyEl = el as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    try {
      if (el.requestFullscreen) { await el.requestFullscreen(); }
      else if (anyEl.webkitRequestFullscreen) { anyEl.webkitRequestFullscreen(); }
      else if (anyEl.msRequestFullscreen) { anyEl.msRequestFullscreen(); }
    } catch {
      setError("Fullscreen was blocked. Use the player's built-in fullscreen button inside the video.");
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/40 font-medium uppercase tracking-wider hidden sm:inline">Source:</span>
          <button
            onClick={() => setShowSources(!showSources)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${currentStyle.bg} text-white text-xs font-bold transition-all hover:opacity-90 shadow-lg`}
          >
            <Server className="w-4 h-4" />
            {currentSource?.name || "Select Source"}
            <ChevronRight className={`w-4 h-4 transition-transform ${showSources ? "rotate-90" : ""}`} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setError(null); setCurrentSource(sources[0]); setIsLoading(true); }}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all"
            title="Retry"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={requestFullscreen}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSources && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/10 shadow-2xl"
          >
            {sources.map((source) => {
              const isActive = currentSource?.name === source.name;
              const sc = SOURCE_STYLES[source.type] || SOURCE_STYLES.cinesrc;
              return (
                <button
                  key={source.name}
                  onClick={() => handleSourceChange(source)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? `${sc.bg} text-white shadow-lg`
                      : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                  }`}
                >
                  <Server className={`w-4 h-4 shrink-0 ${isActive ? "" : "text-white/30"}`} />
                  <span className="flex-1 text-left">{source.name}</span>
                  {isActive && !isLoading && !error && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                  {isActive && isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        key={currentSource.url}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        ref={playerContainerRef}
        className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-1 ring-white/10 relative"
      >
        {error && !error.includes("trying") ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black">
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-400/60" />
              </div>
              <p className="text-white/60 text-sm mb-5 font-medium">{error}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { setError(null); setCurrentSource(sources[0]); }}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Try Again
                </button>
                <button
                  onClick={() => setShowSources(true)}
                  className="px-5 py-2.5 bg-[#831C91] hover:bg-[#831C91] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Server className="w-4 h-4" /> Change Source
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <div className="text-center">
                  <div className="w-14 h-14 border-4 border-white/10 border-t-[#831C91] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white/60 text-sm font-medium">
                    {error || `Loading ${currentSource?.name || "player"}...`}
                  </p>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={currentSource.url}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
              allowFullScreen={true}
              title={title || "Watch"}
              onLoad={() => setIsLoading(false)}
              onError={handleIframeError}
            />
          </>
        )}
      </motion.div>

      <p className="text-xs text-white/40 text-center">
        Source fallback is automatic. Use the player&apos;s built-in fullscreen button inside the video for best results.
      </p>
    </div>
  );
}
