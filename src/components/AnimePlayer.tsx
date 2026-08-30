"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Server, RotateCcw, SkipForward, ChevronRight, Check, Loader2, Maximize2, Minimize2, Tv, Play, AlertTriangle } from "lucide-react";
import { fetchSourceConfig, SOURCE_TAG_LABELS, TAG_STYLES, type SourceTag } from "@/lib/streaming-config";

interface ProviderSource {
  name: string;
  provider: "animeplay" | "vidnest" | "vidlink" | "123embed" | "autoembed" | "megaplay" | "animepahe";
  color: string;
  quality: "best" | "good" | "backup";
  tag?: SourceTag;
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
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
}

const PROVIDERS: ProviderSource[] = [
  { name: "Source 1", provider: "animeplay", color: "from-[#4B5694]/30 to-[#7288AE]/20", quality: "best" },
  { name: "Source 2", provider: "vidnest",   color: "from-[#e63946]/30 to-[#ff6b6b]/20", quality: "best" },
  { name: "Source 3", provider: "vidlink",   color: "from-[#111844]/30 to-[#4B5694]/20", quality: "best" },
  { name: "Source 4", provider: "123embed",  color: "from-[#2d6a4f]/30 to-[#40916c]/20", quality: "good" },
  { name: "Source 5", provider: "autoembed", color: "from-[#f43f5e]/30 to-[#fb7185]/20", quality: "backup" },
];

