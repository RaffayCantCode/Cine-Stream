"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Play, Info, Star, Calendar, Languages, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { isTmdbAnime } from "@/lib/utils";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
}

interface HeroBannerProps {
  item: MediaItem;
}

export function HeroBanner({ item }: HeroBannerProps) {
  if (!item) return null;

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : "";

  // Preload the hero backdrop so it appears instantly instead of fading in after a delay
  useEffect(() => {
    if (!backdropUrl) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = backdropUrl;
    link.fetchPriority = "high";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [backdropUrl]);

  const isMovie = item.media_type === "movie" || !!item.title;
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const watchLink = `${link}?autoplay=1`;

  return (
    <div className="relative w-full h-[55vh] md:h-[70vh] flex items-end overflow-hidden">
      {/* Background image & gradient overlays */}
      <div className="absolute inset-0 z-0">
        {backdropUrl ? (
          <>
            <motion.img
              src={backdropUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover object-top"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
            />
            {/* Dynamic overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d1233]/70 via-[#0d1233]/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#111844]/30 via-background to-background" />
        )}

        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#4B5694]/5 via-transparent to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#7288AE]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#111844]/10 rounded-full blur-[90px] pointer-events-none" />
      </div>

      {/* Content wrapper */}
      <div className="relative z-10 h-full flex flex-col justify-between px-6 md:px-12 pt-6 pb-10 max-w-screen-2xl mx-auto w-full">
        {/* Top bar: Spotlight label & identity pill */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-[#7288AE] animate-pulse" />
            Spotlight Media
          </div>

          {/* Brand Identity Pill */}
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/15 backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, rgba(75,86,148,0.25), rgba(114,136,174,0.1))`,
              boxShadow: `0 4px 24px rgba(75,86,148,0.15)`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 bg-gradient-to-br from-[#4B5694] to-[#7288AE]"
            >
              <img src="/logo-icon.svg" alt="CineStream" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/40">Featured</p>
              <p className="text-sm font-black text-white leading-none">CineStream</p>
            </div>
          </div>
        </div>

        {/* Hero Item Info block */}
        <div className="max-w-xl">
          <p
            className="text-xs font-bold tracking-[0.2em] uppercase mb-2.5 px-3 py-1 rounded-full inline-block"
            style={{
              background: `rgba(75,86,148,0.25)`,
              border: `1px solid rgba(114,136,174,0.3)`,
              color: `#7288AE`,
            }}
          >
            {isMovie ? "Featured Film" : "Featured Series"}
          </p>
          
          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3.5 tracking-tight drop-shadow-2xl">
            {title}
          </h1>

          {item.overview && (
            <p className="text-sm text-white/70 line-clamp-2 mb-5 leading-relaxed max-w-lg">
              {item.overview}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={watchLink}
              className="flex items-center gap-2 text-sm font-bold text-white px-5 py-3 rounded-xl transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-lg shadow-[#4B5694]/20"
              style={{
                background: `linear-gradient(135deg, #4B5694, #7288AE)`,
                boxShadow: `0 4px 20px rgba(75,86,148,0.4)`,
              }}
            >
              <Play className="w-4 h-4 fill-current" />
              Watch Now
            </Link>
            
            <Link
              href={link}
              className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/10 transition-all active:scale-95"
            >
              <Info className="w-4 h-4" />
              More Info
            </Link>

            {item.vote_average ? (
              <span className="flex items-center gap-1 text-amber-400 text-sm font-bold bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-amber-400/20">
                <Star className="w-3.5 h-3.5 fill-current" />
                {item.vote_average.toFixed(1)}
              </span>
            ) : null}

            {year && (
              <span className="flex items-center gap-1 text-white/60 text-xs font-semibold bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10">
                <Calendar className="w-3.5 h-3.5" />
                {year}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
