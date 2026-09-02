"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import Hls from "hls.js";
import { Loader2, AlertCircle } from "lucide-react";

export interface SubtitleTrack {
  id: number;
  label: string;
  lang: string;
  url?: string;
}

export interface QualityLevel {
  id: number;
  height: number;
  label: string;
  bitrate: number;
}

export interface AudioTrack {
  id: number;
  label: string;
  lang: string;
}

interface NativeHlsPlayerProps {
  mediaType?: "movie" | "tv" | "anime";
  mediaId?: number | string;
  season?: number;
  episode?: number;
  directSrc?: string;
  poster?: string;
  title?: string;
  startProgress?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  playbackRate?: number;
  subtitleSettings?: {
    fontSize?: string;
    fontColor?: string;
    bgColor?: string;
    bgOpacity?: number;
  };
  selectedSubtitleId?: number;
  onQualitiesLoaded?: (qualities: QualityLevel[]) => void;
  onSubtitlesLoaded?: (subtitles: SubtitleTrack[]) => void;
  onAudioTracksLoaded?: (audioTracks: AudioTrack[]) => void;
  fallbackIframeUrl?: string;
  isPlaying?: boolean;
  onTogglePlay?: (playing: boolean) => void;
  customSubtitle?: { url: string; label: string; lang?: string } | null;
  onModeChange?: (mode: "native" | "iframe") => void;
  server?: string;
}

