"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Server, Maximize2, RotateCcw, SkipForward } from "lucide-react";

interface ProviderSource {
  name: string;
  provider: "vidnest" | "animepahe" | "animeplay" | "vidlink";
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
  onAutoNext?: () => void;
}

const PROVIDERS: ProviderSource[] = [
  { name: "Source 1", provider: "vidnest", color: "from-[#4B5694]/30 to-[#7288AE]/20" },
  { name: "Source 2", provider: "animepahe", color: "from-[#111844]/30 to-[#4B5694]/20" },
  { name: "Source 3", provider: "animeplay", color: "from-[#e63946]/30 to-[#ff6b6b]/20" },
  { name: "Source 4", provider: "vidlink", color: "from-[#6c5ce7]/30 to-[#a29bfe]/20" },
];

export function AnimePlayer({
  animeId,
  malId,
  animeTitle,
  episode,
  rootAnimeId,
  rootMalId,
  episodeOffset,
  onAutoNext
}: AnimePlayerProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isResolving, setIsResolving] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const currentSource = PROVIDERS[sourceIndex] || PROVIDERS[0];
  const nextSourceName = PROVIDERS[(sourceIndex + 1) % PROVIDERS.length]?.name || "";

  useEffect(() => {
    console.log(`[AnimePlayer] Parameters updated: animeId=${animeId}, malId=${malId}, episode=${episode}, rootAnimeId=${rootAnimeId}, rootMalId=${rootMalId}, episodeOffset=${episodeOffset}`);
    setSourceIndex(0);
  }, [animeId, malId, episode, rootAnimeId, rootMalId, episodeOffset]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [episode]);

  // Dynamic URL resolution effect
  useEffect(() => {
    let cancelled = false;

    const resolveUrl = async () => {
      setIsResolving(true);
      setIsLoading(true);
      setHasError(false);

      const params = new URLSearchParams({
        provider: currentSource.provider,
        currentAnilistId: animeId || "",
        currentMalId: malId || "",
        mainAnilistId: rootAnimeId || animeId || "",
        mainMalId: rootMalId || malId || "",
        episode: String(episode),
        episodeOffset: String(episodeOffset || 0)
      });

      try {
        const res = await fetch(`/api/anime/resolve-source?${params.toString()}`);
        if (cancelled) return;
        const data = await res.json();
        if (data.success && data.url) {
          setCurrentUrl(data.url);
        } else {
          throw new Error("Resolution failed");
        }
      } catch (e) {
        if (cancelled) return;
        console.error("[AnimePlayer] URL resolution error:", e);

        // Client-side fallback if server-side resolve API fails
        const absoluteEpisode = (episodeOffset || 0) + episode;
        const currentAnilistClean = animeId?.replace(/\D/g, "") || null;
        let fallbackUrl = "";

        switch (currentSource.provider) {
          case "vidnest":
            fallbackUrl = currentAnilistClean
              ? `https://vidnest.fun/anime/${currentAnilistClean}/${episode}/sub`
              : `https://vidnest.fun/anime/${(rootAnimeId || animeId)?.replace(/\D/g, "")}/${absoluteEpisode}/sub`;
            break;
          case "animepahe":
            fallbackUrl = `https://vidnest.fun/animepahe/${(malId || rootMalId || animeId || rootAnimeId || "").replace(/\D/g, "")}/${episode}/sub`;
            break;
          case "animeplay":
            fallbackUrl = currentAnilistClean
              ? `https://animeplay.cfd/stream/ani/${currentAnilistClean}/${episode}/sub`
              : `https://animeplay.cfd/stream/mal/${(malId || rootMalId || animeId || rootAnimeId || "").replace(/\D/g, "")}/${episode}/sub`;
            break;
          case "vidlink":
            fallbackUrl = `https://vidlink.pro/anime/${(malId || rootMalId || animeId || rootAnimeId || "").replace(/\D/g, "")}/${episode}/sub?fallback=true`;
            break;
        }
        setCurrentUrl(fallbackUrl);
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    };

    resolveUrl();
    return () => {
      cancelled = true;
    };
  }, [sourceIndex, animeId, malId, episode, rootAnimeId, rootMalId, episodeOffset, currentSource]);

  const switchSource = useCallback(() => {
    const next = (sourceIndex + 1) % PROVIDERS.length;
    console.log(`[AnimePlayer] Switching to ${PROVIDERS[next]?.name}`);
    setSourceIndex(next);
  }, [sourceIndex]);

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
            {(isResolving || isLoading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-white/10 border-t-[#7288AE] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-white/50 text-sm font-medium">
                    {isResolving ? "Resolving Stream ID..." : `Loading ${currentSource.name}...`}
                  </p>
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
                onLoad={() => { setIsLoading(false); setHasError(false); }}
                onError={() => {
                  console.warn(`[AnimePlayer] ${currentSource.name} failed to load`);
                  setHasError(true);
                  setIsLoading(false);
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
