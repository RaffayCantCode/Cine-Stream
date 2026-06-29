"use client";

import Link from "next/link";
import { Star, Play } from "lucide-react";
import { isTmdbAnime } from "@/lib/utils";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  original_language?: string;
  genre_ids?: number[];
}

interface MediaCardProps {
  item: MediaItem;
  index?: number;
  rank?: number;
}

const CARD_WRAPPER_STYLE: React.CSSProperties = {
  animation: "fade-in-up 0.35s ease-out both",
};

export function MediaCard({ item, index = 0, rank }: MediaCardProps) {
  const isMovie = item.media_type === "movie" || !!item.title;
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;

  const isPriority = index < 6;

  return (
    <div
      className="row-item"
      style={{ ...CARD_WRAPPER_STYLE, animationDelay: `${index * 0.03}s` }}
    >
      <Link
        href={link}
        className={`group relative block shrink-0 transition-all duration-300 hover:scale-[1.05] hover:z-10 focus:outline-none ${
          rank ? "w-[200px] sm:w-[240px] md:w-[280px]" : "w-[150px] sm:w-[180px] md:w-[200px]"
        }`}
        style={{ transformOrigin: "center bottom" }}
      >
        {rank && (
          <div 
            className="absolute -left-6 bottom-[-20px] text-[140px] sm:text-[180px] md:text-[220px] font-black leading-none z-0 select-none pointer-events-none drop-shadow-2xl"
            style={{ 
              WebkitTextStroke: "2px rgba(255,255,255,0.8)", 
              WebkitTextFillColor: "transparent",
              textShadow: "4px 4px 10px rgba(0,0,0,0.8)"
            }}
          >
            {rank}
          </div>
        )}
        <div 
          className={`relative z-10 w-full h-full overflow-hidden rounded-2xl bg-muted/50 hover:shadow-2xl hover:shadow-primary/40 hover:ring-2 hover:ring-primary/50 ${
            rank ? "ml-12 w-[calc(100%-3rem)]" : "w-full"
          }`}
          style={{ aspectRatio: "2/3" }}
        >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
            loading={isPriority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={isPriority ? "high" : "low"}
            width={210}
            height={315}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{title}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-500" />

        <div className="absolute inset-0 flex flex-col justify-between p-3.5 opacity-0 group-hover:opacity-100 transition-all duration-500">
          {item.vote_average ? (
            <div className="flex justify-end">
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-xl text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/10">
                <Star className="w-3 h-3 fill-current" />
                {item.vote_average.toFixed(1)}
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#111844] to-[#4B5694] flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-all duration-500 group-hover:scale-110">
              <Play className="w-6 h-6 fill-white text-white ml-0.5" />
            </div>
          </div>

          <div className="relative z-10 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
            <h3 className="text-white font-bold text-sm leading-tight mb-1.5 line-clamp-2 drop-shadow-lg">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              {year && (
                <span className="text-white/80 text-xs font-medium bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded">
                  {year}
                </span>
              )}
              <span className="text-white/50 text-xs">
                {isMovie ? "Movie" : "TV"}
              </span>
            </div>
          </div>
        </div>

        {item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded-md group-hover:opacity-0 transition-opacity duration-300">
            <Star className="w-2.5 h-2.5 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}

        {isTmdbAnime(item) && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-gradient-to-r from-[#4B5694]/90 to-[#7288AE]/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-sm tracking-wider uppercase group-hover:opacity-0 transition-opacity duration-300">
            Eng Dub
          </div>
        )}
        </div>
      </Link>
    </div>
  );
}