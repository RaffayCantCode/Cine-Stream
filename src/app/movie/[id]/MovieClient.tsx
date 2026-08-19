"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MediaRow } from "@/components/MediaRow";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { Play, Star, Clock, Calendar, Film } from "lucide-react";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer").then(m => m.VideoPlayer), { ssr: false });
import { CinematicHero, useCinematicHero } from "@/components/CinematicHero";

function MovieHeroTrailerButton() {
  const { playTrailer, hasTrailer } = useCinematicHero();
  if (!hasTrailer) return null;
  return (
    <button
      onClick={playTrailer}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold px-6 py-4 rounded-xl text-sm transition-all border border-white/15 backdrop-blur-md shadow-lg"
    >
      <Film className="w-4 h-4 text-[#7288AE] shrink-0" />
      <span>Trailer</span>
    </button>
  );
}
import { GridMediaCard } from "@/components/GridMediaCard";
import { format } from "date-fns";
import { fetchJson, shuffleArray, getRecommendationReason } from "@/lib/utils";
import { CastRow } from "@/components/CastRow";
import { WatchlistButton } from "@/components/WatchlistButton";
import { usePageContentReady } from "@/lib/pageLoad";

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
  const id = Number(params.id);
  const { status } = useSession();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  usePageContentReady(!isLoading);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
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

  const autoPlayHandledRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !movie || status === "loading") return;
    if (autoPlayHandledRef.current) return;
    
    autoPlayHandledRef.current = true;
    const searchParams = new URLSearchParams(window.location.search);
    const autoPlay = searchParams.get("autoplay") === "1";
    
    if (autoPlay) {
      if (status === "authenticated") {
        fetch("/api/watch-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: movie.id,
            mediaType: "movie",
            title: movie.title,
            posterPath: movie.poster_path ?? null,
            backdropPath: movie.backdrop_path ?? null,
          }),
        }).catch(() => {});
      }
      setIsPlaying(true);
    }
  }, [movie]);

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

  if (!movie || (movie as any).isHidden) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64">
          <div className="pt-24 px-6 md:px-12 max-w-screen-2xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-white/80 max-w-lg mx-auto text-center space-y-3">
              <div className="text-xl font-bold text-white">Title Unavailable</div>
              <p className="text-sm text-zinc-400">
                This title is currently not available to view. Please check back later or browse other titles.
              </p>
              <div className="pt-2">
                <Link href="/" className="inline-flex px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow">
                  Browse Catalog
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
          backdropPath={movie.backdrop_path || movie.poster_path}
          trailerId={trailerId}
          title={movie.title}
          theme="movie"
        >
          <div className="pb-4 md:pb-8 px-4 sm:px-6 md:px-10 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-5 md:gap-6 items-start md:items-center">
          {posterUrl && (
            <div
              className="hidden md:block shrink-0"
            >
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-40 sm:w-44 md:w-44 lg:w-52 rounded-2xl shadow-2xl ring-1 ring-white/10 aspect-[2/3] object-cover"
                fetchPriority="high"
                decoding="async"
                width={320}
                height={480}
              />
            </div>
          )}

          <div className="flex-1 space-y-2.5 sm:space-y-3 w-full">
            <div>
              <h1 className="font-bold text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight mb-1">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="text-red-500 font-bold italic text-xs sm:text-sm md:text-base tracking-wide drop-shadow-[0_2px_12px_rgba(239,68,68,0.4)]">
                  {movie.tagline}
                </p>
              )}
            </div>

            <div
              className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm"
            >
              {score > 0 && movie.vote_count && movie.vote_count > 20 && (
                <div className={`flex items-center gap-1.5 font-bold ${scoreColor}`}>
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  <span className="text-sm sm:text-base">{score.toFixed(1)}</span>
                  <span className="text-white/30 font-normal text-[10px] sm:text-xs">/ 10</span>
                </div>
              )}
              {movie.release_date && (
                <span className="flex items-center gap-1.5 text-white/40 font-medium">
                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {format(new Date(movie.release_date), "yyyy")}
                </span>
              )}
              {movie.runtime ? (
                <span className="flex items-center gap-1.5 text-white/40 font-medium">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              ) : null}
              <div className="flex flex-wrap gap-1.5 ml-0.5">
                {movie.genres?.map((g) => (
                  <span
                    key={g.id}
                    className="px-2 sm:px-2.5 py-0.5 bg-white/[0.07] border border-white/[0.08] rounded-full text-[11px] sm:text-xs font-semibold text-white/70"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>

            <p
              className="text-white/65 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl line-clamp-2 sm:line-clamp-3"
            >
              {movie.overview}
            </p>

            <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full pt-1">
              {(movie as any).isUpcoming || (movie as any).status === "upcoming" ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs sm:text-sm font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span>This entry is upcoming. Please check back later.</span>
                </div>
              ) : (movie as any).isUnavailable || (movie as any).status === "unavailable" ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-300 text-xs sm:text-sm font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                  <span>This title is currently unavailable on this site. Please check back later.</span>
                </div>
              ) : (
                <button
                  onClick={handleWatch}
                  className="group flex items-center gap-2 bg-[#E11D48] hover:bg-[#F43F5E] text-white font-extrabold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm transition-all duration-300 shadow-xl shadow-black/40 hover:scale-[1.03] active:scale-95 border border-rose-400/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5 group-hover:scale-110 transition-transform text-white" />
                  Watch Now
                </button>
              )}

              <WatchlistButton
                mediaId={movie.id}
                mediaType="movie"
                title={movie.title}
                posterPath={movie.poster_path ?? null}
                backdropPath={movie.backdrop_path ?? null}
              />

              <MovieHeroTrailerButton />
            </div>
          </div>
          </div>
        </CinematicHero>

      {isPlaying && (
        <div ref={playerRef} className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-8 mb-4">
          <VideoPlayer type="movie" id={id} title={movie.title} startProgress={typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get("t") || 0) : 0} />
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-8 space-y-14">
        {(((movie.credits as any)?.cast && (movie.credits as any).cast.length > 0) || ((movie.credits as any)?.crew && (movie.credits as any).crew.length > 0)) && (
          <CastRow cast={(movie.credits as any).cast || []} crew={(movie.credits as any).crew || []} />
        )}

        {(() => {
          const recs = movie.recommendations?.results || [];
          const similar = movie.similar?.results || [];
          const seen = new Set<number>();
          const merged: any[] = [];
          const sourceGenres = movie.genres?.map((g: any) => g.id) || [];
          const scoreItem = (item: any, source: "recommendation" | "similar") => {
            const targetGenres = item.genre_ids || [];
            const genreMatches = sourceGenres.filter((g: number) => targetGenres.includes(g)).length;
            const rating = Number(item.vote_average || 0);
            const votes = Math.min(Number(item.vote_count || 0), 2500) / 2500;
            return genreMatches * 120 + rating * 10 + votes * 40 + (source === "recommendation" ? 35 : 0);
          };
          for (const item of recs) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            item.reason = getRecommendationReason(sourceGenres, item.genre_ids || []);
            item.relevanceScore = scoreItem(item, "recommendation");
            merged.push({ ...item, media_type: item.media_type || "movie" });
          }
          for (const item of similar) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            item.reason = getRecommendationReason(sourceGenres, item.genre_ids || []);
            item.relevanceScore = scoreItem(item, "similar");
            merged.push({ ...item, media_type: item.media_type || "movie" });
            if (merged.length >= 20) break;
          }
          const filtered = merged
            .filter(item => item.poster_path || item.backdrop_path)
            .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          if (filtered.length >= 6) {
            return (
              <section className="pt-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">More Like This</h2>
                    <p className="text-xs text-white/35 mt-0.5">Ranked by matching genres, audience signal, and TMDB recommendations.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6">
                  {filtered.slice(0, 12).map((item: any, i: number) => (
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
