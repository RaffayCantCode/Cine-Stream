"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Server, RotateCcw, SkipForward, ChevronRight, Check, Loader2, Play } from "lucide-react";

interface ProviderSource {
  name: string;
  provider: "vidnest" | "animeplay" | "123embed" | "vidlink" | "autoembed";
  color: string;
  quality: "best" | "good" | "backup";
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
  { name: "Source 1", provider: "animeplay", color: "from-[#4B5694]/30 to-[#7288AE]/20", quality: "best" },
  { name: "Source 2", provider: "vidnest",   color: "from-[#e63946]/30 to-[#ff6b6b]/20", quality: "best" },
  { name: "Source 3", provider: "vidlink",   color: "from-[#111844]/30 to-[#4B5694]/20", quality: "good" },
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
      return `https://vidlink.pro/anime/${malId_ || aniId || ""}/${ep}/sub?primaryColor=4b5694&autoplay=true${timeParam}`;
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

/** How long to wait for an embed to signal it started playing before falling back. */
const PLAYBACK_DETECT_TIMEOUT = 5000;

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
  const effectiveAnimeId = rootAnimeId || animeId;
  const sourcePrefKey = `sv_src_anime_${userId}_${effectiveAnimeId}`;
  const globalPrefKey = `sv_src_global_${userId}_anime`;

