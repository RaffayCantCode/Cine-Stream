"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MediaRow } from "@/components/MediaRow";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { Play, Star, Clock, Calendar } from "lucide-react";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer").then(m => m.VideoPlayer), { ssr: false });
import { CinematicHero } from "@/components/CinematicHero";
import { GridMediaCard } from "@/components/GridMediaCard";
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
  vote_count?: number;
  release_date?: string;
  runtime?: number;
  adult?: boolean;
  genres?: { id: number; name: string }[];
  credits?: { cast: { id: number; name: string; character: string; profile_path?: string }[] };
  similar?: { results: any[] };
  recommendations?: { results: any[] };
  videos?: { results: any[] };
}

export default function MovieClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const { status } = useSession();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      setError(null);
      try {
        const data = await fetchJson<Movie>(`/api/tmdb/movie/${id}`);
        // Preload backdrop immediately — starts download before React renders
        if (data.backdrop_path) {
          const link = document.createElement("link");
          link.rel = "preload"; link.as = "image";
          link.href = `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`;
          link.fetchPriority = "high";
          document.head.appendChild(link);
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

  // ── Scroll to player on play ──
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, [isPlaying]);

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
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;

  const score = movie.vote_average ?? 0;
  const scoreColor =
    score >= 7.5 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";

  const trailerId = movie.videos?.results?.find((v: any) => v.type === "Trailer" && v.site === "YouTube")?.key;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 bleed-header">
        <CinematicHero
          backdropPath={movie.backdrop_path}
          trailerId={trailerId}
          title={movie.title}
        >
          <div className="pb-12 px-5 md:px-10 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-8 items-end">
          {posterUrl && (
            <div
              className="hidden md:block shrink-0"
            >
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-48 lg:w-60 rounded-2xl shadow-2xl ring-1 ring-white/10"
                fetchPriority="high"
                decoding="async"
                width={240}
                height={360}
              />
            </div>
          )}

          <div className="flex-1 space-y-4">
            <div
            >
              <h1 className="font-bold text-5xl md:text-7xl text-white leading-none tracking-wide mb-2">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-primary/90 font-semibold italic text-base md:text-lg">
                  {movie.tagline}
                </p>
              )}
            </div>

            <div
              className="flex flex-wrap items-center gap-3 text-sm"
            >
              {score > 0 && movie.vote_count && movie.vote_count > 20 && (
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
            </div>

            <p
              className="text-white/65 text-base leading-relaxed max-w-2xl"
            >
              {movie.overview}
            </p>

            <div>
              <button
                onClick={handleWatch}
                className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                Watch Now
              </button>
            </div>
          </div>
          </div>
        </CinematicHero>

      {isPlaying && (
        <div ref={playerRef} className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-8 mb-4">
          <VideoPlayer type="movie" id={id} title={movie.title} startProgress={Number(searchParams.get("t") || 0)} />
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-8 space-y-14">
        {movie.credits?.cast && movie.credits.cast.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-primary rounded-full" />
              <h2 className="text-base font-bold text-white tracking-wide">Cast</h2>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar">
              {movie.credits.cast.slice(0, 16).map((person, i) => (
                  <Link
                  href={`/person/${person.id}`}
                  key={person.id}
                  className="w-[100px] shrink-0 text-center group cursor-pointer"
                >
                  <div className="aspect-[2/3] rounded-xl bg-card overflow-hidden mb-2.5 ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary/50">
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
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
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 group-hover:text-muted-foreground/80 transition-colors">
                    {person.character}
                  </p>
                </Link>
              ))}
            </div>
          </section>
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
              <section className="pt-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  <h2 className="text-base font-bold text-white tracking-wide">You May Like</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                  {filtered.slice(0, 18).map((item: any, i: number) => (
                    <GridMediaCard key={item.id} item={item} index={i} />
                  ))}
                </div>
              </section>
            );
          }
          return null;
        })()}
        </div>
      </main>
    </div>
  );
}
