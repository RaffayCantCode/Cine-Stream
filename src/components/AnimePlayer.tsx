"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Server, Maximize2, RotateCcw, SkipForward, ChevronRight, Check, Loader2 } from "lucide-react";

interface ProviderSource {
  name: string;
  provider: "vidnest" | "animeplay" | "123embed" | "vidlink" | "autoembed";
  color: string;
}

interface AnimePlayerProps {
  animeId: string;
  malId?: string | null;
  animeTitle: string;
  episode: number;
  rootAnimeId?: string | null;
  rootMalId?: string | null;
  episodeOffset?: number;
  tmdbId?: number | null;
  tmdbSeason?: number | null;
  isMovie?: boolean;
  startProgress?: number;
  onAutoNext?: () => void;
  onProgress?: (time: number) => void;
  forcedSource?: string;
  forceReloadCount?: number;
}

const PROVIDERS: ProviderSource[] = [
  { name: "Source 1", provider: "vidnest", color: "from-[#e63946]/30 to-[#ff6b6b]/20" },
  { name: "Source 2", provider: "animeplay", color: "from-[#4B5694]/30 to-[#7288AE]/20" },
  { name: "Source 3", provider: "123embed", color: "from-[#2d6a4f]/30 to-[#40916c]/20" },
  { name: "Source 4", provider: "vidlink", color: "from-[#111844]/30 to-[#4B5694]/20" },
  { name: "Source 5", provider: "autoembed", color: "from-[#f43f5e]/30 to-[#fb7185]/20" },
];

function buildProviderUrl(
  provider: string,
  animeId: string,
  malId: string | null | undefined,
  rootAnimeId: string | null | undefined,
  rootMalId: string | null | undefined,
  episode: number,
  episodeOffset: number,
  tmdbId: number | null | undefined,
  tmdbSeason: number | null | undefined,
  startProgress?: number,
  isMovie?: boolean
): string {
  const clean = (id: string | null | undefined) => id?.replace(/\D/g, "") || null;
  const curAni = clean(animeId);
  const curMal = clean(malId);
  const mainAni = clean(rootAnimeId) || curAni;
  const isSequel = Boolean(curAni && mainAni && curAni !== mainAni);
  const absEp = episodeOffset + episode;
  const ep = isSequel ? episode : episodeOffset > 0 ? absEp : episode;
  const aniId = curAni || mainAni;
  const malClean = clean(rootMalId) || curMal;
  const hasOwnMal = Boolean(curMal && curMal !== malClean);
  const malId_ = hasOwnMal ? (isSequel ? curMal : malClean) : null;

  switch (provider) {
    case "vidnest":
      return `https://vidnest.fun/anime/${aniId || malId_ || ""}/${ep}/sub`;
    case "animeplay":
      return `https://megaplay.buzz/stream/ani/${aniId || ""}/${ep}/sub`;
    case "vidlink":
      const timeParam = startProgress && startProgress > 0 ? `&t=${startProgress}` : "";
      if (tmdbId) {
        return isMovie 
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=4b5694&autoplay=true${timeParam}`
          : `https://vidlink.pro/tv/${tmdbId}/${tmdbSeason || 1}/${absEp}?primaryColor=4b5694&autoplay=true${timeParam}`;
      }
      return `https://vidlink.pro/anime/${malId_ || aniId || ""}/${ep}/sub?primaryColor=4b5694&autoplay=true&fallback=true${timeParam}`;
    case "123embed":
      if (tmdbId) {
        return isMovie
          ? `https://play2.123embed.net/movie/${tmdbId}`
          : `https://play2.123embed.net/tv/${tmdbId}/${tmdbSeason || 1}/${absEp}`;
      }
      return `https://vidnest.fun/anime/${aniId || malId_ || ""}/${ep}/sub`;
    case "autoembed":
      if (tmdbId) {
        return isMovie
          ? `https://player.autoembed.co/embed/movie/${tmdbId}`
          : `https://player.autoembed.co/embed/tv/${tmdbId}/${tmdbSeason || 1}-${absEp}`;
      }
      return `https://vidnest.fun/anime/${aniId || malId_ || ""}/${ep}/sub`;
    default:
      return "";
  }
}

