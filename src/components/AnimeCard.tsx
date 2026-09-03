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
  bannerImage?: string | null;
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
  isUpcoming?: boolean;
  isUnavailable?: boolean;
  isHidden?: boolean;
  customTags?: string[];
  tags?: string[];
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
        prefetch={false}
        className={`group relative block shrink-0 transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-2 hover:z-20 focus:outline-none will-change-transform ${
          rank ? "w-[155px] sm:w-[185px] md:w-[212px] lg:w-[230px]" : "w-full"
        }`}
        style={{ transformOrigin: "center center" }}
      >
        {rank && (
          <div 
            className={`absolute bottom-[-10px] font-black leading-none z-0 select-none pointer-events-none tracking-tighter ${
              rank === 1
                ? "-left-2 sm:-left-3 text-[100px] sm:text-[120px] md:text-[142px]"
                : rank === 10
                ? "-left-4 sm:-left-5 text-[82px] sm:text-[100px] md:text-[118px]"
                : "-left-3 sm:-left-4 text-[102px] sm:text-[122px] md:text-[144px]"
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
          className={`relative z-10 w-full h-full overflow-hidden rounded-xl bg-card/80 ring-1 ring-white/10 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.5),0_2px_6px_-2px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:shadow-[0_20px_35px_-8px_rgba(0,0,0,0.65),0_8px_16px_-4px_rgba(0,0,0,0.35)] group-hover:ring-white/40 sheen-wrapper ${
            rank ? "ml-6 sm:ml-7 md:ml-8 w-[calc(100%-1.5rem)] sm:w-[calc(100%-1.75rem)] md:w-[calc(100%-2rem)]" : "w-full"
          }`}
          style={{ aspectRatio: "2/3" }}
        >
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.name}
            className="w-full h-full object-cover"
            loading={rank !== undefined && index < 4 ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{item.name}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 z-20 flex flex-wrap items-center gap-1.5 pointer-events-none max-w-[85%]">
          {item.isUpcoming || item.status === "upcoming" ? (
            <span className="bg-amber-500/90 border border-amber-400/50 text-white text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
              UPCOMING
            </span>
          ) : item.isUnavailable || item.status === "unavailable" ? (
            <span className="bg-zinc-700/90 border border-zinc-500/50 text-zinc-200 text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
              UNAVAILABLE
            </span>
          ) : (
            <>
              <span className="bg-purple-950/80 border border-purple-500/30 text-purple-200 text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
                JP SUB
              </span>
              {dubCount !== null && dubCount > 0 && (
                <span className="bg-amber-500/90 border border-amber-400/40 text-white text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
                  DUB
                </span>
              )}
            </>
          )}
          {Array.isArray((item as any).customTags || (item as any).tags) && ((item as any).customTags || (item as any).tags).slice(0, 2).map((tag: string, i: number) => (
            <span key={i} className="bg-purple-600/90 border border-purple-400/50 text-white text-[9px] sm:text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-md uppercase leading-none shadow-lg">
              {tag}
            </span>
          ))}
        </div>

        <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none z-10" />

        {/* Hover overlay: Play button & EPS badge */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none">
          <div className="absolute top-2 right-2">
            {subCount !== null && subCount > 0 && (
              <span className="bg-black/75 border border-white/15 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-md">
                {subCount} EPS
              </span>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/65 border border-white/30 text-white flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-all duration-300 group-hover:scale-110 shadow-[0_10px_25px_rgba(0,0,0,0.8)] group-hover:bg-white group-hover:text-black group-hover:border-white">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5 transition-colors" />
            </div>
          </div>
        </div>

        {/* Persistent Title & Hover Genre / Reason Layer */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-3 pointer-events-none flex flex-col justify-end">
          <div className="transform transition-transform duration-300 group-hover:-translate-y-4">
            <h3 className="text-white font-extrabold text-xs sm:text-sm leading-snug line-clamp-2 drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-tight">
              {item.name}
            </h3>
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            {item.genres && item.genres.length > 0 ? (
              <span className="text-[10px] sm:text-[11px] font-black text-fuchsia-300 line-clamp-1 uppercase tracking-widest leading-none drop-shadow-md">
                {item.genres.slice(0, 2).join(" · ")}
              </span>
            ) : item.seasonYear ? (
              <span className="text-white/90 text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded border border-white/10 shadow-sm">
                {item.seasonYear}
              </span>
            ) : null}
          </div>
        </div>

        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/0 group-hover:ring-[#7288AE]/40 transition-all duration-500 pointer-events-none" />
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(213,82,163,0.15)" }} />
        </div>
      </Link>
    </div>
  );
});
