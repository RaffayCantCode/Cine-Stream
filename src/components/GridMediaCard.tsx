"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { isTmdbAnime } from "@/lib/utils";

interface MediaItem {
  id: number | string;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  reason?: string;
}

interface GridMediaCardProps {
  item: MediaItem;
  index?: number;
}

export function GridMediaCard({ item, index = 0 }: GridMediaCardProps) {
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
  if (isManga && (!link || !link.startsWith("/manga/"))) {
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
  const initialPosterUrl = item.poster_path
    ? item.poster_path.startsWith("http")
      ? item.poster_path
      : `https://image.tmdb.org/t/p/w780${item.poster_path}`
    : null;

  const [imgSrc, setImgSrc] = useState<string | null>(initialPosterUrl);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setImgSrc(initialPosterUrl);
    setHasError(false);
    setIsLoaded(false);
  }, [initialPosterUrl]);

  const handleImageError = () => {
    if (imgSrc && imgSrc.includes("/w780/")) {
      setImgSrc(imgSrc.replace("/w780/", "/w500/"));
    } else {
      setHasError(true);
    }
  };

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return (
    <div
      className="group flex flex-col gap-3 animate-fade-in-up relative hover:z-30 pt-2 -mt-2"
      style={{ animationDelay: `${Math.min(index * 0.02, 0.6)}s` }}
    >
      <Link
        href={link}
        prefetch={false}
        className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl bg-card/80 ring-1 ring-white/10 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.5),0_2px_6px_-2px_rgba(0,0,0,0.3)] transition-all duration-300 ease-out hover:scale-[1.01] hover:-translate-y-2 hover:shadow-[0_20px_35px_-8px_rgba(0,0,0,0.65),0_8px_16px_-4px_rgba(0,0,0,0.35)] hover:ring-white/40 focus:outline-none sheen-wrapper"
      >
        {imgSrc && !hasError ? (
          <>
            {!isLoaded && (
              <div className="absolute inset-0 bg-white/[0.04] animate-pulse" />
            )}
            <img
              src={imgSrc}
              alt={title}
              className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
              loading="eager"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
              onError={handleImageError}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{title}</span>
          </div>
        )}

        {/* Top left status and custom tag badges */}
        <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-1 max-w-[75%]">
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
        {item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/10">
            <Star className="w-3 h-3 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}
      </Link>

      {/* Details (always visible below) */}
      <div className="flex flex-col gap-1 px-1">
        <h3 className="text-foreground font-bold text-sm leading-tight line-clamp-2">
          {title}
        </h3>
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
