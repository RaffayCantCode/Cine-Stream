"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Play } from "lucide-react";
import { memo } from "react";

export interface AnimeItem {
  id: string;
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
        className={`group relative block shrink-0 transition-all duration-500 hover:scale-[1.06] hover:z-10 focus:outline-none ${
          rank ? "w-[200px] sm:w-[240px] md:w-[280px]" : "w-[150px] sm:w-[180px] md:w-[210px]"
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
          <Image
            src={item.poster}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 150px, (max-width: 768px) 180px, 210px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority={index < 6}
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

        <div className="absolute bottom-0 inset-x-0 z-10 p-2.5 sm:p-3 pointer-events-none">
          <h3 className="text-white font-bold text-xs sm:text-sm leading-tight line-clamp-2 drop-shadow-xl">
            {item.name}
          </h3>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4 pb-10">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="w-12 h-12 rounded-full bg-[#4B5694]/90 backdrop-blur-xl flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </div>
          </div>

          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap font-bold">
              {item.seasonYear && (
                <span className="bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm uppercase text-[10px] text-white/90">
                  {item.season ? `${item.season} ` : ""}{item.seasonYear}
                </span>
              )}
              {item.rating && (
                <span className="flex items-center gap-0.5 text-amber-400 bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded backdrop-blur-sm text-[10px]">
                  <Star className="w-3 h-3 fill-current" />
                  {item.rating}
                </span>
              )}
            </div>

            {item.genres && item.genres.length > 0 && (
              <p className="text-xs font-bold text-[#7288AE] line-clamp-1 uppercase tracking-wide leading-snug">
                {item.genres.slice(0, 2).join(" · ")}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {item.type && (
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                  {item.type}
                </span>
              )}
              {subCount !== null && (
                <span className="flex items-center gap-0.5 text-white/50 text-[10px] font-semibold">
                  {subCount} eps
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/0 group-hover:ring-[#7288AE]/40 transition-all duration-500 pointer-events-none" />
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(213,82,163,0.15)" }} />
        </div>
      </Link>
    </div>
  );
});