export function AnimePlayer({
  animeId,
  malId,
  animeTitle,
  episode,
  rootAnimeId,
  rootMalId,
  episodeOffset,
  tmdbId,
  tmdbSeason,
  isMovie,
  startProgress,
  onAutoNext,
  onProgress,
  forcedSource,
  forceReloadCount
}: AnimePlayerProps) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || "guest";
  const sourcePrefKey = `sv_src_anime_${userId}_${animeId}`;

  const [sourceIndex, setSourceIndex] = useState(0);
  const [isSourceLoaded, setIsSourceLoaded] = useState(false);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    if (status === "loading" || isSourceLoaded) return;
    try {
      const saved = localStorage.getItem(sourcePrefKey);
      if (saved !== null && !forcedSource) {
        // Support both name-based (new) and index-based (legacy) saved values
        const byName = PROVIDERS.findIndex(p => p.name === saved);
        if (byName >= 0) setSourceIndex(byName);
        else {
          const idx = parseInt(saved, 10);
          if (!isNaN(idx) && idx >= 0 && idx < PROVIDERS.length) setSourceIndex(idx);
        }
      }
    } catch {}
    setIsSourceLoaded(true);
  }, [status, sourcePrefKey, isSourceLoaded, forcedSource]);

  useEffect(() => {
    if (forcedSource) {
      const byName = PROVIDERS.findIndex(p => p.name === forcedSource);
      if (byName >= 0) {
        setSourceIndex(byName);
        setRetryCount(prev => prev + 1);
      }
    } else if (forceReloadCount) {
      setRetryCount(prev => prev + 1);
    }
  }, [forcedSource, forceReloadCount]);

  const handleSourceChange = (index: number, name: string) => {
    setSourceIndex(index);
    setHasError(false);
    setIsLoading(true);
    setShowSources(false);
    setRetryCount(0);
    setIframeReady(false);
    try { localStorage.setItem(sourcePrefKey, name); } catch {}
  };

  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showSpinner, setShowSpinner] = useState(true);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const currentSource = PROVIDERS[sourceIndex] || PROVIDERS[0];
  const nextSourceName = PROVIDERS[(sourceIndex + 1) % PROVIDERS.length]?.name || "";

  // Auto-dismiss spinner
  useEffect(() => {
    setShowSpinner(true);
    let isLoaded = false;
    
    // Listen for iframe load externally or via state
    const loadHandler = () => { isLoaded = true; };
    iframeRef.current?.addEventListener('load', loadHandler);

    const spinnerTimer = setTimeout(() => setShowSpinner(false), 2500);
    
    return () => {
      clearTimeout(spinnerTimer);
      iframeRef.current?.removeEventListener('load', loadHandler);
    };
  }, [currentUrl, isLoading]);

  // Preconnect to all embed provider domains so iframe DNS + TCP + TLS starts early
  useEffect(() => {
    const domains = [
      "https://megaplay.buzz",
      "https://vidnest.fun",
      "https://vidlink.pro",
      "https://player.autoembed.co",
      "https://multiembed.mov"
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

  const initialProgressRef = useRef(startProgress);

  // Pre-resolve all provider URLs so switching is instant
  useEffect(() => {
    const urls: Record<string, string> = {};
    PROVIDERS.forEach(p => {
      urls[p.provider] = buildProviderUrl(
        p.provider, animeId, malId, rootAnimeId, rootMalId,
        episode, episodeOffset || 0, tmdbId, tmdbSeason, initialProgressRef.current, isMovie
      );
    });
    setResolvedUrls(urls);
    setRetryCount(0);
    setIsLoading(true);
    setHasError(false);
    setIframeReady(false);
  }, [animeId, malId, episode, rootAnimeId, rootMalId, episodeOffset, tmdbId, tmdbSeason, isMovie]);

  // When source index changes, pick the pre-resolved URL instantly
  useEffect(() => {
    const url = resolvedUrls[currentSource.provider];
    if (url) {
      setIsLoading(true);
      setHasError(false);
      setCurrentUrl(url);
    }
  }, [sourceIndex, resolvedUrls]);

  // Scroll player into view on episode change
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

  const lastSaveTimeRef = useRef<number>(0);

  const autoPlayTriggeredRef = useRef(false);

  // Listen to postMessage for progress updates (e.g., from VidLink)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      
      // Handle generic ended/next events
      if (event.data.type === 'video.ended' || event.data.type === 'video.next') {
        if (onProgress && (event.data.type as any) === 'video.ended') onProgress(999999);
        if (onAutoNext && !autoPlayTriggeredRef.current) {
          autoPlayTriggeredRef.current = true;
          onAutoNext();
        }
      }
      
      if (event.data.type === 'video.progress' && event.data.data) {
        const { time, duration } = event.data.data;
        if (typeof time === 'number') {
          if (onProgress) onProgress(time);

          if (typeof duration === 'number' && duration > 0 && time >= duration - 2) {
            if (onAutoNext && !autoPlayTriggeredRef.current) {
              autoPlayTriggeredRef.current = true;
              onAutoNext();
            }
          }

          const now = Date.now();
          if (now - lastSaveTimeRef.current > 10000) {
            lastSaveTimeRef.current = now;
            const cleanId = animeId?.replace(/\D/g, "");
            const numericId = parseInt(cleanId || "", 10);
            if (!Number.isNaN(numericId)) {
              fetch('/api/watch-history/progress', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mediaId: numericId,
                  mediaType: "anime",
                  season: tmdbSeason || 1,
                  episode: episode || 1,
                  progress: Math.floor(time),
                  duration: Math.floor(duration || 0)
                })
              }).catch(() => {});
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [animeId, episode, tmdbSeason, onProgress, onAutoNext]);

  // Handle seamless syncing via postMessage without reloading the iframe
  // Only send for VidLink (Source 4) — other providers don't understand these messages
  useEffect(() => {
    if (iframeReady && iframeRef.current?.contentWindow && startProgress !== undefined && currentSource.provider === "vidlink") {
      iframeRef.current.contentWindow.postMessage({ type: "player.seek", data: startProgress }, "*");
      iframeRef.current.contentWindow.postMessage({ type: "player.play" }, "*");
    }
  }, [startProgress, forceReloadCount, iframeReady, currentSource.provider]);

  const switchSource = useCallback(() => {
    setSourceIndex(prev => {
      const next = (prev + 1) % PROVIDERS.length;
      try { localStorage.setItem(sourcePrefKey, PROVIDERS[next].name); } catch {}
      return next;
    });
    setRetryCount(0);
    setIframeReady(false);
  }, [sourcePrefKey]);


  const retrySource = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setIframeReady(false);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (playerRef.current?.requestFullscreen) {
          await playerRef.current.requestFullscreen();
        } else if (iframeRef.current?.requestFullscreen) {
          await iframeRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/40 font-medium uppercase tracking-wider hidden sm:inline">Source:</span>
          <button
            onClick={() => setShowSources(!showSources)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r ${currentSource.color} border border-[#7288AE]/30 text-white text-xs font-bold transition-all hover:opacity-90 shadow-lg`}
          >
            <Server className="w-4 h-4" />
            {currentSource.name}
            <ChevronRight className={`w-4 h-4 transition-transform ${showSources ? "rotate-90" : ""}`} />
          </button>
          {PROVIDERS.length > 1 && (
            <button
              onClick={switchSource}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-[#4B5694] border border-white/10 hover:border-[#7288AE]/40 text-white/80 hover:text-white text-xs font-bold transition-all"
            >
              <SkipForward className="w-4 h-4" />
              Next Source
            </button>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-[10px] text-amber-400 font-bold">Popup ads may open — close them and the video will play</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={retrySource}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.15] border border-white/10 hover:border-white/20 text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all shadow-lg"
            title="Reload source"
          >
            <RotateCcw className="w-4 h-4" /> Reload
          </button>
        </div>
      </div>

      {showSources && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/10 shadow-2xl animate-fade-in-up"
          style={{ animationDuration: "0.2s" }}
        >
          {PROVIDERS.map((source, index) => {
            const isActive = sourceIndex === index;
            return (
              <button
                key={source.name}
                onClick={() => handleSourceChange(index, source.name)}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${source.color} border border-white/10 text-white shadow-lg`
                    : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                }`}
              >
                <Server className={`w-4 h-4 shrink-0 ${isActive ? "" : "text-white/30"}`} />
                <span className="flex-1 text-left">{source.name}</span>
                {isActive && !isLoading && !hasError && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                {isActive && isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              </button>
            );
          })}
        </div>
      )}

      <motion.div
        ref={playerRef}
        key={`${episode}-${sourceIndex}-${retryCount}`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-2 ring-white/10 relative"
      >
        {hasError ? (
          <div className="w-full h-full flex items-center justify-center bg-black/80">
            <div className="text-center p-6">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-red-400/60" />
              </div>
              <p className="text-white/50 text-sm font-medium mb-4">
                {currentSource.name} unavailable
              </p>
              <button
                onClick={switchSource}
                className="px-4 py-2 bg-[#4B5694] hover:bg-[#7288AE] text-white rounded-xl text-xs font-bold transition-all"
              >
                Next Source
              </button>
            </div>
          </div>
        ) : (
          <>
            {showSpinner && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-white/15 border-t-[#7288AE] rounded-full animate-spin mx-auto" />
                </div>
              </div>
            )}
            {currentUrl && (
              <iframe
                ref={iframeRef}
                src={currentUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; microphone"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                title={`${animeTitle} - Episode ${episode}`}
                onLoad={() => { setIsLoading(false); setHasError(false); setShowSpinner(false); setIframeReady(true); }}
                onError={() => {
                  console.warn(`[AnimePlayer] ${currentSource.name} failed to load`);
                  setHasError(true);
                  setIsLoading(false);
                  setShowSpinner(false);
                }}
              />
            )}
          </>
        )}
      </motion.div>

    </div>
  );
}
