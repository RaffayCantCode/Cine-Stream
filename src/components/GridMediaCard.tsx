"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Star, Film, Tv, Play } from "lucide-react";
import { isTmdbAnime, cn } from "@/lib/utils";

interface MediaItem {
  id: number | string;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  original_language?: string;
  genre_ids?: number[];
  reason?: string;
  [key: string]: any;
}

interface GridMediaCardProps {
  item: MediaItem;
  index?: number;
  action?: React.ReactNode;
  className?: string;
}

export function GridMediaCard({ item, index = 0, action, className }: GridMediaCardProps) {
  const isManga = item.media_type === "manga" || item.media_type === "manhwa";
  const rawTargetUrl = (item as any).targetUrl || (item as any).target_url;
  const isAnime =
    item.media_type === "anime" ||
    (item as any).isTmdbAnime ||
    Boolean((item as any).anilistId) ||
    String(rawTargetUrl || "").includes("/anime/") ||
    isTmdbAnime(item as any);
  const isTv = !isAnime && (item.media_type === "tv" || (!!item.first_air_date && !item.release_date));
  const isMovie = !isAnime && (item.media_type === "movie" || (!isTv && !isManga));

  let link = rawTargetUrl;
  if (item.media_type === "person") {
    link = `/person/${item.id}`;
  } else if (isManga && (!link || !link.startsWith("/manga/"))) {
    link = `/manga/${item.id}`;
  } else if (isAnime) {
    if (!link || !link.startsWith("/anime/")) {
      const rawId = String(item.id);
      const aId = (item as any).anilistId || (rawId.startsWith("tmdb-") || rawId.startsWith("kitsu-") ? rawId : `tmdb-${rawId}`);
      link = `/anime/${aId}`;
    }
  } else if (!link) {
    link = isTv ? `/tv/${item.id}` : `/movie/${item.id}`;
  }
  const title = item.title || item.name || "";
  const getTmdbImageUrl = (path?: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `https://image.tmdb.org/t/p/w780${cleanPath}`;
  };

  const initialPosterUrl = getTmdbImageUrl(item.poster_path);

  const [imgSrc, setImgSrc] = useState<string | null>(initialPosterUrl);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgSrc(initialPosterUrl);
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [initialPosterUrl]);

  // Network-adaptive fallback: If high-res w780 takes more than 5s on slow internet, try lighter w500
  useEffect(() => {
    if (isLoaded || hasError || !imgSrc) return;
    const timer = setTimeout(() => {
      if (!isLoaded && !hasError && imgSrc.includes("/w780/")) {
        setImgSrc((prev) => prev ? prev.replace("/w780/", "/w500/") : null);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [imgSrc, isLoaded, hasError]);

  const handleImageError = () => {
    if (imgSrc && imgSrc.includes("/w780/")) {
      setImgSrc(imgSrc.replace("/w780/", "/w500/"));
    } else if (imgSrc && imgSrc.includes("/w500/")) {
      setImgSrc(imgSrc.replace("/w500/", "/w342/"));
    } else if (imgSrc && imgSrc.includes("/w342/")) {
      setImgSrc(imgSrc.replace("/w342/", "/w185/"));
    } else {
      setHasError(true);
    }
  };

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return (
    <div
      className={cn(
        "group flex flex-col gap-3 animate-fade-in-up relative hover:z-30 pt-2 -mt-2 [content-visibility:auto] [contain-intrinsic-size:180px_320px]",
        className
      )}
      style={{ animationDelay: `${Math.min((index % 20) * 0.025, 0.35)}s` }}
    >
      {/* Poster Container with smooth group hover lift, shadow, ring, and sheen */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-card/80 ring-1 ring-white/10 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.5),0_2px_6px_-2px_rgba(0,0,0,0.3)] transition-all duration-300 ease-out group-hover:scale-[1.02] group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_35px_-8px_rgba(0,0,0,0.65),0_8px_16px_-4px_rgba(0,0,0,0.35)] group-hover:ring-white/40 sheen-wrapper group-hover:will-change-transform">
        <Link
          href={link}
          prefetch={false}
          className="absolute inset-0 block focus:outline-none z-10"
        >
          {imgSrc && !hasError ? (
            <>
              {!isLoaded && (
                <div className="absolute inset-0 bg-card/80" />
              )}
              <img
                ref={imgRef}
                src={imgSrc}
                alt={title}
                className={`w-full h-full object-cover transition-opacity duration-500 ease-out ${
                  isLoaded ? "opacity-100" : "opacity-0"
                }`}
                loading={index < 8 ? "eager" : "lazy"}
                decoding="async"
                onLoad={() => setIsLoaded(true)}
                onError={handleImageError}
              />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#262E36] to-[#141A21] select-none">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-2 text-white/30">
                {isMovie ? <Film className="w-5 h-5" /> : isTv ? <Tv className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </div>
              <span className="text-white/70 text-xs font-bold line-clamp-3 leading-tight px-1">{title}</span>
            </div>
          )}

          {/* Hover overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Top left status and custom tag badges */}
          <div className="absolute top-2 left-2 z-20 flex flex-wrap items-center gap-1 max-w-[70%] pointer-events-none">
            {(item as any).isUpcoming || (item as any).status === "upcoming" ? (
              <div className="flex items-center gap-1 bg-amber-500/90 text-amber-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md backdrop-blur-sm">
                Upcoming
              </div>
            ) : (item as any).isUnavailable || (item as any).status === "unavailable" ? (
              <div className="flex items-center gap-1 bg-zinc-700/90 text-zinc-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md backdrop-blur-sm">
                Unavailable
              </div>
            ) : null}

            {Array.isArray((item as any).customTags || (item as any).tags) && ((item as any).customTags || (item as any).tags).slice(0, 1).map((tag: string, i: number) => (
              <div key={i} className="flex items-center gap-1 bg-purple-600/90 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-md backdrop-blur-sm">
                {tag}
              </div>
            ))}
          </div>

          {/* Top right rating badge */}
          {!action && item.vote_average ? (
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/70 text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/10 pointer-events-none">
              <Star className="w-3 h-3 fill-current" />
              {item.vote_average.toFixed(1)}
            </div>
          ) : null}
        </Link>

        {/* Action overlay slot (e.g. wishlist remove button) */}
        {action && (
          <div className="absolute top-2 right-2 z-30">
            {action}
          </div>
        )}
      </div>

      {/* Details (always visible below) */}
      <div className="flex flex-col gap-1 px-1">
        <Link href={link} prefetch={false} className="focus:outline-none">
          <h3 className="text-foreground font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        </Link>
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
          {year && <span>{year}</span>}
          {year && <span>•</span>}
          <span>
            {isManga
              ? (item.media_type === "manhwa" ? "Manhwa" : "Manga")
              : isAnime
              ? "Anime"
              : isMovie
              ? "Movie"
              : "TV"}
          </span>
        </div>
      </div>
    </div>
  );
}
