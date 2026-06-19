"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { MediaRow } from "@/components/MediaRow";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Play, Star, Clock, Calendar, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fetchJson, shuffleArray } from "@/lib/utils";

interface Movie {
  id: number;
  title: string;
  tagline?: string;
  overview: string;
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  runtime?: number;
  adult?: boolean;
  genres?: { id: number; name: string }[];
  credits?: { cast: { id: number; name: string; character: string; profile_path?: string }[] };
  similar?: { results: any[] };
  recommendations?: { results: any[] };
}

export default function MovieDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const { status } = useSession();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      setError(null);
      try {
        const data = await fetchJson<Movie>(`/api/tmdb/movie/${id}`);
        if (data.adult) {
          setError("This content is not available.");
          setMovie(null);
          return;
        }
        setMovie(data);
      } catch (error) {
        setMovie(null);
        setError(error instanceof Error ? error.message : "Failed to fetch movie");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovie();
  }, [id]);

  useEffect(() => {
    if (searchParams.get("autoplay") === "1") {
      setIsPlaying(true);
    }
  }, [searchParams]);

  const handleWatch = async () => {
    if (status === "authenticated" && movie) {
      await fetch("/api/watch-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: movie.id,
          mediaType: "movie",
          title: movie.title,
          posterPath: movie.poster_path ?? null,
          backdropPath: movie.backdrop_path ?? null,
        }),
      });
    }

    setIsPlaying(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="w-full h-[65vh] bg-muted/30 animate-pulse" />
        <div className="px-5 md:px-10 py-12 max-w-screen-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-4">
            <div className="h-12 w-3/4 bg-muted/40 rounded animate-pulse" />
            <div className="h-6 w-1/2 bg-muted/40 rounded animate-pulse" />
            <div className="h-28 w-full bg-muted/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64">
          <div className="pt-0 px-6 md:px-12 max-w-screen-2xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80">
              <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load this movie</div>
              {error ? (
                <div className="text-sm text-white/50 break-words">{error}</div>
              ) : (
                <div className="text-sm text-white/50">Not found.</div>
              )}
              <div className="mt-5">
                <Link href="/" className="text-sm font-semibold text-primary hover:underline">
                  Go back home
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : null;
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;

  const score = movie.vote_average ?? 0;
  const scoreColor =
    score >= 7.5 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 bleed-header">
        <div className="relative w-full h-[62vh] md:h-[72vh] overflow-hidden flex items-end">
        <div className="absolute inset-0 z-0">
          {backdropUrl ? (
            <motion.img
              src={backdropUrl}
              alt={movie.title}
              className="w-full h-full object-cover object-top scale-[1.03]"
              initial={{ opacity: 0, scale: 1.07 }}
              animate={{ opacity: 1, scale: 1.03 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
          ) : (
            <div className="w-full h-full bg-card" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/30 to-transparent" />
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-background/50 to-transparent" />
        </div>

        <div className="relative z-10 pb-12 px-5 md:px-10 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-8 items-end">
          {posterUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="hidden md:block shrink-0"
            >
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-48 lg:w-60 rounded-2xl shadow-2xl ring-1 ring-white/10"
              />
            </motion.div>
          )}

          <div className="flex-1 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h1 className="font-bold text-5xl md:text-7xl text-white leading-none tracking-wide mb-2">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-primary/90 font-semibold italic text-base md:text-lg">
                  {movie.tagline}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="flex flex-wrap items-center gap-3 text-sm"
            >
              {score > 0 && (
                <div className={`flex items-center gap-1.5 font-bold ${scoreColor}`}>
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-base">{score.toFixed(1)}</span>
                  <span className="text-white/30 font-normal text-xs">/ 10</span>
                </div>
              )}
              {movie.release_date && (
                <span className="flex items-center gap-1.5 text-white/40 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(movie.release_date), "yyyy")}
                </span>
              )}
              {movie.runtime ? (
                <span className="flex items-center gap-1.5 text-white/40 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              ) : null}
              <div className="flex flex-wrap gap-1.5 ml-1">
                {movie.genres?.map((g) => (
                  <span
                    key={g.id}
                    className="px-2.5 py-0.5 bg-white/[0.07] border border-white/[0.08] rounded-full text-xs font-semibold text-white/70"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="text-white/65 text-base leading-relaxed max-w-2xl"
            >
              {movie.overview}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.5 }}
            >
              <button
                onClick={handleWatch}
                className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                Watch Now
                
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {isPlaying && (
        <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-8 mb-4">
          <VideoPlayer type="movie" id={id} title={movie.title} />
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-8 space-y-14">
        {movie.credits?.cast && movie.credits.cast.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-primary rounded-full" />
              <h2 className="text-base font-bold text-white tracking-wide">Cast</h2>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar">
              {movie.credits.cast.slice(0, 16).map((person, i) => (
                <motion.div
                  key={person.id}
                  className="w-[100px] shrink-0 text-center"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.35 }}
                >
                  <div className="aspect-[2/3] rounded-xl bg-card overflow-hidden mb-2.5 ring-1 ring-white/[0.06]">
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <span className="text-muted-foreground/40 text-lg font-bold">
                          {person.name?.[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-xs text-white line-clamp-1 leading-tight">
                    {person.name}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {person.character}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {(() => {
          const recs = movie.recommendations?.results || [];
          const similar = movie.similar?.results || [];
          const seen = new Set<number>();
          const merged: any[] = [];
          for (const item of recs) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
          }
          for (const item of similar) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
            if (merged.length >= 20) break;
          }
          const filtered = merged.filter(item => item.poster_path || item.backdrop_path);
          if (filtered.length >= 6) {
            return (
              <div className="-mx-5 md:-mx-10">
                <MediaRow title="You May Like" items={shuffleArray(filtered)} />
              </div>
            );
          }
          return null;
        })()}
        </div>
      </main>
    </div>
  );
}