const QUALITY_STYLES: Record<string, string> = {
  best:   "bg-emerald-400/15 text-emerald-300 border-emerald-300/25",
  good:   "bg-cyan-400/15 text-cyan-300 border-cyan-300/25",
  backup: "bg-amber-400/15 text-amber-300 border-amber-300/25",
};

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
  isMovie?: boolean,
  retryAttempt?: number
): string {
  // Extract numeric digits from IDs
  const cleanNumeric = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const digits = id.replace(/\D/g, "");
    return digits || null;
  };

  const curAni = cleanNumeric(animeId);
  const curMal = cleanNumeric(malId);
  const mainAni = cleanNumeric(rootAnimeId) || curAni;
  const isSequel = Boolean(curAni && mainAni && curAni !== mainAni);
  const absEp = (episodeOffset || 0) + episode;
  const aniId = curAni || mainAni;
  const malClean = cleanNumeric(rootMalId) || curMal;
  const hasOwnMal = Boolean(curMal && curMal !== malClean);
  const malId_ = hasOwnMal ? (isSequel ? curMal : malClean) : (curMal || malClean);
  
  // Safe primaryId: prioritize numeric AniList ID, then MAL ID, then raw digits
  let primaryId = aniId || malId_ || "";
  if (!primaryId && typeof window !== "undefined") {
    const match = window.location.pathname.match(/\/anime\/(\d+)/);
    if (match?.[1]) primaryId = match[1];
  }

  switch (provider) {
    case "animeplay": {
      if (!primaryId) return "";
      const attempt = retryAttempt || 0;
      const mirrors = [
        `https://megaplay.buzz/stream/ani/${primaryId}/${episode}/sub`,
        `https://megaplay.buzz/embed/anime/${primaryId}/${episode}/sub`,
        `https://vidnest.fun/animepahe/${primaryId}/${episode}/sub`,
      ];
      return mirrors[attempt % mirrors.length];
    }
    case "vidnest":
    case "megaplay":
      return primaryId
        ? `https://vidnest.fun/anime/${primaryId}/${episode}/sub`
        : "";
    case "animepahe":
      return primaryId
        ? `https://vidnest.fun/animepahe/${primaryId}/${episode}/sub`
        : "";
    case "123embed":
      if (tmdbId) {
        return isMovie
          ? `https://play2.123embed.net/movie/${tmdbId}`
          : `https://play2.123embed.net/tv/${tmdbId}/${tmdbSeason || 1}/${absEp}`;
      }
      return primaryId ? `https://vidnest.fun/anime/${primaryId}/${episode}/sub` : "";
    case "vidlink": {
      const timeParam = startProgress && startProgress > 0 ? `&t=${startProgress}` : "";
      if (tmdbId) {
        return isMovie
          ? `https://vidlink.pro/movie/${tmdbId}?primaryColor=4b5694&autoplay=true${timeParam}`
          : `https://vidlink.pro/tv/${tmdbId}/${tmdbSeason || 1}/${absEp}?primaryColor=4b5694&autoplay=true${timeParam}`;
      }
      if (primaryId) {
        return `https://vidlink.pro/anime/${primaryId}/${episode}/sub?primaryColor=4b5694&autoplay=true${timeParam}`;
      }
      return "";
    }
    case "autoembed":
      if (tmdbId) {
        return isMovie
          ? `https://player.autoembed.co/embed/movie/${tmdbId}`
          : `https://player.autoembed.co/embed/tv/${tmdbId}/${tmdbSeason || 1}-${absEp}`;
      }
      return primaryId ? `https://vidnest.fun/anime/${primaryId}/${episode}/sub` : "";
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
  forceReloadCount,
  isTheaterMode,
  onToggleTheater
}: AnimePlayerProps) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id || "guest";
  const effectiveAnimeId = rootAnimeId || animeId;
  const sourcePrefKey = `sv_src_anime_${userId}_${effectiveAnimeId}`;
  const globalPrefKey = `sv_src_global_${userId}_anime`;

  const [providerConfig, setProviderConfig] = useState<{ key: string; tag: SourceTag }[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchSourceConfig().then((cfg) => {
      if (active) setProviderConfig(cfg.anime);
    });
    return () => { active = false; };
  }, []);

  // Effective provider list: admin order/tags when configured, else defaults.
  const providers = useMemo<ProviderSource[]>(() => {
    if (!providerConfig) return PROVIDERS.map((p, i) => ({ ...p, name: `Source ${i + 1}` }));
    const byKey = new Map<string, ProviderSource>(PROVIDERS.map((p) => [p.provider, p]));
    const ordered: ProviderSource[] = [];
    providerConfig.forEach((entry) => {
      const base = byKey.get(entry.key);
      if (base) ordered.push({ ...base, tag: entry.tag });
    });
    PROVIDERS.forEach((p) => {
      if (!ordered.find((o) => o.provider === p.provider)) ordered.push(p);
    });
    return ordered.map((p, index) => ({
      ...p,
      name: `Source ${index + 1}`,
    }));
  }, [providerConfig]);

  const [sourceIndex, setSourceIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(sourcePrefKey) || localStorage.getItem(globalPrefKey);
      if (saved !== null && !forcedSource) {
        // Key is now provider string (e.g. "animepahe", "vidnest")
        const byProvider = PROVIDERS.findIndex(p => p.provider === saved);
        if (byProvider >= 0) return byProvider;
        // Legacy: index-based fallback
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < PROVIDERS.length) return idx;
      }
    } catch {}
    return 0;
  });
  const [isSourceLoaded, setIsSourceLoaded] = useState(false);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    if (status === "loading" || isSourceLoaded) return;
    try {
      const saved = localStorage.getItem(sourcePrefKey) || localStorage.getItem(globalPrefKey);
      if (saved !== null && !forcedSource) {
        const byProvider = PROVIDERS.findIndex(p => p.provider === saved);
        if (byProvider >= 0) setSourceIndex(byProvider);
        else {
          const idx = parseInt(saved, 10);
          if (!isNaN(idx) && idx >= 0 && idx < PROVIDERS.length) setSourceIndex(idx);
        }
      }
    } catch {}
    setIsSourceLoaded(true);
  }, [status, sourcePrefKey, globalPrefKey, isSourceLoaded, forcedSource]);

  useEffect(() => {
    if (forcedSource) {
      // Match by provider string or display name for backwards compatibility
      const byProvider = PROVIDERS.findIndex(p => p.provider === forcedSource || p.name === forcedSource);
      if (byProvider >= 0) {
        setSourceIndex(byProvider);
        setRetryCount(prev => prev + 1);
      }
    } else if (forceReloadCount) {
      setRetryCount(prev => prev + 1);
    }
  }, [forcedSource, forceReloadCount]);

  const handleSourceChange = (index: number, provider: string) => {
    setSourceIndex(index);
    setHasError(false);
    setIsLoading(true);
    setBlackScreenWarning(false);
    playbackStartedRef.current = false;
    setShowSources(false);
    setRetryCount(0);
    setIframeReady(false);
    setNeedsClickUnlock(false);
    setLiveIframeSrc("");
    try {
      localStorage.setItem(sourcePrefKey, provider);
      localStorage.setItem(globalPrefKey, provider);
    } catch {}
  };

  const [currentUrl, setCurrentUrl] = useState("");
  const [liveIframeSrc, setLiveIframeSrc] = useState("");
  const [needsClickUnlock, setNeedsClickUnlock] = useState(false);
  const [blackScreenWarning, setBlackScreenWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const playbackStartedRef = useRef(false);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blackScreenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentProviderRef = useRef<string>(PROVIDERS[0]?.provider || "animeplay");
  useEffect(() => {
    const p = providers[sourceIndex];
    if (p) currentProviderRef.current = p.provider;
  }, [sourceIndex, providers]);

  // Apply the admin-configured provider order once loaded, keeping the
  // currently selected provider selected (by type) so playback isn't disturbed.
  useEffect(() => {
    if (!providerConfig) return;
    setSourceIndex((prev) => {
      const current = providers[prev] || providers[0];
      const want = current?.provider || providers[0]?.provider;
      const idx = providers.findIndex((p) => p.provider === want);
      return idx >= 0 && idx !== prev ? idx : prev;
    });
  }, [providerConfig, providers]);

  const currentSource = providers[sourceIndex] || providers[0];
  const nextSourceName = providers[(sourceIndex + 1) % providers.length]?.name || "";

  const markPlaybackStarted = useCallback(() => {
    playbackStartedRef.current = true;
    setIsLoading(false);
    setBlackScreenWarning(false);
    if (blackScreenTimerRef.current) {
      clearTimeout(blackScreenTimerRef.current);
      blackScreenTimerRef.current = null;
    }
  }, []);

  // When user clicks the unlock overlay for Source 1, inject the src with a tiny delay
  // so the iframe is fully mounted and the click event serves as the user gesture for autoplay
  const handleClickUnlock = useCallback(() => {
    setNeedsClickUnlock(false);
    const url = resolvedUrls["animeplay"] || currentUrl;
    if (url) {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      delayTimerRef.current = setTimeout(() => {
        setLiveIframeSrc(url);
      }, 50);
    }
  }, [resolvedUrls, currentUrl]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (blackScreenTimerRef.current) clearTimeout(blackScreenTimerRef.current);
    };
  }, []);

  // Watchdog: detect if an active stream is stuck on a black screen or unresponsive
  useEffect(() => {
    setBlackScreenWarning(false);
    if (blackScreenTimerRef.current) {
      clearTimeout(blackScreenTimerRef.current);
      blackScreenTimerRef.current = null;
    }

    const activeUrl = currentSource.provider === "animeplay" ? liveIframeSrc : currentUrl;
    if (activeUrl && !playbackStartedRef.current && !needsClickUnlock) {
      blackScreenTimerRef.current = setTimeout(() => {
        if (!playbackStartedRef.current) {
          console.warn("[AnimePlayer] Black screen or unresponsiveness detected, prompting reset");
          setBlackScreenWarning(true);
        }
      }, 4500);
    }

    return () => {
      if (blackScreenTimerRef.current) clearTimeout(blackScreenTimerRef.current);
    };
  }, [liveIframeSrc, currentUrl, currentSource.provider, retryCount, needsClickUnlock]);

  // Preconnect to all embed provider domains so iframe DNS + TCP + TLS starts early
  useEffect(() => {
    const domains = [
      "https://vidnest.fun",
      "https://vidlink.pro",
      "https://player.autoembed.co",
      "https://play2.123embed.net",
      "https://megaplay.buzz"
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
    return () => { links.forEach(link => link.remove()); };
  }, []);

  const initialProgressRef = useRef(startProgress);

  // Pre-resolve all provider URLs so switching is instant
  useEffect(() => {
    const urls: Record<string, string> = {};
    providers.forEach(p => {
      urls[p.provider] = buildProviderUrl(
        p.provider, animeId, malId, rootAnimeId, rootMalId,
        episode, episodeOffset || 0, tmdbId, tmdbSeason, initialProgressRef.current, isMovie, retryCount
      );
    });
    setResolvedUrls(urls);
    setIsLoading(true);
    setHasError(false);
    setIframeReady(false);
  }, [animeId, malId, episode, rootAnimeId, rootMalId, episodeOffset, tmdbId, tmdbSeason, isMovie, providers, retryCount]);

  // When the source index or retry count changes, load the embed.
  useEffect(() => {
    const url = resolvedUrls[currentSource.provider] || buildProviderUrl(
      currentSource.provider, animeId, malId, rootAnimeId, rootMalId,
      episode, episodeOffset || 0, tmdbId, tmdbSeason, initialProgressRef.current, isMovie, retryCount
    );
    if (!url) return;

    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    playbackStartedRef.current = false;
    setIsLoading(true);
    setHasError(false);
    setCurrentUrl(url);
    setIframeReady(false);

    if (currentSource.provider === "animeplay") {
      setNeedsClickUnlock(true);
      setLiveIframeSrc("");
    } else {
      setNeedsClickUnlock(false);
      setLiveIframeSrc(url);
    }
  }, [sourceIndex, resolvedUrls, retryCount, currentSource.provider, animeId, malId, rootAnimeId, rootMalId, episode, episodeOffset, tmdbId, tmdbSeason, isMovie, providers]);

  // Scroll player into view on episode change
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

  const autoPlayTriggeredRef = useRef(false);

  // Listen to postMessage for progress + playback-detection events:
  // - VidLink emits video.ended / video.next / video.progress
  // - VidNest / AnimePahe embeds emit { event: "time" | "complete" | "error" }
  //   and { type: "watching-log", currentTime, duration }
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      const data = event.data as Record<string, any>;

      // ── VidNest playback signals ────────────────────────────────────────
      const vidTime =
        data.event === "time" && typeof data.time === "number"
          ? (data.time as number)
          : data.type === "watching-log" && typeof data.currentTime === "number"
            ? (data.currentTime as number)
            : null;
      const vidDuration =
        typeof data.duration === "number"
          ? (data.duration as number)
          : null;

      if (vidTime !== null) {
        markPlaybackStarted();

        if (typeof vidTime === "number") {
          if (onProgress) onProgress(vidTime);

          if (vidDuration && vidDuration > 0 && vidTime >= vidDuration - 2) {
            if (onAutoNext && !autoPlayTriggeredRef.current) {
              autoPlayTriggeredRef.current = true;
              onAutoNext();
            }
          }
        }
      }

      if (data.event === "complete") {
        markPlaybackStarted();
        if (onProgress) onProgress(999999);
        if (onAutoNext && !autoPlayTriggeredRef.current) {
          autoPlayTriggeredRef.current = true;
          onAutoNext();
        }
      }

      if (data.event === "error") {
        setHasError(true);
        setIsLoading(false);
      }

      // ── VidLink events ───────────────────────────────────────────────────
      if (data.type === 'video.ended' || data.type === 'video.next') {
        if (onProgress && (data.type as any) === 'video.ended') onProgress(999999);
        if (onAutoNext && !autoPlayTriggeredRef.current) {
          autoPlayTriggeredRef.current = true;
          onAutoNext();
        }
      }

      if (data.type === 'video.progress' && data.data) {
        const { time, duration } = data.data;
        if (typeof time === 'number') {
          if (onProgress) onProgress(time);

          if (typeof duration === 'number' && duration > 0 && time >= duration - 2) {
            if (onAutoNext && !autoPlayTriggeredRef.current) {
              autoPlayTriggeredRef.current = true;
              onAutoNext();
            }
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [animeId, episode, tmdbSeason, onProgress, onAutoNext, markPlaybackStarted]);

  // Only send seek/play postMessages for VidLink — others don't support it
  useEffect(() => {
    if (iframeReady && iframeRef.current?.contentWindow && startProgress !== undefined && currentSource.provider === "vidlink") {
      iframeRef.current.contentWindow.postMessage({ type: "player.seek", data: startProgress }, "*");
      iframeRef.current.contentWindow.postMessage({ type: "player.play" }, "*");
    }
  }, [startProgress, forceReloadCount, iframeReady, currentSource.provider]);

  const switchSource = useCallback(() => {
    setSourceIndex(prev => {
      const next = (prev + 1) % providers.length;
      try {
        localStorage.setItem(sourcePrefKey, providers[next].provider);
        localStorage.setItem(globalPrefKey, providers[next].provider);
      } catch {}
      return next;
    });
    setHasError(false);
    setIsLoading(true);
    setRetryCount(0);
    setIframeReady(false);
    setNeedsClickUnlock(false);
    setLiveIframeSrc("");
  }, [sourcePrefKey, globalPrefKey, providers]);

  const retrySource = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setBlackScreenWarning(false);
    playbackStartedRef.current = false;
    setIframeReady(false);
    setLiveIframeSrc("");
    setRetryCount(prev => prev + 1);
    if (currentSource.provider === "animeplay") {
      setNeedsClickUnlock(true);
    }
  }, [currentSource.provider]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "t" || e.key === "T") {
        onToggleTheater?.();
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
            className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r ${currentSource.color} border border-white/10 text-white text-xs font-bold transition-all hover:opacity-90 shadow-md cursor-pointer shrink-0`}
          >
            <Server className="w-3.5 h-3.5 shrink-0 text-white/90" />
            <span className="font-bold">{currentSource.name}</span>
            {currentSource?.tag ? (
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${TAG_STYLES[currentSource.tag] || TAG_STYLES.good}`}>
                {SOURCE_TAG_LABELS[currentSource.tag] || currentSource.tag}
              </span>
            ) : currentSource?.quality ? (
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${QUALITY_STYLES[currentSource.quality]}`}>
                {currentSource.quality}
              </span>
            ) : null}
            <ChevronRight className={`w-3.5 h-3.5 text-white/70 transition-transform ${showSources ? "rotate-90" : ""}`} />
          </button>
          {providers.length > 1 && (
            <button
              onClick={switchSource}
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
            onClick={retrySource}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white/75 hover:text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Reload video player"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

      {blackScreenWarning && !hasError && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Black screen or stream not playing?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={retrySource}
              className="px-3 py-1.5 bg-amber-500/25 hover:bg-amber-500/40 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Source
            </button>
            {providers.length > 1 && (
              <button
                onClick={switchSource}
                className="px-3 py-1.5 bg-[#4B5694] hover:bg-[#7288AE] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" /> Switch Source
              </button>
            )}
          </div>
        </div>
      )}

      {showSources && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-4 rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/10 shadow-2xl animate-fade-in-up"
          style={{ animationDuration: "0.2s" }}
        >
          {providers.map((source, index) => {
            const isActive = sourceIndex === index;
            return (
              <button
                key={source.provider}
                onClick={() => handleSourceChange(index, source.provider)}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${source.color} border border-white/10 text-white shadow-lg`
                    : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                }`}
              >
                <Server className={`w-4 h-4 shrink-0 ${isActive ? "" : "text-white/30"}`} />
                <span className="flex-1 text-left">{source.name}</span>
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] leading-none ${source.tag ? (TAG_STYLES[source.tag] || TAG_STYLES.good) : QUALITY_STYLES[source.quality]}`}>
                  {source.tag ? (SOURCE_TAG_LABELS[source.tag] || source.tag) : source.quality}
                </span>
                {isActive && !isLoading && !hasError && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                {isActive && isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={playerRef}
        className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black ring-1 ring-white/10 relative"
      >
        {hasError ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black">
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <RotateCcw className="w-10 h-10 text-red-400/60" />
              </div>
              <p className="text-white/60 text-sm mb-5 font-medium">
                {currentSource.name} failed to load
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={retrySource}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Try Again
                </button>
                {providers.length > 1 && (
                  <button
                    onClick={switchSource}
                    className="px-5 py-2.5 bg-[#4B5694] hover:bg-[#7288AE] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <SkipForward className="w-4 h-4" /> Next Source
                  </button>
                )}
                <button
                  onClick={() => setShowSources(true)}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <Server className="w-4 h-4" /> Browse All
                </button>
              </div>
            </div>
          </div>
        ) : needsClickUnlock ? (
          <button
            onClick={handleClickUnlock}
            className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-black/80 via-black/95 to-black group cursor-pointer select-none"
            aria-label="Click to start Source 1"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4B5694] to-[#7288AE] flex items-center justify-center shadow-2xl shadow-[#4B5694]/40 group-hover:scale-110 active:scale-95 transition-transform duration-200 ring-4 ring-[#7288AE]/30">
              <Play className="w-9 h-9 text-white fill-white ml-1" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-bold text-base tracking-wide">Click to Play</p>
              <p className="text-white/40 text-xs">Source 1 • Tap to start playback</p>
            </div>
          </button>
        ) : (
          (currentSource.provider === "animeplay" ? liveIframeSrc : currentUrl) && (
            <iframe
              key={`${currentSource.provider}-${retryCount}`}
              ref={iframeRef}
              src={currentSource.provider === "animeplay" ? liveIframeSrc : currentUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen *; gyroscope; picture-in-picture; web-share; microphone"
              allowFullScreen={true}
              referrerPolicy="no-referrer-when-downgrade"
              title={`${animeTitle} - Episode ${episode}`}
              onLoad={() => {
                setIsLoading(false);
                setHasError(false);
                setIframeReady(true);
                playbackStartedRef.current = true;
              }}
              onError={() => {
                console.warn(`[AnimePlayer] ${currentSource.name} failed to load`);
                setHasError(true);
                setIsLoading(false);
              }}
            />
          )
        )}
      </div>
    </div>
  );
}
