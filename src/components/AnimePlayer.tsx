"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Check, Server, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, RotateCcw, Loader2, Info, X, Play
} from "lucide-react";

interface Source {
  name: string;
  embedUrl: string;
  type: "iframe";
  quality: string;
  baseDomain: string;
  color: string;
}

interface AnimePlayerProps {
  animeId: string;
  animeTitle: string;
  episode: number;
  episodeSources?: { src: string; name: string }[];
  onSourceChange?: (source: Source) => void;
  onAutoNext?: () => void;
  onEnded?: () => void;
}

const VIDEO_SOURCES: Omit<Source, "embedUrl">[] = [
  { name: "VidPlay", quality: "1080p", baseDomain: "vidplay.site", type: "iframe", color: "violet" },
  { name: "VidSrc.me", quality: "720p", baseDomain: "vidsrc.me", type: "iframe", color: "cyan" },
  { name: "VidSrc.pro", quality: "1080p", baseDomain: "vidsrc.pro", type: "iframe", color: "emerald" },
  { name: "VidSrc.to", quality: "720p", baseDomain: "vidsrc.to", type: "iframe", color: "amber" },
  { name: "StreamSB", quality: "720p", baseDomain: "streamsb.net", type: "iframe", color: "rose" },
  { name: "Filemoon", quality: "1080p", baseDomain: "filemoon.sx", type: "iframe", color: "fuchsia" },
  { name: "AutoEmbed", quality: "720p", baseDomain: "autoembed.co", type: "iframe", color: "blue" },
  { name: "2Embed", quality: "720p", baseDomain: "2embed.cc", type: "iframe", color: "orange" },
  { name: "VidLink", quality: "1080p", baseDomain: "vidlink.pro", type: "iframe", color: "green" },
  { name: "SuperStream", quality: "HD", baseDomain: "superstream.se", type: "iframe", color: "red" },
  { name: "VidCloud", quality: "720p", baseDomain: "vidcloud9.ru", type: "iframe", color: "sky" },
  { name: "MovieWeb", quality: "1080p", baseDomain: "movieweb.top", type: "iframe", color: "yellow" },
];

const SOURCE_COLORS: Record<string, { bg: string; text: string; ring: string; badge: string }> = {
  violet: { bg: "bg-violet-600", text: "text-violet-300", ring: "ring-violet-500/30", badge: "bg-violet-500/20 text-violet-300" },
  cyan: { bg: "bg-cyan-600", text: "text-cyan-300", ring: "ring-cyan-500/30", badge: "bg-cyan-500/20 text-cyan-300" },
  emerald: { bg: "bg-emerald-600", text: "text-emerald-300", ring: "ring-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-300" },
  amber: { bg: "bg-amber-600", text: "text-amber-300", ring: "ring-amber-500/30", badge: "bg-amber-500/20 text-amber-300" },
  rose: { bg: "bg-rose-600", text: "text-rose-300", ring: "ring-rose-500/30", badge: "bg-rose-500/20 text-rose-300" },
  fuchsia: { bg: "bg-fuchsia-600", text: "text-fuchsia-300", ring: "ring-fuchsia-500/30", badge: "bg-fuchsia-500/20 text-fuchsia-300" },
  blue: { bg: "bg-blue-600", text: "text-blue-300", ring: "ring-blue-500/30", badge: "bg-blue-500/20 text-blue-300" },
  orange: { bg: "bg-orange-600", text: "text-orange-300", ring: "ring-orange-500/30", badge: "bg-orange-500/20 text-orange-300" },
  green: { bg: "bg-green-600", text: "text-green-300", ring: "ring-green-500/30", badge: "bg-green-500/20 text-green-300" },
  red: { bg: "bg-red-600", text: "text-red-300", ring: "ring-red-500/30", badge: "bg-red-500/20 text-red-300" },
  sky: { bg: "bg-sky-600", text: "text-sky-300", ring: "ring-sky-500/30", badge: "bg-sky-500/20 text-sky-300" },
  yellow: { bg: "bg-yellow-600", text: "text-yellow-300", ring: "ring-yellow-500/30", badge: "bg-yellow-500/20 text-yellow-300" },
};

function buildEmbedUrl(source: Omit<Source, "embedUrl">, animeId: string, animeTitle: string, episode: number): string {
  const cleanTitle = animeTitle.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  const numericId = animeId.replace(/\D/g, "");

  switch (source.baseDomain) {
    case "vidplay.site":
      return `https://vidplay.site/embed/${cleanTitle}-episode-${episode}`;
    case "vidsrc.me":
      return `https://vidsrc.me/embed/${cleanTitle}-episode-${episode}`;
    case "vidsrc.pro":
      return `https://vidsrc.pro/embed/${numericId}`;
    case "vidsrc.to":
      return `https://vidsrc.to/embed/anime/${numericId}`;
    case "streamsb.net":
      return `https://streamsb.net/embed/${cleanTitle}-episode-${episode}`;
    case "filemoon.sx":
      return `https://filemoon.sx/e/${cleanTitle}-episode-${episode}`;
    case "autoembed.co":
      return `https://autoembed.co/embed/anime/${numericId}`;
    case "2embed.cc":
      return `https://www.2embed.cc/embed/${numericId}`;
    case "vidlink.pro":
      return `https://vidlink.pro/embed/anime/${numericId}`;
    case "superstream.se":
      return `https://superstream.se/embed/${cleanTitle}-episode-${episode}`;
    case "vidcloud9.ru":
      return `https://vidcloud9.ru/embed/${cleanTitle}-episode-${episode}`;
    case "movieweb.top":
      return `https://movieweb.top/embed/${cleanTitle}-episode-${episode}`;
    default:
      return `https://${source.baseDomain}/embed/${cleanTitle}-episode-${episode}`;
  }
}

