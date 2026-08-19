"use client";

import Link from "next/link";
import { Star } from "lucide-react";

interface MediaItem {
  id: number;
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
  const isAnime = item.media_type === "anime";
  const isTv = item.media_type === "tv" || (!!item.first_air_date && !item.release_date);
  const isMovie = item.media_type === "movie" || (!isAnime && !isTv);

  let link = (item as any).targetUrl || (item as any).target_url;
  if (!link) {
    link = isAnime ? `/anime/${item.id}` : isTv ? `/tv/${item.id}` : `/movie/${item.id}`;
  }
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.poster_path
    ? item.poster_path.startsWith("http")
      ? item.poster_path
      : `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;

  return (
    <div
      className="group flex flex-col gap-3 animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 0.02, 0.6)}s` }}
    >
      <Link
        href={link}
        className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl bg-card/80 ring-1 ring-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_22px_45px_rgba(0,0,0,0.85)] hover:ring-white/35 focus:outline-none sheen-wrapper"
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{title}</span>
          </div>
        )}

        {/* Top left status badge */}
        {(item as any).isUpcoming || (item as any).status === "upcoming" ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500/90 text-amber-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md backdrop-blur-sm">
            Upcoming
          </div>
        ) : (item as any).isUnavailable || (item as any).status === "unavailable" ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-zinc-700/90 text-zinc-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md backdrop-blur-sm">
            Unavailable
          </div>
        ) : null}

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
          <span>{isAnime ? "Anime" : isMovie ? "Movie" : "TV"}</span>
        </div>
        {item.reason && (
          <div className="text-[10px] font-medium text-emerald-400 mt-0.5 line-clamp-1">
            ✨ {item.reason}
          </div>
        )}
      </div>
    </div>
  );
}