  const [sourceIndex, setSourceIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(sourcePrefKey) || localStorage.getItem(globalPrefKey);
      if (saved !== null && !forcedSource) {
        // Key is now provider string (e.g. "animeplay", "vidnest")
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
    setShowSources(false);
    setRetryCount(0);
    setIframeReady(false);
    setNeedsClickUnlock(false);
    try {
      localStorage.setItem(sourcePrefKey, provider);
      localStorage.setItem(globalPrefKey, provider);
    } catch {}
  };

  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showSpinner, setShowSpinner] = useState(true);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);
  // Set when the embed confirmed playback (postMessage signal) — the embed
  // loaded but never started playing (e.g. autoplay needs a user gesture).
  const [needsClickUnlock, setNeedsClickUnlock] = useState(false);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [unlockAttempts, setUnlockAttempts] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackStartedRef = useRef(false);
  const currentSource = PROVIDERS[sourceIndex] || PROVIDERS[0];
  const nextSourceName = PROVIDERS[(sourceIndex + 1) % PROVIDERS.length]?.name || "";
  const isAnimeplay = currentSource.provider === "animeplay";

  const cancelDetectionTimer = useCallback(() => {
    if (detectTimerRef.current) {
      clearTimeout(detectTimerRef.current);
      detectTimerRef.current = null;
    }
  }, []);

  const markPlaybackStarted = useCallback(() => {
    playbackStartedRef.current = true;
    setPlaybackStarted(true);
    setNeedsClickUnlock(false);
    setIsLoading(false);
    setShowSpinner(false);
    cancelDetectionTimer();
  }, [cancelDetectionTimer]);

  // Auto-dismiss spinner (non-animeplay sources). The animeplay spinner is
  // dismissed by real playback detection so the user never stares at a black frame.
  useEffect(() => {
    if (isAnimeplay) return;
    setShowSpinner(true);
    const spinnerTimer = setTimeout(() => setShowSpinner(false), 2500);
    return () => { clearTimeout(spinnerTimer); };
  }, [currentUrl, isLoading, isAnimeplay]);

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
    return () => { links.forEach(link => link.remove()); };
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
    setNeedsClickUnlock(false);
    setUnlockAttempts(0);
  }, [animeId, malId, episode, rootAnimeId, rootMalId, episodeOffset, tmdbId, tmdbSeason, isMovie]);

  // When the source index or retry count changes, load the embed immediately and
  // start playback detection. If the embed never reports playback (e.g. Source 1
  // blocks autoplay without a user gesture), the tap-to-play overlay appears.
  useEffect(() => {
    const url = resolvedUrls[currentSource.provider];
    if (!url) return;

    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    cancelDetectionTimer();

    playbackStartedRef.current = false;
    setPlaybackStarted(false);
    setNeedsClickUnlock(false);
    setIsLoading(true);
    setHasError(false);
    setCurrentUrl(url);
    setIframeReady(false);

    detectTimerRef.current = setTimeout(() => {
      if (playbackStartedRef.current) return;
      if (currentSource.provider === "animeplay") {
        // Gesture-restricted embed: offer a tap-to-play button instead of a black frame.
        setNeedsClickUnlock(true);
        setIsLoading(false);
        setShowSpinner(false);
      } else {
        // Any other source that never reports ready is treated as failed.
        setHasError(true);
        setIsLoading(false);
        setShowSpinner(false);
      }
    }, PLAYBACK_DETECT_TIMEOUT);
  }, [sourceIndex, resolvedUrls, retryCount, cancelDetectionTimer]);

  // After the user taps to play (animeplay), remount the iframe inside the
  // user gesture so autoplay is permitted, then re-run detection. If it still
  // stays silent, surface the error state instead of looping the overlay.
  useEffect(() => {
    if (unlockAttempts === 0) return;
    playbackStartedRef.current = false;
    setPlaybackStarted(false);
    setIframeReady(false);
    setIsLoading(true);
    setShowSpinner(true);

    detectTimerRef.current = setTimeout(() => {
      if (playbackStartedRef.current) return;
      setHasError(true);
      setIsLoading(false);
      setShowSpinner(false);
    }, PLAYBACK_DETECT_TIMEOUT);
  }, [unlockAttempts]);

  const handleClickUnlock = useCallback(() => {
    setNeedsClickUnlock(false);
    setUnlockAttempts(a => a + 1);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      cancelDetectionTimer();
    };
  }, [cancelDetectionTimer]);

  // Scroll player into view on episode change
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

  const lastSaveTimeRef = useRef<number>(0);
  const autoPlayTriggeredRef = useRef(false);

  // Listen to postMessage for progress + playback-detection events:
  // - VidLink emits video.ended / video.next / video.progress
  // - MegaPlay (animeplay) emits { event: "time" | "complete" | "error" } and
  //   { type: "watching-log", currentTime, duration }
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      const data = event.data as Record<string, any>;

      // ── MegaPlay playback signals ────────────────────────────────────────
      const mpTime =
        data.event === "time" && typeof data.time === "number"
          ? (data.time as number)
          : data.type === "watching-log" && typeof data.currentTime === "number"
            ? (data.currentTime as number)
            : null;
      const mpDuration =
        typeof data.duration === "number"
          ? (data.duration as number)
          : null;

      if (mpTime !== null) {
        markPlaybackStarted();

        if (typeof mpTime === "number") {
          if (onProgress) onProgress(mpTime);

          if (mpDuration && mpDuration > 0 && mpTime >= mpDuration - 2) {
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
                  progress: Math.floor(mpTime),
                  duration: Math.floor(mpDuration || 0)
                })
              }).catch(() => {});
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
        setShowSpinner(false);
        cancelDetectionTimer();
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
  }, [animeId, episode, tmdbSeason, onProgress, onAutoNext, markPlaybackStarted, cancelDetectionTimer]);

  // Only send seek/play postMessages for VidLink — others don't support it
  useEffect(() => {
    if (iframeReady && iframeRef.current?.contentWindow && startProgress !== undefined && currentSource.provider === "vidlink") {
      iframeRef.current.contentWindow.postMessage({ type: "player.seek", data: startProgress }, "*");
      iframeRef.current.contentWindow.postMessage({ type: "player.play" }, "*");
    }
  }, [startProgress, forceReloadCount, iframeReady, currentSource.provider]);

  const switchSource = useCallback(() => {
    setSourceIndex(prev => {
      const next = (prev + 1) % PROVIDERS.length;
      try {
        localStorage.setItem(sourcePrefKey, PROVIDERS[next].provider);
        localStorage.setItem(globalPrefKey, PROVIDERS[next].provider);
      } catch {}
      return next;
    });
    setRetryCount(0);
    setIframeReady(false);
    setNeedsClickUnlock(false);
  }, [sourcePrefKey, globalPrefKey]);

  const retrySource = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setIframeReady(false);
    setNeedsClickUnlock(false);
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

  // Keep the animeplay frame hidden until the player confirms playback, so a
  // gesture-restricted embed can never flash a black screen.
  const hideUntilPlaying = isAnimeplay && !playbackStarted && !needsClickUnlock && !hasError;

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
            {currentSource?.quality && (
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] leading-none ${QUALITY_STYLES[currentSource.quality]}`}>
                {currentSource.quality}
              </span>
            )}
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
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] leading-none ${QUALITY_STYLES[source.quality]}`}>
                  {source.quality}
                </span>
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
        ) : needsClickUnlock ? (
          // ── Tap-to-play fallback (shown only when the embed loaded but
          //    never started playback, e.g. gesture-restricted autoplay) ──
          // Clicking remounts the iframe inside the user gesture, which lets
          // the browser allow autoplay and prevents the black screen.
          <button
            onClick={handleClickUnlock}
            className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black group"
            aria-label={`Tap to start ${currentSource.name}`}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-200 ring-4 ring-primary/20">
              <Play className="w-9 h-9 text-white fill-white ml-1" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-base">Tap to Play</p>
              <p className="text-white/40 text-xs mt-1">{currentSource.name} • Tap to start</p>
            </div>
          </button>
        ) : (
          <>
            {showSpinner && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                <div className="w-10 h-10 border-3 border-white/15 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {currentUrl && (
              <iframe
                key={`${currentSource.provider}-${retryCount}-${unlockAttempts}`}
                ref={iframeRef}
                src={currentUrl}
                className={`w-full h-full transition-opacity duration-500 ${
                  hideUntilPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; microphone"
                allowFullScreen
                referrerPolicy={isAnimeplay ? "no-referrer-when-downgrade" : "strict-origin-when-cross-origin"}
                title={`${animeTitle} - Episode ${episode}`}
                onLoad={() => {
                  setIsLoading(false);
                  setHasError(false);
                  setIframeReady(true);
                  if (!isAnimeplay) {
                    // Non-gesture sources are ready once their frame loads.
                    setShowSpinner(false);
                    playbackStartedRef.current = true;
                    setPlaybackStarted(true);
                    cancelDetectionTimer();
                  }
                }}
                onError={() => {
                  console.warn(`[AnimePlayer] ${currentSource.name} failed to load`);
                  setHasError(true);
                  setIsLoading(false);
                  setShowSpinner(false);
                  cancelDetectionTimer();
                }}
              />
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
