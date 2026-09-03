"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CinemaPlayer, type CinemaPlayerMetadata } from "@/components/player/CinemaPlayer";
import { ServerOption } from "@/components/player/ServerSelectorModal";
import { getStreamingSources, StreamingSource } from "@/lib/streaming-fetch";
import { fetchSourceConfig, type SourceTag } from "@/lib/streaming-config";
import { fetchJson } from "@/lib/utils";

import { NativeHlsPlayer } from "@/components/player/NativeHlsPlayer";

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
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`cinestream_movie_${movieId}`);
        if (cached) return false;
      } catch {}
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);

  const [sourceConfig, setSourceConfig] = useState<{ key: string; tag: SourceTag }[] | null>(null);

  useEffect(() => {
    fetchSourceConfig().then((cfg) => {
      if (cfg?.movie) setSourceConfig(cfg.movie);
    });
  }, []);

  const sources = useMemo(() => {
    const base = getStreamingSources("movie", movieId);
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
  }, [movieId, sourceConfig]);

  const [activeSource, setActiveSource] = useState<StreamingSource>(sources[0] || {
    url: `https://vidsrc.me/embed/movie?tmdb=${movieId}`,
    name: "Source 1",
    type: "vidsrc",
    quality: "Stable",
  });

  useEffect(() => {
    if (sources.length > 0) {
      setActiveSource(sources[0]);
    }
  }, [sources]);

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
        }
      } catch (err) {
        if (!movie) {
          setError(err instanceof Error ? err.message : "Failed to load movie");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchMovie();
  }, [movieId, session]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">Loading Movie Stream...</span>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <h2 className="text-2xl font-black">Title Unavailable</h2>
        <p className="text-sm text-white/50 max-w-md">{error || "Could not retrieve stream details for this movie."}</p>
        <Link href={`/movie/${movieId}`} className="px-6 py-3 rounded-2xl bg-primary text-white font-bold text-xs">
          Return to Details
        </Link>
      </div>
    );
  }

  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
  const backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null;
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "";
  const rating = movie.vote_average ?? 0;

  const metadata: CinemaPlayerMetadata = {
    title: movie.title,
    year,
    rating,
    overview: movie.overview,
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
          if (found) setActiveSource(found);
        }}
      >
        <NativeHlsPlayer
          mediaType="movie"
          mediaId={movieId}
          fallbackIframeUrl={activeSource.url}
          server={activeSource.type}
          title={movie.title}
          poster={backdropUrl || posterUrl || undefined}
        />
      </CinemaPlayer>
    </div>
  );
}
