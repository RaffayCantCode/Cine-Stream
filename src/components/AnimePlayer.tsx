"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Check, Server, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, RotateCcw, Loader2, Info, Play
} from "lucide-react";
import Hls from "hls.js";
import { getStreamingSource } from "@/lib/anime-fetch";

interface Source {
  name: string;
  embedUrl: string;
  type: "iframe" | "hls";
  quality: string;
  baseDomain: string;
  color: string;
}

interface AnimePlayerProps {
  animeId: string;
  animeTitle: string;
  episode: number;
  episodeId?: string;
  episodeSources?: { src: string; name: string }[];
  onSourceChange?: (source: Source) => void;
  onAutoNext?: () => void;
  onEnded?: () => void;
}

const VIDEO_SOURCES: Omit<Source, "embedUrl">[] = [
  { name: "VidNest", quality: "1080p", baseDomain: "vidnest.fun", type: "iframe", color: "violet" },
  { name: "AnimePahe", quality: "1080p", baseDomain: "vidnest.fun/animepahe", type: "iframe", color: "cyan" },
  { name: "2Anime", quality: "720p", baseDomain: "2anime.xyz", type: "iframe", color: "emerald" },
  { name: "AnimEmbed", quality: "720p", baseDomain: "animembed.com", type: "iframe", color: "fuchsia" },
  { name: "VidAPI", quality: "720p", baseDomain: "vidapi.xyz", type: "iframe", color: "amber" },
];

const SOURCE_COLORS: Record<string, { bg: string; text: string; ring: string; badge: string }> = {
  violet: { bg: "bg-[#831C91]", text: "text-[#D552A3]", ring: "ring-[#D552A3]/30", badge: "bg-[#831C91]/20 text-[#D552A3]" },
  cyan: { bg: "bg-cyan-600", text: "text-cyan-300", ring: "ring-cyan-500/30", badge: "bg-cyan-500/20 text-cyan-300" },
  emerald: { bg: "bg-emerald-600", text: "text-emerald-300", ring: "ring-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-300" },
  fuchsia: { bg: "bg-fuchsia-600", text: "text-fuchsia-300", ring: "ring-fuchsia-500/30", badge: "bg-fuchsia-500/20 text-fuchsia-300" },
  amber: { bg: "bg-amber-600", text: "text-amber-300", ring: "ring-amber-500/30", badge: "bg-amber-500/20 text-amber-300" },
};

function buildEmbedUrl(source: Omit<Source, "embedUrl">, animeId: string, animeTitle: string, episode: number): string {
  const cleanTitle = animeTitle.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  const numericId = animeId.replace(/\D/g, "");

  switch (source.baseDomain) {
    case "vidnest.fun":
      return `https://vidnest.fun/anime/${numericId}/${episode}/sub`;
    case "vidnest.fun/animepahe":
      return `https://vidnest.fun/animepahe/${numericId}/${episode}/sub`;
    case "2anime.xyz":
      return `https://2anime.xyz/embed/${cleanTitle}-episode-${episode}`;
    case "animembed.com":
      return `https://animembed.com/embed/${numericId}/${episode}`;
    case "vidapi.xyz":
      return `https://vidapi.xyz/embed/anime/${cleanTitle}-episode-${episode}`;
    default:
      return `https://${source.baseDomain}/embed/${cleanTitle}-episode-${episode}`;
  }
}

export function AnimePlayer({ animeId, animeTitle, episode, episodeId, episodeSources, onSourceChange, onAutoNext, onEnded }: AnimePlayerProps) {
  const [currentSource, setCurrentSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [dynamicSources, setDynamicSources] = useState<Source[]>([]);
  const [subtitles, setSubtitles] = useState<{ url: string; lang: string }[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const fetchApiSources = async () => {
      if (!episodeId) return;
      try {
        setIsLoading(true);
        const res = await getStreamingSource(animeId, episodeId, "vidcloud");
        if (res.success && res.data?.sources) {
          const hlsSources = res.data.sources.map((s: any, idx: number) => ({
            name: `HLS ${s.quality || "Auto"}`,
            embedUrl: s.url,
            type: "hls" as const,
            quality: s.quality || "Auto",
            baseDomain: "streamapi",
            color: "emerald",
          }));

          if (res.data.subtitles && res.data.subtitles.length > 0) {
            setSubtitles(res.data.subtitles);
          }

          setDynamicSources(hlsSources);
          if (hlsSources.length > 0) {
            setCurrentSource(hlsSources[0]);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch streaming source:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchApiSources();
  }, [animeId, episodeId]);

  const allSources: Source[] = dynamicSources.length > 0
    ? [...dynamicSources, ...VIDEO_SOURCES.map(s => ({ ...s, embedUrl: buildEmbedUrl(s, animeId, animeTitle, episode) }))]
    : VIDEO_SOURCES.map(s => ({ ...s, embedUrl: buildEmbedUrl(s, animeId, animeTitle, episode) }));

  const activeSources = allSources.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);

  useEffect(() => {
    if (!currentSource && activeSources.length > 0 && dynamicSources.length === 0) {
      setCurrentSource(activeSources[0]);
    }
  }, [activeSources, currentSource, dynamicSources]);

  useEffect(() => {
    setError(null);
    setIsLoading(true);
    setAutoNextCountdown(null);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [episode, currentSource]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

  useEffect(() => {
    if (currentSource?.type === "hls" && videoRef.current) {
      const video = videoRef.current;

      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        const hls = new Hls({ maxMaxBufferLength: 100 });
        hlsRef.current = hls;

        hls.loadSource(currentSource.embedUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            handleError();
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = currentSource.embedUrl;
        video.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
        });
        video.addEventListener("error", handleError);
      }
    }
  }, [currentSource]);

  const selectSource = useCallback((source: Source) => {
    setCurrentSource(source);
    setError(null);
    setIsLoading(true);
    setShowSources(false);
    setAutoNextCountdown(null);
    onSourceChange?.(source);
  }, [onSourceChange]);

  const handleError = () => {
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
          {subtitles.length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-1 rounded-lg uppercase tracking-widest border border-emerald-500/30">
              Subs
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

      <motion.div
        ref={playerRef}
        key={episode}
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
                <button onClick={() => setShowSources(true)} className="px-5 py-2.5 bg-[#831C91] hover:bg-[#831C91] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
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
            {currentSource && currentSource.type === "hls" ? (
              <video
                ref={videoRef}
                className="w-full h-full"
                controls
                crossOrigin="anonymous"
                onEnded={() => onAutoNext && onAutoNext()}
              >
                {subtitles.map((sub, idx) => (
                  <track
                    key={idx}
                    kind="captions"
                    src={sub.url}
                    srcLang={sub.lang.substring(0, 2).toLowerCase()}
                    label={sub.lang}
                    default={sub.lang.toLowerCase().includes("english")}
                  />
                ))}
              </video>
            ) : currentSource && (
              <iframe
                ref={iframeRef}
                src={currentSource.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                title={`${animeTitle} - Episode ${episode}`}
                onLoad={() => setIsLoading(false)}
                onError={handleError}
              />
            )}
          </>
        )}
      </motion.div>

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

      <div className="flex items-center justify-center gap-2 text-xs text-white/20">
        <Info className="w-3 h-3" />
        <span>Japanese dub with English subtitles. Auto-switches on failure.</span>
      </div>
    </div>
  );
}
