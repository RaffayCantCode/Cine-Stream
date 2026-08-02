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
  status?: string | null;
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
        className={`group relative block shrink-0 transition-all duration-300 hover:scale-[1.035] hover:z-10 focus:outline-none touch-pan-y touch-pan-x ${
          rank ? "w-[140px] sm:w-[172px] md:w-[196px]" : "w-[118px] sm:w-[138px] md:w-[158px]"
        }`}
        style={{ transformOrigin: "center bottom" }}
      >
        {rank && (
          <div 
            className={`absolute bottom-[-10px] font-black leading-none z-0 select-none pointer-events-none tracking-tighter ${
              rank === 1
                ? "-left-2 sm:-left-3 md:-left-4 text-[94px] sm:text-[118px] md:text-[144px]"
                : rank === 10
                ? "-left-5 sm:-left-6 md:-left-7 text-[78px] sm:text-[102px] md:text-[124px]"
                : "-left-4 sm:-left-5 md:-left-6 text-[96px] sm:text-[124px] md:text-[150px]"
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
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading={rank !== undefined && index < 4 ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{item.name}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 pointer-events-none">
          <span className="bg-purple-950/80 backdrop-blur-md border border-purple-500/30 text-purple-200 text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
            JP SUB
          </span>
          {dubCount !== null && dubCount > 0 && (
            <span className="bg-amber-500/90 backdrop-blur-md border border-amber-400/40 text-white text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
              DUB
            </span>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none z-10" />

        {/* Hover overlay: Play button & EPS badge */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none">
          <div className="absolute top-2 right-2">
            {subCount !== null && subCount > 0 && (
              <span className="bg-black/75 backdrop-blur-md border border-white/15 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-md">
                {subCount} EPS
              </span>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/65 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-all duration-300 group-hover:scale-110 shadow-[0_10px_25px_rgba(0,0,0,0.8)] group-hover:bg-white group-hover:text-black group-hover:border-white">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5 transition-colors" />
            </div>
          </div>
        </div>

        {/* Persistent Title & Hover Genre Layer */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-3 pointer-events-none flex flex-col justify-end">
          {item.genres && item.genres.length > 0 && (
            <p className="text-[10px] sm:text-[11px] font-black text-fuchsia-300 line-clamp-1 uppercase tracking-widest leading-none drop-shadow-md mb-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
              {item.genres.slice(0, 2).join(" · ")}
            </p>
          )}

          <h3 className="text-white font-extrabold text-xs sm:text-sm leading-snug line-clamp-2 drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-tight">
            {item.name}
          </h3>
        </div>

        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/0 group-hover:ring-[#7288AE]/40 transition-all duration-500 pointer-events-none" />
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(213,82,163,0.15)" }} />
        </div>
      </Link>
    </div>
  );
});
