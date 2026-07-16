"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Play } from "lucide-react";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
  genre_ids?: number[];
  profile_path?: string;
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
  const isPerson = item.media_type === "person";
  const isMovie = item.media_type === "movie" || (!isPerson && !!item.title);
  const title = item.title || item.name || "";
  let link = isPerson ? `/person/${item.id}` : isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.profile_path 
    ? `https://image.tmdb.org/t/p/w342${item.profile_path}`
    : item.poster_path
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
        className={`group relative block shrink-0 transition-all duration-300 hover:scale-[1.035] hover:z-10 focus:outline-none touch-pan-x ${
          rank ? "w-[142px] sm:w-[168px] md:w-[196px]" : "w-[132px] sm:w-[158px] md:w-[186px]"
        }`}
        style={{ transformOrigin: "center bottom" }}
      >
        {rank && (
          <div 
            className="absolute -left-2 bottom-[-10px] text-[104px] sm:text-[132px] md:text-[164px] font-black leading-none z-0 select-none pointer-events-none"
            style={{ 
              WebkitTextStroke: "1.5px rgba(255,255,255,0.72)", 
              WebkitTextFillColor: "transparent",
              textShadow: "0 8px 18px rgba(0,0,0,0.75)"
            }}
          >
            {rank}
          </div>
        )}
        <div 
          className={`relative z-10 w-full h-full overflow-hidden rounded-xl bg-muted/50 ring-1 ring-white/[0.07] shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-all duration-300 group-hover:shadow-xl group-hover:shadow-primary/25 group-hover:ring-[#7288AE]/55 ${
            rank ? "ml-8 w-[calc(100%-2rem)]" : "w-full"
          }`}
          style={{ aspectRatio: "2/3" }}
        >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes={rank ? "(max-width: 640px) 110px, (max-width: 768px) 136px, 164px" : "(max-width: 640px) 132px, (max-width: 768px) 158px, 186px"}
            className="object-cover transition-all duration-500 group-hover:scale-105"
            priority={isPriority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{title}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-transparent opacity-50 group-hover:opacity-0 transition-opacity duration-300" />

        <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
          {!isPerson && item.vote_average && item.vote_count && item.vote_count > 20 ? (
            <div className="flex justify-end">
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-xl text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/10">
                <Star className="w-3 h-3 fill-current" />
                {item.vote_average.toFixed(1)}
              </div>
            </div>
          ) : (
            <div />
          )}

          {!isPerson && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#111844] to-[#4B5694] flex items-center justify-center translate-y-3 group-hover:translate-y-0 transition-all duration-300 group-hover:scale-105 shadow-lg shadow-black/30">
                <Play className="w-5 h-5 fill-white text-white ml-0.5" />
              </div>
            </div>
          )}

          <div className="relative z-10 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-white font-bold text-[13px] leading-tight mb-1.5 line-clamp-2 drop-shadow-lg">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              {year && !isPerson && (
                <span className="text-white/80 text-xs font-medium bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded">
                  {year}
                </span>
              )}
              <span className="text-white/50 text-xs">
                {isPerson ? "Person" : isMovie ? "Movie" : "TV"}
              </span>
            </div>
          </div>
        </div>

        {!isPerson && item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded-md group-hover:opacity-0 transition-opacity duration-300">
            <Star className="w-2.5 h-2.5 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}

        </div>
      </Link>
    </div>
  );
}