export const NativeHlsPlayer = memo(function NativeHlsPlayer({
  mediaType = "movie",
  mediaId,
  season = 1,
  episode = 1,
  directSrc,
  poster,
  title,
  startProgress = 0,
  onProgress,
  onEnded,
  autoPlay = true,
  playbackRate = 1,
  subtitleSettings,
  selectedSubtitleId = -1,
  onQualitiesLoaded,
  onSubtitlesLoaded,
  onAudioTracksLoaded,
  fallbackIframeUrl,
  isPlaying: externalIsPlaying,
  onTogglePlay,
  customSubtitle,
  onModeChange,
  server = "auto",
}: NativeHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [streamUrl, setStreamUrl] = useState<string | null>(directSrc || null);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1); // -1 = Auto
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ── Step 1: Resolve Direct HLS Stream ──
  useEffect(() => {
    if (directSrc) {
      setStreamUrl(directSrc);
      setUseIframeFallback(false);
      return;
    }

    if (mediaType === "anime" && fallbackIframeUrl) {
      setUseIframeFallback(true);
      setIsLoading(false);
      return;
    }

    if (!mediaId) return;

    let isMounted = true;
    setIsLoading(true);
    setUseIframeFallback(false);

    const resolveStream = async () => {
      try {
        const query = new URLSearchParams({
          type: mediaType,
          id: String(mediaId),
          season: String(season),
          episode: String(episode),
          server: server || "auto",
        });

        const res = await fetch(`/api/stream/resolve?${query.toString()}`);
        if (!res.ok) throw new Error("Stream resolution failed");

        const data = await res.json();
        if (!isMounted) return;

        if (data?.success && data?.streamUrl) {
          setStreamUrl(data.streamUrl);
          if (Array.isArray(data.subtitles) && data.subtitles.length > 0) {
            setSubtitles(data.subtitles);
            if (onSubtitlesLoaded) onSubtitlesLoaded(data.subtitles);
          }
          setUseIframeFallback(false);
        } else {
          // If no direct HLS source was extracted, fallback to clean sandboxed iframe
          setUseIframeFallback(true);
          setIsLoading(false);
        }
      } catch {
        if (!isMounted) return;
        setUseIframeFallback(true);
        setIsLoading(false);
      }
    };

    resolveStream();

    return () => {
      isMounted = false;
    };
  }, [mediaType, mediaId, season, episode, directSrc, onSubtitlesLoaded]);

  // ── Step 2: Initialize HLS.js or Native Playback ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useIframeFallback || !streamUrl) return;

    setIsLoading(true);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsLoading(false);

        // Quality levels
        const mappedQualities: QualityLevel[] = data.levels.map((lvl, index) => ({
          id: index,
          height: lvl.height,
          label: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
          bitrate: lvl.bitrate,
        }));
        setQualities(mappedQualities);
        if (onQualitiesLoaded) onQualitiesLoaded(mappedQualities);

        // Audio tracks
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const mappedAudio: AudioTrack[] = hls.audioTracks.map((t, index) => ({
            id: index,
            label: t.name || t.lang || `Audio ${index + 1}`,
            lang: t.lang || "und",
          }));
          setAudioTracks(mappedAudio);
          if (onAudioTracksLoaded) onAudioTracksLoaded(mappedAudio);
        }

        // Subtitle tracks in manifest
        if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
          const mappedSubs: SubtitleTrack[] = hls.subtitleTracks.map((s, index) => ({
            id: index,
            label: s.name || s.lang || `Subtitle ${index + 1}`,
            lang: s.lang || "und",
          }));
          setSubtitles((prev) => (prev.length > 0 ? prev : mappedSubs));
          if (onSubtitlesLoaded) onSubtitlesLoaded(mappedSubs);
        }

        if (startProgress > 0) {
          video.currentTime = startProgress;
        }

        if (autoPlay) {
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              // Graceful fallback to sandbox iframe
              setUseIframeFallback(true);
              setIsLoading(false);
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        if (startProgress > 0) video.currentTime = startProgress;
        if (autoPlay) video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    } else {
      setUseIframeFallback(true);
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, useIframeFallback, autoPlay, startProgress, onQualitiesLoaded, onSubtitlesLoaded, onAudioTracksLoaded]);

  // ── Sync Playback Rate ──
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // ── Sync External Play State ──
  useEffect(() => {
    if (externalIsPlaying === undefined || !videoRef.current) return;
    if (externalIsPlaying && videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else if (!externalIsPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [externalIsPlaying]);

  // ── Time & Progress Updates ──
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);
    if (onProgress) onProgress(cur, dur);
  }, [onProgress]);

  useEffect(() => {
    if (onModeChange) {
      onModeChange(useIframeFallback ? "iframe" : "native");
    }
  }, [useIframeFallback, onModeChange]);

  // ── Fallback Iframe Mode ──
  if (useIframeFallback && fallbackIframeUrl) {
    return (
      <div className="w-full h-full relative bg-black">
        <iframe
          key={fallbackIframeUrl}
          src={fallbackIframeUrl}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen *; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          title={title || "Video Stream"}
        />
      </div>
    );
  }

  // Subtitle styling rules
  const fontSizeMap: Record<string, string> = {
    small: "text-xs md:text-sm",
    medium: "text-sm md:text-lg",
    large: "text-base md:text-2xl",
  };

  const currentFontSize = subtitleSettings?.fontSize ? fontSizeMap[subtitleSettings.fontSize] || "text-base" : "text-base";
  const currentFontColor = subtitleSettings?.fontColor || "#FFFFFF";
  const currentBgColor = subtitleSettings?.bgColor || "#000000";
  const currentBgOpacity = subtitleSettings?.bgOpacity !== undefined ? subtitleSettings.bgOpacity / 100 : 0.6;

  return (
    <div className="w-full h-full relative bg-black select-none overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        crossOrigin="anonymous"
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => {
          setIsPlaying(true);
          if (onTogglePlay) onTogglePlay(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          if (onTogglePlay) onTogglePlay(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
      >
        {/* Custom OpenSubtitles Track */}
        {customSubtitle?.url && (
          <track
            key="custom-opensubtitles"
            kind="subtitles"
            label={customSubtitle.label || "OpenSubtitles"}
            srcLang={customSubtitle.lang || "en"}
            src={customSubtitle.url}
            default
          />
        )}

        {/* Render WebVTT subtitle tracks */}
        {subtitles.map((sub) =>
          sub.url ? (
            <track
              key={sub.id || sub.lang}
              kind="subtitles"
              label={sub.label}
              srcLang={sub.lang}
              src={sub.url}
              default={!customSubtitle?.url && (sub.lang === "en" || sub.id === 1)}
            />
          ) : null
        )}
      </video>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-none z-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-primary animate-spin drop-shadow-xl" />
            <span className="text-xs font-bold text-white/90 tracking-widest uppercase">
              Initializing Direct HLS Stream...
            </span>
          </div>
        </div>
      )}

      {/* Error View */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 z-30 p-6">
          <div className="text-center max-w-md space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <p className="text-white text-sm font-medium">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
});
