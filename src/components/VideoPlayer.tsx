"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, Check, Server, Maximize2, Minimize2, ChevronRight, RotateCcw, Loader2, SkipForward, ExternalLink } from "lucide-react";
import { StreamingSource, getStreamingSources } from "@/lib/streaming-fetch";
import { fetchSourceConfig, SOURCE_TAG_LABELS, TAG_STYLES, type SourceTag } from "@/lib/streaming-config";

interface VideoPlayerProps {
  type: "movie" | "tv";
  id: number;
  season?: number;
  episode?: number;
  title?: string;
  startProgress?: number;
  onProgress?: (time: number) => void;
  onEpisodeChange?: (season: number, episode: number) => void;
  onVideoEnd?: () => void;
  forcedSource?: string;
  forceReloadCount?: number;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
}

const SOURCE_STYLES: Record<string, { bg: string; badge: string }> = {
  videasy:     { bg: "bg-emerald-600", badge: "bg-emerald-500/20 text-emerald-300" },
  vixsrc:      { bg: "bg-teal-600",  badge: "bg-teal-500/20 text-teal-300" },
  vidsrc:      { bg: "bg-blue-600",  badge: "bg-blue-500/20 text-blue-300" },
  vidlink:     { bg: "bg-violet-600", badge: "bg-violet-500/20 text-violet-300" },
  autoembed:   { bg: "bg-rose-600",  badge: "bg-rose-500/20 text-rose-300" },
};

const QUALITY_STYLES: Record<StreamingSource["quality"], string> = {
  Best:   "bg-emerald-400/15 text-emerald-300 border-emerald-300/25",
  Stable: "bg-violet-400/15 text-violet-300 border-violet-300/25",
  Good:   "bg-cyan-400/15 text-cyan-300 border-cyan-300/25",
  Backup: "bg-amber-400/15 text-amber-300 border-amber-300/25",
};

const DEFAULT_TIMEOUT = 12000;

// Per-media source key: each movie/show remembers its own preferred source independently per user
const getSourcePrefKey = (type: string, id: number, userId: string) => `sv_src_${userId}_${type}_${id}`;

