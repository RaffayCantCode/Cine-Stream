"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Play } from "lucide-react";
import { memo } from "react";

export interface AnimeItem {
  id: string;
  idMal?: string | null;
  name: string;
  jname?: string | null;
  poster: string;
  type?: string | null;
  episodes?: { sub: number | null; dub: number | null };
  rating?: string | null;
  description?: string;
  genres?: string[];
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  reason?: string;
}

interface AnimeCardProps {
  item: AnimeItem;
  index?: number;
  rank?: number;
}

const CARD_WRAPPER_STYLE: React.CSSProperties = {
  animation: "fade-in-up 0.35s ease-out both",
};

export const AnimeCard = memo(function AnimeCard({ item, index = 0, rank }: AnimeCardProps) {
  const subCount = item.episodes?.sub ?? null;
  const dubCount = item.episodes?.dub ?? null;

  return (
    <div
      style={{ ...CARD_WRAPPER_STYLE, animationDelay: `${index * 0.04}s` }}
    >
      <Link
        href={`/anime/${item.id}`}
        className={`group relative block shrink-0 transition-all duration-500 hover:scale-[1.06] hover:z-10 focus:outline-none touch-pan-x ${
          rank ? "w-[160px] sm:w-[190px] md:w-[220px]" : "w-[140px] sm:w-[170px] md:w-[200px]"
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
          className={`relative z-10 w-full h-full overflow-hidden rounded-2xl bg-muted hover:shadow-2xl hover:shadow-primary/40 hover:ring-2 hover:ring-primary/50 ${
            rank ? "ml-12 w-[calc(100%-3rem)]" : "w-full"
          }`}
          style={{ aspectRatio: "2/3" }}
        >
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading={index < 6 ? "eager" : "lazy"}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{item.name}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <span className="bg-[#4B5694]/90 backdrop-blur-xl text-white text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-1 rounded-md uppercase leading-none shadow-lg">
            JP SUB
          </span>
          {dubCount !== null && dubCount > 0 && (
            <span className="bg-amber-500/90 backdrop-blur-xl text-white text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-1 rounded-md uppercase leading-none shadow-lg">
              DUB
            </span>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

        <div className="absolute bottom-0 inset-x-0 z-10 p-2.5 sm:p-3 pointer-events-none transition-transform duration-500 group-hover:-translate-y-1">
          <h3 className="text-white font-bold text-xs sm:text-sm leading-tight line-clamp-2 drop-shadow-[0_2px_10px_rgba(0,0,0,1)]">
            {item.name}
          </h3>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-3 sm:p-4 pb-[3.5rem] sm:pb-[4.5rem]">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-xl flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-500 shadow-[0_0_20px_rgba(213,82,163,0.4)]">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white ml-0.5" />
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 flex-wrap font-black">
              {item.seasonYear && (
                <span className="bg-white/20 px-2 py-0.5 rounded backdrop-blur-md uppercase text-[10px] sm:text-[11px] text-white tracking-widest shadow-[0_4px_15px_rgba(0,0,0,0.5)] border border-white/20">
                  {item.season ? `${item.season} ` : ""}{item.seasonYear}
                </span>
              )}
              {item.rating && (
                <span className="flex items-center gap-1 text-amber-400 bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 rounded backdrop-blur-md text-[10px] sm:text-[11px] tracking-wider shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {item.rating}
                </span>
              )}
            </div>

            {item.genres && item.genres.length > 0 && (
              <p className="text-[11px] sm:text-xs font-black text-blue-300 line-clamp-1 uppercase tracking-widest leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                {item.genres.slice(0, 2).join(" · ")}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {item.type && (
                <span className="text-white/90 text-[11px] sm:text-xs font-black uppercase tracking-widest">
                  {item.type}
                </span>
              )}
              {subCount !== null && (
                <span className="flex items-center gap-1 text-emerald-400 text-[11px] sm:text-xs font-black tracking-wider">
                  {subCount} EPS
                </span>
              )}
            </div>

            {item.reason && (
              <div className="text-[10px] sm:text-[11px] font-black text-fuchsia-400 mt-0.5 line-clamp-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                ✨ {item.reason}
              </div>
            )}
          </div>
        </div>

        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/0 group-hover:ring-[#7288AE]/40 transition-all duration-500 pointer-events-none" />
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(213,82,163,0.15)" }} />
        </div>
      </Link>
    </div>
  );
});