export function AnimePlayer({ animeId, animeTitle, episode, episodeSources, onSourceChange, onAutoNext, onEnded }: AnimePlayerProps) {
  const [currentSource, setCurrentSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const apiSources: Source[] = episodeSources?.length
    ? episodeSources.map((s, i) => ({
        name: s.name || `Server ${i + 1}`,
        embedUrl: s.src,
        type: "iframe" as const,
        quality: "HD" as const,
        baseDomain: s.src.includes("//") ? s.src.split("/")[2] || "unknown" : "unknown",
        color: VIDEO_SOURCES[i % VIDEO_SOURCES.length]?.color || "violet",
      }))
    : [];

  const allSources: Source[] = apiSources.length > 0
    ? [...apiSources, ...VIDEO_SOURCES.map(s => ({ ...s, embedUrl: buildEmbedUrl(s, animeId, animeTitle, episode) }))]
    : VIDEO_SOURCES.map(s => ({ ...s, embedUrl: buildEmbedUrl(s, animeId, animeTitle, episode) }));

  const activeSources = allSources.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);

  useEffect(() => {
    if (!currentSource && activeSources.length > 0) {
      setCurrentSource(activeSources[0]);
    }
  }, []);

  useEffect(() => {
    setError(null);
    setIsLoading(true);
    setAutoNextCountdown(null);
  }, [episode]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

  const selectSource = useCallback((source: Source) => {
    setCurrentSource(source);
    setError(null);
    setIsLoading(true);
    setIframeKey(prev => prev + 1);
    setShowSources(false);
    setAutoNextCountdown(null);
    onSourceChange?.(source);
  }, [onSourceChange]);

  const handleIframeLoad = () => setIsLoading(false);
  const handleIframeError = () => {
    const idx = activeSources.findIndex(s => s.name === currentSource?.name);
    const next = activeSources[idx + 1];
    if (next) {
      setError(`Source failed, switching to ${next.name}...`);
      setTimeout(() => selectSource(next), 2500);
    } else {
      setError("All sources failed. Try a different source.");
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (activeSources.length > 0) {
      setError(null);
      selectSource(activeSources[0]);
    }
  };

  const toggleFullscreen = async () => {
    try {
      const el = playerRef.current;
      if (!el) return;
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch { /* ignore */ }
  };

  const currentColors = currentSource ? SOURCE_COLORS[currentSource.color] || SOURCE_COLORS.violet : SOURCE_COLORS.violet;

  return (
    <div ref={containerRef} className="w-full space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/40 font-medium uppercase tracking-wider hidden sm:inline">Source:</span>
          <button
            onClick={() => setShowSources(!showSources)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${currentColors.bg} text-white text-xs font-bold transition-all hover:opacity-90 shadow-lg`}
          >
            <Server className="w-4 h-4" />
            {currentSource?.name || "Select Source"}
            <ChevronRight className={`w-4 h-4 transition-transform ${showSources ? "rotate-90" : ""}`} />
          </button>
          {currentSource && (
            <span className={`${currentColors.badge} text-[10px] font-extrabold px-2 py-1 rounded-lg uppercase tracking-widest`}>
              {currentSource.quality}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRetry} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all" title="Retry">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Source Dropdown */}
      <AnimatePresence>
        {showSources && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/10 shadow-2xl"
          >
            {activeSources.map((source, idx) => {
              const isActive = currentSource?.name === source.name;
              const sc = SOURCE_COLORS[source.color] || SOURCE_COLORS.violet;
              return (
                <button
                  key={`${source.name}-${idx}`}
                  onClick={() => selectSource(source)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? `${sc.bg} text-white shadow-lg`
                      : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                  }`}
                >
                  <Server className={`w-4 h-4 shrink-0 ${isActive ? "" : "text-white/30"}`} />
                  <span className="flex-1 text-left">{source.name}</span>
                  <span className={`text-[9px] ${isActive ? "text-white/60" : "text-white/30"}`}>{source.quality}</span>
                  {isActive && !isLoading && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                  {isActive && isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Player */}
      <motion.div
        ref={playerRef}
        key={iframeKey}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-2 ring-white/10 relative"
      >
        {error && !error.includes("switching") ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black">
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-400/60" />
              </div>
              <p className="text-white/60 text-sm mb-5 font-medium">{error}</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={handleRetry} className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Try Again
                </button>
                <button onClick={() => setShowSources(true)} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
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
                  <div className="w-14 h-14 border-4 border-white/10 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white/60 text-sm font-medium">
                    {error || `Loading ${currentSource?.name || "player"}...`}
                  </p>
                </div>
              </div>
            )}
            {currentSource && (
              <iframe
                ref={iframeRef}
                src={currentSource.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                title={`${animeTitle} - Episode ${episode}`}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            )}
          </>
        )}
      </motion.div>

      {/* Auto-Next Countdown */}
      <AnimatePresence>
        {autoNextCountdown !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
          >
            <div className="flex items-center gap-3">
              <Play className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white/70 font-medium">Next episode in</span>
              <span className="text-lg font-black text-emerald-400">{autoNextCountdown}s</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAutoNextCountdown(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs font-bold hover:bg-white/20 transition-all">
                Cancel
              </button>
              <button onClick={onAutoNext}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all">
                Play Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info */}
      <div className="flex items-center justify-center gap-2 text-xs text-white/20">
        <Info className="w-3 h-3" />
        <span>Quality depends on source. Auto-switches on failure.</span>
      </div>
    </div>
  );
}