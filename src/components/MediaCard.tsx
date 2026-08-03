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
  priority?: boolean;
  showMediaBadge?: boolean;
}

const CARD_WRAPPER_STYLE: React.CSSProperties = {
  animation: "fade-in-up 0.35s ease-out both",
};

export function MediaCard({ item, index = 0, rank, priority, showMediaBadge = false }: MediaCardProps) {
  const isPerson = item.media_type === "person";
  const isMovie = item.media_type === "movie" || (!isPerson && !!item.title);
  const title = item.title || item.name || "";
  let link = isPerson ? `/person/${item.id}` : isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.profile_path 
    ? (item.profile_path.startsWith("http") ? item.profile_path : `https://image.tmdb.org/t/p/w342${item.profile_path}`)
    : item.poster_path
    ? (item.poster_path.startsWith("http") ? item.poster_path : `https://image.tmdb.org/t/p/w342${item.poster_path}`)
    : null;

  const isPriority = priority ?? (rank !== undefined && index < 4);

  return (
    <div
      className="row-item"
      style={{ ...CARD_WRAPPER_STYLE, animationDelay: `${index * 0.03}s` }}
    >
      <Link
        href={link}
        className={`group relative block shrink-0 transition-all duration-300 hover:scale-[1.035] hover:z-10 focus:outline-none touch-pan-y touch-pan-x ${
          rank ? "w-[158px] sm:w-[194px] md:w-[220px]" : "w-[136px] sm:w-[165px] md:w-[188px]"
        }`}
        style={{ transformOrigin: "center bottom" }}
      >
        {rank && (
          <div 
            className={`absolute bottom-[-10px] font-black leading-none z-0 select-none pointer-events-none tracking-tighter ${
              rank === 1
                ? "-left-2 sm:-left-3 md:-left-4 text-[100px] sm:text-[126px] md:text-[152px]"
                : rank === 10
                ? "-left-5 sm:-left-6 md:-left-7 text-[84px] sm:text-[108px] md:text-[130px]"
                : "-left-4 sm:-left-5 md:-left-6 text-[102px] sm:text-[130px] md:text-[156px]"
            }`}
            style={{ 
              background: rank === 1 
                ? "linear-gradient(180deg, #FDE68A 0%, #F59E0B 50%, #B45309 100%)" 
                : "linear-gradient(180deg, #FFFFFF 0%, #D3D1CE 45%, #6C6D74 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              WebkitTextStroke: "1px rgba(255,255,255,0.2)",
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.95)) drop-shadow(0 0 16px rgba(211,209,206,0.15))"
            }}
          >
            {rank}
          </div>
        )}
        <div 
          className={`relative z-10 w-full h-full overflow-hidden rounded-xl bg-card/80 ring-1 ring-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.65)] transition-all duration-300 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.9)] group-hover:ring-white/35 sheen-wrapper ${
            rank ? "ml-6 sm:ml-7 md:ml-8 w-[calc(100%-1.5rem)] sm:w-[calc(100%-1.75rem)] md:w-[calc(100%-2rem)]" : "w-full"
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

        {showMediaBadge && !isPerson && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 pointer-events-none">
            <span className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white shadow-lg backdrop-blur-md border ${
              isMovie ? "bg-rose-600/85 border-rose-500/30" : "bg-emerald-600/85 border-emerald-500/30"
            }`}>
              {isMovie ? "MOVIE" : "TV SHOW"}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-40 group-hover:opacity-0 transition-opacity duration-300" />

        <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
          {!isPerson && item.vote_average && item.vote_count && item.vote_count > 20 ? (
            <div className="flex justify-end">
              <div className="flex items-center gap-1 bg-black/75 backdrop-blur-xl text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/15 shadow-md">
                <Star className="w-3 h-3 fill-current" />
                {item.vote_average.toFixed(1)}
              </div>
            </div>
          ) : (
            <div />
          )}

          {!isPerson && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/65 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-all duration-300 group-hover:scale-110 shadow-[0_10px_25px_rgba(0,0,0,0.8)] group-hover:bg-white group-hover:text-black group-hover:border-white">
                <Play className="w-5 h-5 fill-current ml-0.5 transition-colors" />
              </div>
            </div>
          )}

          <div className="relative z-10 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-white font-extrabold text-[13px] leading-snug mb-1.5 line-clamp-2 drop-shadow-md tracking-tight">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              {year && !isPerson && (
                <span className="text-white/90 text-xs font-semibold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                  {year}
                </span>
              )}
              <span className="text-white/60 text-xs font-medium uppercase tracking-wider">
                {isPerson ? "Person" : isMovie ? "Movie" : "TV"}
              </span>
            </div>
          </div>
        </div>

        {!isPerson && item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-md text-amber-400 text-xs font-bold px-2 py-0.5 rounded-md border border-white/10 shadow-sm group-hover:opacity-0 transition-opacity duration-300">
            <Star className="w-2.5 h-2.5 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}

        </div>
      </Link>
    </div>
  );
}
