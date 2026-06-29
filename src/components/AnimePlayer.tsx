"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Server, Maximize2, RotateCcw, SkipForward } from "lucide-react";

interface ProviderSource {
  name: string;
  provider: "vidnest" | "animeplay" | "vidlink" | "embedsu";
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
  startProgress?: number;
  onAutoNext?: () => void;
}

const PROVIDERS: ProviderSource[] = [
  { name: "Source 1", provider: "animeplay", color: "from-[#e63946]/30 to-[#ff6b6b]/20" },
  { name: "Source 2", provider: "vidnest", color: "from-[#4B5694]/30 to-[#7288AE]/20" },
  { name: "Source 3", provider: "vidlink", color: "from-[#111844]/30 to-[#4B5694]/20" },
  { name: "Source 4", provider: "embedsu", color: "from-[#2d6a4f]/30 to-[#40916c]/20" },
];

// Build a provider embed URL entirely client-side — no server round-trip needed
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
  startProgress?: number
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
      return malId_
        ? `https://animeplay.cfd/stream/mal/${malId_}/${ep}/sub`
        : `https://animeplay.cfd/stream/ani/${aniId || ""}/${ep}/sub`;
    case "vidlink":
      const timeParam = startProgress && startProgress > 0 ? `&t=${startProgress}` : "";
      return tmdbId
        ? `https://vidlink.pro/tv/${tmdbId}/${tmdbSeason || 1}/${absEp}?primaryColor=4b5694&autoplay=false${timeParam}`
        : `https://vidlink.pro/anime/${malId_ || aniId || ""}/${ep}/sub?primaryColor=4b5694&autoplay=false&fallback=true${timeParam}`;
    case "embedsu":
      return tmdbId
        ? `https://embed.su/embed/tv/${tmdbId}/${tmdbSeason || 1}/${absEp}`
        : `https://embed.su/embed/tv/${malId_ || aniId || ""}`;
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
  startProgress,
  onAutoNext
}: AnimePlayerProps) {
  const sourcePrefKey = `sv_src_anime_${animeId}`;

  const [sourceIndex, setSourceIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(sourcePrefKey);
      if (saved !== null) {
        // Support both name-based (new) and index-based (legacy) saved values
        const byName = PROVIDERS.findIndex(p => p.name === saved);
        if (byName >= 0) return byName;
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < PROVIDERS.length) return idx;
      }
    } catch {}
    return 0;
  });

  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showSpinner, setShowSpinner] = useState(true);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const currentSource = PROVIDERS[sourceIndex] || PROVIDERS[0];
  const nextSourceName = PROVIDERS[(sourceIndex + 1) % PROVIDERS.length]?.name || "";

  // Auto-dismiss spinner after 3.5 seconds to prevent frozen overlay
  useEffect(() => {
    setShowSpinner(true);
    const timer = setTimeout(() => {
      setShowSpinner(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentUrl]);

  // Preconnect to all embed provider domains so iframe DNS + TCP + TLS starts early
  useEffect(() => {
    const domains = [
      "https://animeplay.cfd",
      "https://vidnest.fun",
      "https://vidlink.pro",
      "https://embed.su"
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

  // Pre-resolve ALL provider URLs client-side — instant, no server round-trip
  useEffect(() => {
    const urls: Record<string, string> = {};
    PROVIDERS.forEach(p => {
      urls[p.provider] = buildProviderUrl(
        p.provider, animeId, malId, rootAnimeId, rootMalId,
        episode, episodeOffset || 0, tmdbId, tmdbSeason, startProgress
      );
    });
    setResolvedUrls(urls);
    setRetryCount(0);
    setIsLoading(true);
    setHasError(false);
  }, [animeId, malId, episode, rootAnimeId, rootMalId, episodeOffset, tmdbId, tmdbSeason, startProgress]);

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

  // Listen to postMessage for progress updates (e.g., from VidLink)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      
      if (event.data.type === 'video.progress' && event.data.data) {
        const { time, duration } = event.data.data;
        if (typeof time === 'number') {
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
  }, [animeId, episode, tmdbSeason]);



  const switchSource = useCallback(() => {
    setSourceIndex(prev => {
      const next = (prev + 1) % PROVIDERS.length;
      try { localStorage.setItem(sourcePrefKey, PROVIDERS[next].name); } catch {}
      return next;
    });
    setRetryCount(0);
  }, [sourcePrefKey]);


  const retrySource = useCallback(() => {
    setRetryCount(prev => prev + 1);
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
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10">
            <span className="text-xs font-bold text-white/85">{currentSource.name}</span>
          </div>
          {hasError && (
            <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-lg font-bold">
              Failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={switchSource}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-[#4B5694] border border-white/10 hover:border-[#7288AE]/40 text-white/80 hover:text-white text-xs font-bold transition-all"
            title={`Next source: ${nextSourceName}`}
          >
            <SkipForward className="w-4 h-4" />
            Next Source
          </button>
          <button onClick={retrySource} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all" title="Retry current source">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

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
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                title={`${animeTitle} - Episode ${episode}`}
                onLoad={() => { setIsLoading(false); setHasError(false); setShowSpinner(false); }}
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

      {/* SOURCES SELECTOR */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#7288AE]" />
            <span className="text-xs font-semibold text-white/90">Select Streaming Server</span>
          </div>
          <span className="text-[10px] text-white/45 font-medium">
            If stream fails, click another server below
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROVIDERS.map((source, index) => {
            const isActive = sourceIndex === index;
            return (
              <button
                key={source.name}
                onClick={() => {
                  setSourceIndex(index);
                  try { localStorage.setItem(sourcePrefKey, source.name); } catch {}
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-xs font-medium ${
                  isActive
                    ? `bg-gradient-to-r ${source.color} border-[#7288AE]/30 text-white shadow-lg shadow-[#7288AE]/5`
                    : "bg-white/[0.04] hover:bg-white/[0.08] border-white/5 hover:border-white/10 text-white/70 hover:text-white"
                }`}
              >
                <span className="truncate">{source.name}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7288AE] animate-pulse shrink-0 ml-1.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-white/20">
        <span>Select a source above if the stream takes too long to load</span>
        <button onClick={switchSource} className="text-white/30 hover:text-[#7288AE] transition-colors">
          Next Source ({nextSourceName})
        </button>
      </div>
    </div>
  );
}
