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
}

interface GridMediaCardProps {
  item: MediaItem;
  index?: number;
}

export function GridMediaCard({ item, index = 0 }: GridMediaCardProps) {
  const isMovie = item.media_type === "movie" || !!item.title;
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;

  return (
    <div
      className="group flex flex-col gap-3 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <Link
        href={link}
        className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl bg-muted/50 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/40 hover:ring-2 hover:ring-primary/50 focus:outline-none"
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

        {/* Top right rating badge */}
        {item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-md text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/10">
            <Star className="w-3 h-3 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}
      </Link>

      {/* Details (always visible below) */}
      <div className="flex flex-col gap-1 px-1">
        <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-white/50 text-xs font-medium">
          {year && <span>{year}</span>}
          {year && <span>•</span>}
          <span>{isMovie ? "Movie" : "TV"}</span>
        </div>
      </div>
    </div>
  );
}
