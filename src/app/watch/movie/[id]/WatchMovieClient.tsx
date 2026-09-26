"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CinemaPlayer, type CinemaPlayerMetadata } from "@/components/player/CinemaPlayer";
import { ServerOption } from "@/components/player/ServerSelectorModal";
import { getStreamingSources, StreamingSource } from "@/lib/streaming-fetch";
import { fetchSourceConfig, SOURCE_TAG_LABELS, type SourceTag, type SourceConfigEntry, type SourceCategory } from "@/lib/streaming-config";
import { fetchJson } from "@/lib/utils";
import { NativeHlsPlayer } from "@/components/player/NativeHlsPlayer";
import { declarePageReady } from "@/lib/pageLoad";

interface Movie {
  id: number;
  title: string;
  tagline?: string;
  overview: string;
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  runtime?: number;
}

export default function WatchMovieClient({ movieId }: { movieId: number }) {
  const { data: session } = useSession();
  const [movie, setMovie] = useState<Movie | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`cinestream_movie_${movieId}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [error, setError] = useState<string | null>(null);

  const [sourceConfig, setSourceConfig] = useState<SourceConfigEntry[] | null>(null);

  useEffect(() => {
    fetchSourceConfig().then((cfg) => {
      if (cfg?.movie) setSourceConfig(cfg.movie);
    });

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<SourceCategory, SourceConfigEntry[]>>;
      if (customEvent.detail?.movie) {
        setSourceConfig(customEvent.detail.movie);
      } else {
        fetchSourceConfig(true).then((cfg) => {
          if (cfg?.movie) setSourceConfig(cfg.movie);
        });
      }
    };

    window.addEventListener("cinestream_streaming_sources_updated", handleUpdate);
    return () => {
      window.removeEventListener("cinestream_streaming_sources_updated", handleUpdate);
    };
  }, []);

  const sources = useMemo(() => {
    const base = getStreamingSources("movie", movieId);
    if (!sourceConfig || sourceConfig.length === 0) {
      return base.map((s, idx) => ({ ...s, name: `Source ${idx + 1}` }));
    }
    const byType = new Map(base.map((s) => [s.type, s]));
    const ordered: StreamingSource[] = [];
    sourceConfig.forEach((entry) => {
      const key = entry.key === "vixsrc" ? "bingr" : entry.key;
      const src = byType.get(key);
      if (src && !ordered.some((o) => o.type === src.type)) {
        ordered.push({
          ...src,
          tag: entry.tag,
          quality: (SOURCE_TAG_LABELS[entry.tag] as any) || src.quality,
        });
      }
    });
    base.forEach((s) => {
      if (!ordered.some((o) => o.type === s.type)) ordered.push(s);
    });
    return ordered.map((s, index) => ({
      ...s,
      name: `Source ${index + 1}`,
    }));
  }, [movieId, sourceConfig]);

  // Dismiss any incoming navigation loader immediately upon watch page hydration
  useEffect(() => {
    declarePageReady();
  }, []);

  const [activeSource, setActiveSource] = useState<StreamingSource>(() => {
    const base = getStreamingSources("movie", movieId);
    return base[0] || {
      url: `https://embedmaster.link/movie/${movieId}`,
      name: "Source 1",
      type: "embedmaster",
      quality: "Best",
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined" && sources.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const sourceParam = urlParams.get("source");
      // Clean up legacy global preference so new entries start fresh on Source 1
      try {
        sessionStorage.removeItem("cinestream_movie_source");
      } catch {}
      const savedSource = sessionStorage.getItem(`cinestream_movie_source_${movieId}`);

      let selected: StreamingSource | undefined;
      if (sourceParam) {
        const num = parseInt(sourceParam, 10);
        if (!isNaN(num) && num >= 1 && num <= sources.length) {
          selected = sources[num - 1];
        } else {
          selected = sources.find((s) => s.type === sourceParam || s.name.toLowerCase() === sourceParam.toLowerCase());
        }
      }

      if (!selected && savedSource) {
        const num = parseInt(savedSource, 10);
        if (!isNaN(num) && num >= 1 && num <= sources.length) {
          selected = sources[num - 1];
        } else {
          selected = sources.find((s) => s.type === savedSource);
        }
      }

      if (!selected) {
        selected = sources[0];
      }

      setActiveSource(selected);

      // Clean up / normalize URL to show source as a number
      const selectedIndex = sources.findIndex((s) => s.type === selected.type);
      const sourceNumber = selectedIndex >= 0 ? selectedIndex + 1 : 1;
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("source") !== String(sourceNumber)) {
          url.searchParams.set("source", String(sourceNumber));
          window.history.replaceState(null, "", url.toString());
        }
      } catch {}
    }
  }, [sources, movieId]);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        let activeMovie = movie;
        if (!activeMovie) {
          activeMovie = await fetchJson<Movie>(`/api/tmdb/movie/${movieId}`);
          setMovie(activeMovie);
        }

        // Record watch history
        if (session?.user && activeMovie) {
          fetch("/api/watch-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId: activeMovie.id,
              mediaType: "movie",
              title: activeMovie.title,
              posterPath: activeMovie.poster_path ?? null,
              backdropPath: activeMovie.backdrop_path ?? null,
            }),
          }).catch(() => {});

          // Optimistically update localStorage cache for Continue Watching with 0ms delay
          try {
            const saved = localStorage.getItem("cinestream_cw_cache");
            const parsed = saved ? JSON.parse(saved) : { items: [] };
            const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];

            const updatedItem = {
              id: activeMovie.id,
              mediaId: activeMovie.id,
              mediaType: "movie",
              title: activeMovie.title,
              posterPath: activeMovie.poster_path ?? null,
              backdropPath: activeMovie.backdrop_path ?? null,
              watchedAt: new Date().toISOString(),
            };

            const filtered = items.filter((it) => !(it.mediaId === activeMovie.id && it.mediaType === "movie"));
            filtered.unshift(updatedItem);
            localStorage.setItem("cinestream_cw_cache", JSON.stringify({ items: filtered.slice(0, 30) }));
            window.dispatchEvent(new Event("cinestream_watch_history_updated"));
          } catch {}
        }
      } catch (err) {
        if (!movie) {
          setError(err instanceof Error ? err.message : "Failed to load movie");
        }
      }
    };
    fetchMovie();
  }, [movieId, session]);

  // Preconnect embed domains early for lightning-fast iframe startup
  useEffect(() => {
    const domains = [
      "https://embedmaster.link",
      "https://bingr.one",
      "https://vidlink.pro",
      "https://vidsrc.sh",
      "https://autoembed.co",
    ];
    domains.forEach((href) => {
      if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }, []);

  const posterUrl = movie?.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
  const backdropUrl = movie?.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null;
  const year = movie?.release_date ? movie.release_date.slice(0, 4) : "";
  const rating = movie?.vote_average ?? 0;

  const metadata: CinemaPlayerMetadata = {
    title: movie?.title || "Movie Stream",
    year,
    rating,
    overview: movie?.overview || "",
    posterUrl,
    backdropUrl,
    backUrl: `/movie/${movieId}`,
    tmdbId: movieId,
  };

  const serverOptions: ServerOption[] = sources.map((s) => ({
    key: s.type,
    name: s.name,
    type: s.type,
    quality: s.quality,
    tag: s.tag as SourceTag,
  }));

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black text-white overflow-hidden select-none overscroll-none">
      {/* Pure Cinema Video Player */}
      <CinemaPlayer
        metadata={metadata}
        servers={serverOptions}
        activeServer={{
          key: activeSource.type,
          name: activeSource.name,
          type: activeSource.type,
          quality: activeSource.quality,
          tag: activeSource.tag as SourceTag,
        }}
        onSelectServer={(srv) => {
          const found = sources.find((s) => s.type === srv.key || s.name === srv.name);
          if (found) {
            setActiveSource(found);
            if (typeof window !== "undefined") {
              const sourceIndex = sources.findIndex((s) => s.type === found.type);
              const sourceNum = sourceIndex >= 0 ? sourceIndex + 1 : 1;
              sessionStorage.setItem(`cinestream_movie_source_${movieId}`, String(sourceNum));
              try {
                const url = new URL(window.location.href);
                url.searchParams.set("source", String(sourceNum));
                window.history.replaceState(null, "", url.toString());
              } catch {}
            }
          }
        }}
      >
        <NativeHlsPlayer
          key={`${movieId}-${activeSource.type}`}
          mediaType="movie"
          mediaId={movieId}
          fallbackIframeUrl={activeSource.url}
          server={activeSource.type}
          title={movie?.title || "Movie Stream"}
          poster={backdropUrl || posterUrl || undefined}
        />
      </CinemaPlayer>
    </div>
  );
}