export function VideoPlayer({ type, id, season, episode, title, startProgress, onProgress, onEpisodeChange, onVideoEnd, forcedSource, forceReloadCount, isTheaterMode, onToggleTheater }: VideoPlayerProps) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || "guest";
  const initialProgressRef = useRef(startProgress);
  const [sourceConfig, setSourceConfig] = useState<{ key: string; tag: SourceTag }[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchSourceConfig().then((cfg) => {
      if (active) setSourceConfig(cfg.movie);
    });
    return () => { active = false; };
  }, []);

  const sources = useMemo(() => {
    const base = getStreamingSources(type, id, season, episode, initialProgressRef.current);
    if (!sourceConfig) return base;
    const byType = new Map(base.map((s) => [s.type, s]));
    const ordered: StreamingSource[] = [];
    sourceConfig.forEach((entry, index) => {
      const src = byType.get(entry.key);
      if (src) {
        ordered.push({ ...src, name: `Source ${index + 1}`, tag: entry.tag });
      }
    });
    base.forEach((s) => {
      if (!ordered.find((o) => o.type === s.type)) ordered.push(s);
    });
    return ordered;
  }, [type, id, season, episode, sourceConfig]);
  const sourcePrefKey = getSourcePrefKey(type, id, userId);
  const globalPrefKey = `sv_src_global_${userId}_${type}`;

  const [currentSource, setCurrentSource] = useState<StreamingSource>(() => {
    if (type === "tv") {
      try {
        const saved = localStorage.getItem(sourcePrefKey) || localStorage.getItem(globalPrefKey);
        if (saved && !forcedSource) {
          const found = sources.find((s: StreamingSource) => s.type === saved) ||
                        sources.find((s: StreamingSource) => s.name === saved);
          if (found) return found;
        }
      } catch {}
    }
    return sources[0];
  });
  const [isSourceLoaded, setIsSourceLoaded] = useState(false);

  useEffect(() => {
    if (status === "loading" || isSourceLoaded) return;
    if (type === "tv") {
      try {
        const saved = localStorage.getItem(sourcePrefKey) || localStorage.getItem(globalPrefKey);
        if (saved && !forcedSource) {
          const found = sources.find(s => s.type === saved) ||
                        sources.find(s => s.name === saved);
          if (found) setCurrentSource(found);
        }
      } catch {}
    }
    setIsSourceLoaded(true);
  }, [status, sourcePrefKey, globalPrefKey, sources, isSourceLoaded, forcedSource, type]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentStyle = SOURCE_STYLES[currentSource?.type] || SOURCE_STYLES.videasy;

  // Manual fallback: switch to the next source in the list (user initiated)
  const switchToNext = useCallback(() => {
    const currentIndex = sources.findIndex((s) => s.type === currentSource?.type);
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
    setRetryCount(0);
    if (type === "tv") {
      try {
        localStorage.setItem(sourcePrefKey, nextSource.type);
        localStorage.setItem(globalPrefKey, nextSource.type);
      } catch {}
    }
  }, [sources, currentSource, sourcePrefKey, globalPrefKey, type]);


  // Sources are all shown always — if an embed fails the user sees the error and can pick another

  // Preconnect to all embed provider domains so iframe DNS + TCP + TLS starts early
  useEffect(() => {
    const domains = [
      "https://vidsrc.me",
      "https://vixsrc.to",
      "https://player.videasy.net",
      "https://vidlink.pro",
      "https://autoembed.co"
    ];
    const links: HTMLLinkElement[] = [];
    domains.forEach(href => {
      if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        document.head.appendChild(link);
        links.push(link);
      }
    });
    return () => {
      links.forEach(link => link.remove());
    };
  }, []);

  const autoPlayTriggeredRef = useRef(false);

  useEffect(() => {
    autoPlayTriggeredRef.current = false;
  }, [season, episode]);

  const isLoadingRef = useRef(isLoading);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Listen to postMessage for progress updates (e.g., from VidLink)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (isLoadingRef.current) return; // Ignore messages from the old page while the new page is loading
      
      // Handle generic ended/next events
      if (event.data.type === 'video.ended' || event.data.type === 'video.next') {
        if (onProgress && (event.data.type as any) === 'video.ended') onProgress(999999); // max out progress
        if (onVideoEnd && !autoPlayTriggeredRef.current) {
          autoPlayTriggeredRef.current = true;
          onVideoEnd();
        }
      }
      
      // VidLink emits 'video.progress'
      if (event.data.type === 'video.progress' && event.data.data) {
        const { time, duration } = event.data.data;
        const evSeason = event.data.data.season || event.data.meta?.season;
        const evEpisode = event.data.data.episode || event.data.meta?.episode;
        
        // If the iframe player changed episodes internally, we should ideally notify the parent.
        // For now, if we detect internal episode change, we just use those for saving progress, 
        // but the parent URL might still be out of sync unless we emit an event.
        const actualSeason = evSeason || season || 0;
        const actualEpisode = evEpisode || episode || 0;

        if ((evSeason && evSeason !== season) || (evEpisode && evEpisode !== episode)) {
          if (onEpisodeChange) onEpisodeChange(actualSeason, actualEpisode);
        }

        if (typeof time === 'number') {
          if (onProgress) onProgress(time);

          if (typeof duration === 'number' && duration > 0 && time >= duration - 2) {
            if (onVideoEnd && !autoPlayTriggeredRef.current) {
              autoPlayTriggeredRef.current = true;
              onVideoEnd();
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, type, season, episode, onProgress, onEpisodeChange, onVideoEnd]);

  useEffect(() => {
    setCurrentSource(prev => {
      let targetType = forcedSource || prev?.type;
      if (type === "tv") {
        try {
          const saved = localStorage.getItem(sourcePrefKey) || localStorage.getItem(globalPrefKey);
          if (!forcedSource && saved) targetType = saved;
        } catch {}
      }
      return sources.find(s => s.type === targetType) ||
             sources.find(s => s.name === targetType) ||
             sources[0];
    });
    setError(null);
    setIsLoading(true);
  }, [sources, sourcePrefKey, globalPrefKey, forcedSource, type]);

  const prevForceReloadRef = useRef(forceReloadCount);
  useEffect(() => {
    if (forceReloadCount !== prevForceReloadRef.current) {
      prevForceReloadRef.current = forceReloadCount;
      setRetryCount(prev => prev + 1);
    }
  }, [forceReloadCount]);

  const handleSourceChange = (source: StreamingSource) => {
    setCurrentSource(source);
    setError(null);
    setIsLoading(true);
    setShowSources(false);
    setRetryCount(0);
    if (type === "tv") {
      try {
        localStorage.setItem(sourcePrefKey, source.type);
        localStorage.setItem(globalPrefKey, source.type);
      } catch {}
    }
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

  useEffect(() => {
    if (!onToggleTheater) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        onToggleTheater();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleTheater]);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Source dropdown & Next Source */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowSources(!showSources)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${currentStyle.bg} text-white text-xs font-bold transition-all hover:opacity-90 shadow-md cursor-pointer shrink-0`}
          >
            <Server className="w-3.5 h-3.5 shrink-0 text-white/90" />
            <span className="font-bold">{currentSource?.name || "Select Source"}</span>
            {currentSource?.tag ? (
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${TAG_STYLES[currentSource.tag as SourceTag] || TAG_STYLES.good}`}>
                {SOURCE_TAG_LABELS[currentSource.tag as SourceTag] || currentSource.tag}
              </span>
            ) : currentSource?.quality ? (
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${QUALITY_STYLES[currentSource.quality]}`}>
                {currentSource.quality}
              </span>
            ) : null}
            <ChevronRight className={`w-3.5 h-3.5 text-white/70 transition-transform ${showSources ? "rotate-90" : ""}`} />
          </button>
          {sources.length > 1 && (
            <button
              onClick={switchToNext}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/75 hover:text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
              title="Switch to next streaming source"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Next Source</span>
            </button>
          )}
        </div>

        {/* Right Side: Theater Mode & Reload */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {onToggleTheater && (
            <button
              onClick={onToggleTheater}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm cursor-pointer ${
                isTheaterMode
                  ? "bg-primary text-primary-foreground border-primary/40 ring-1 ring-primary/30"
                  : "bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-white/75 hover:text-white"
              }`}
              title="Toggle Theater Mode [T]"
            >
              {isTheaterMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isTheaterMode ? "Standard" : "Theater"}</span>
            </button>
          )}
          <button
            onClick={() => { setError(null); setIsLoading(true); setRetryCount(c => c + 1); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/75 hover:text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Reload Video Source"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

        {showSources && (
          <div className="space-y-3 animate-fade-in-up" style={{ animationDuration: "0.2s" }}>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-200/80 text-xs leading-relaxed">
                <strong className="text-amber-400 font-bold block mb-0.5">Try different sources!</strong>
                If a video is buffering, loads slowly, or shows an error, simply try another source. Some servers may be experiencing high load.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/10 shadow-2xl">
              {sources.map((source, idx) => {
              const isActive = currentSource?.type === source.type;
              const sc = SOURCE_STYLES[source.type] || SOURCE_STYLES.videasy;
              return (
                <button
                  key={source.type}
                  onClick={() => handleSourceChange(source)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? `${sc.bg} text-white shadow-lg`
                      : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                  }`}
                >
                  <Server className={`w-4 h-4 shrink-0 ${isActive ? "" : "text-white/30"}`} />
                  <span className="flex-1 text-left">{source.name}</span>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[9px] leading-none ${source.tag ? (TAG_STYLES[source.tag as SourceTag] || TAG_STYLES.good) : QUALITY_STYLES[source.quality]}`}>
                    {source.tag ? (SOURCE_TAG_LABELS[source.tag as SourceTag] || source.tag) : source.quality}
                  </span>
                  {isActive && !isLoading && !error && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                  {isActive && isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
              );
            })}
            </div>
          </div>
        )}

      <div
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
          <iframe
            key={`${currentSource.type}-${retryCount}`}
            ref={iframeRef}
            src={currentSource.url}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen *; gyroscope; picture-in-picture; web-share; microphone"
            allowFullScreen={true}
            referrerPolicy="no-referrer-when-downgrade"
            title={title || "Watch"}
            onLoad={() => { setIsLoading(false); }}
            onError={handleIframeError}
          />
        )}
      </div>
    </div>
  );
}
