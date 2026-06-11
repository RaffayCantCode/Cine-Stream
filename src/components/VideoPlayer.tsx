"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, Server, Maximize2, ChevronRight, RotateCcw, Loader2, SkipForward } from "lucide-react";
import { StreamingSource, getStreamingSources } from "@/lib/streaming-fetch";
import { fetchJson } from "@/lib/utils";

interface VideoPlayerProps {
  type: "movie" | "tv";
  id: number;
  season?: number;
  episode?: number;
  title?: string;
}

const SOURCE_STYLES: Record<string, { bg: string; badge: string }> = {
  cinesrc: { bg: "bg-[#4B5694]", badge: "bg-[#4B5694]/20 text-[#7288AE]" },
  vidsrcfyi: { bg: "bg-cyan-600", badge: "bg-cyan-500/20 text-cyan-300" },
  vidsrcto: { bg: "bg-amber-600", badge: "bg-amber-500/20 text-amber-300" },
  "2embed": { bg: "bg-teal-600", badge: "bg-teal-500/20 text-teal-300" },
  multiembed: { bg: "bg-rose-600", badge: "bg-rose-500/20 text-rose-300" },
};

const QUALITY_STYLES: Record<StreamingSource["quality"], string> = {
  Best: "bg-emerald-400/15 text-emerald-300 border-emerald-300/25",
  HD: "bg-cyan-400/15 text-cyan-300 border-cyan-300/25",
  Backup: "bg-amber-400/15 text-amber-300 border-amber-300/25",
};

const DEFAULT_TIMEOUT = 12000;

export function VideoPlayer({ type, id, season, episode, title }: VideoPlayerProps) {
  const allSources = useMemo(() => getStreamingSources(type, id, season, episode), [type, id, season, episode]);
  const [activeSources, setActiveSources] = useState<StreamingSource[]>(allSources);
  const [currentSource, setCurrentSource] = useState<StreamingSource>(allSources[0]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFailoverCount = useRef(0);

  const currentStyle = SOURCE_STYLES[currentSource?.type] || SOURCE_STYLES.cinesrc;

  // Check source health on mount
  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const res = await fetchJson<{ success: boolean; data: Record<string, boolean> }>("/api/stream/health");
        if (cancelled || !res.success) return;
        const health = res.data;
        const alive = allSources.filter((s) => health[s.type] !== false);
        if (alive.length > 0) {
          setActiveSources(alive);
          setCurrentSource(alive[0]);
        }
      } catch { /* use all sources as fallback */ }
      if (!cancelled) setHealthChecked(true);
    };
    checkHealth();
    return () => { cancelled = true; };
  }, [allSources]);

  const sources = activeSources;

  // Auto-failover: if a source doesn't load within timeout, try next
  const switchToNext = useCallback(() => {
    const currentIndex = sources.findIndex((s) => s.name === currentSource.name);
    const nextIndex = (currentIndex + 1) % sources.length;
    if (nextIndex === currentIndex) {
      setError("All sources failed to load.");
      setIsLoading(false);
      return;
    }
    const nextSource = sources[nextIndex];
    setCurrentSource(nextSource);
    setError(null);
    setIsLoading(true);
    autoFailoverCount.current++;
  }, [sources, currentSource]);

  useEffect(() => {
    if (!isLoading || !healthChecked) return;
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    loadTimerRef.current = setTimeout(() => {
      if (isLoading && sources.length > 1) {
        switchToNext();
      }
    }, DEFAULT_TIMEOUT);
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [isLoading, currentSource, healthChecked, sources.length, switchToNext]);

  useEffect(() => {
    setCurrentSource(sources[0]);
    setError(null);
    setIsLoading(true);
    autoFailoverCount.current = 0;
  }, [sources]);

  const handleSourceChange = (source: StreamingSource) => {
    setCurrentSource(source);
    setError(null);
    setIsLoading(true);
    setShowSources(false);
    autoFailoverCount.current = 0;
  };

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setError(`${currentSource.name} failed to load.`);
  }, [currentSource]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    frame.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen *; gyroscope; picture-in-picture; web-share"
    );
    frame.setAttribute("allowfullscreen", "true");
  }, [currentSource.url]);

  const requestFullscreen = async () => {
    const el = playerContainerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
    } catch {
      try { if (iframeRef.current?.requestFullscreen) await iframeRef.current.requestFullscreen(); }
      catch { setError("Fullscreen was blocked."); }
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
            {currentSource?.quality && (
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] leading-none ${QUALITY_STYLES[currentSource.quality]}`}>
                {currentSource.quality}
              </span>
            )}
            <ChevronRight className={`w-4 h-4 transition-transform ${showSources ? "rotate-90" : ""}`} />
          </button>
          {sources.length > 1 && (
            <button
              onClick={switchToNext}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-[#4B5694] border border-white/10 hover:border-[#7288AE]/40 text-white/80 hover:text-white text-xs font-bold transition-all"
            >
              <SkipForward className="w-4 h-4" />
              Next Source
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setError(null); setCurrentSource(sources[0]); setIsLoading(true); autoFailoverCount.current = 0; }}
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
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/10 shadow-2xl"
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
                  <span className={`rounded-md border px-1.5 py-0.5 text-[9px] leading-none ${QUALITY_STYLES[source.quality]}`}>
                    {source.quality}
                  </span>
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
        {error ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black">
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-400/60" />
              </div>
              <p className="text-white/60 text-sm mb-5 font-medium">{error}</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {sources.length > 1 && (
                  <>
                    <button onClick={() => { setError(null); setCurrentSource(sources[0]); setIsLoading(true); }}
                      className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> Try Again
                    </button>
                    <button onClick={switchToNext}
                      className="px-5 py-2.5 bg-[#4B5694] hover:bg-[#7288AE] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <SkipForward className="w-4 h-4" /> Next Source
                    </button>
                  </>
                )}
                <button onClick={() => setShowSources(true)}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Server className="w-4 h-4" /> Browse All
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <div className="text-center">
                  <div className="w-14 h-14 border-4 border-white/10 border-t-[#4B5694] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white/60 text-sm font-medium">Loading {currentSource?.name || "player"}...</p>
                  {sources.length > 1 && (
                    <button onClick={switchToNext}
                      className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 mx-auto"
                    >
                      <SkipForward className="w-3.5 h-3.5" /> Switch Source
                    </button>
                  )}
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={currentSource.url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen *; gyroscope; picture-in-picture; web-share"
              allowFullScreen={true}
              referrerPolicy="strict-origin-when-cross-origin"
              title={title || "Watch"}
              onLoad={() => setIsLoading(false)}
              onError={handleIframeError}
            />
          </>
        )}
      </motion.div>
    </div>
  );
}
