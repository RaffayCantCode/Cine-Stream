"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Play, Info, Star, Calendar, Sparkles } from "lucide-react";
import { isTmdbAnime } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
    /* ─── Hero container ───────────────────────────────────────────────────────
       Mobile: Use vh-based sizing to ensure proper full-screen feel without clipping
       Tablet+: cinematic band.
    ─────────────────────────────────────────────────────────────────────────── */
    <div className="relative w-full h-[85svh] min-h-[500px] max-h-[750px] sm:h-[60vw] sm:max-h-[640px] md:h-[75vh] md:max-h-none flex items-end overflow-hidden">
      {/* ── Background image & gradient overlays ─────────────────────────── */}
      <div className="absolute inset-0 z-0 bg-black">
        {backdropUrl ? (
          <AnimatePresence mode="wait">
            <motion.img
              key={backdropUrl}
              src={backdropUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover md:object-top opacity-70 sm:opacity-100"
              style={{ objectPosition: "center 20%" }}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </AnimatePresence>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#111844]/30 via-background to-background" />
        )}

        {/* Always-mounted gradient overlays (no animation needed) */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent sm:from-[#0d1233]/90 sm:via-[#0d1233]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent sm:via-background/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent sm:from-background/25" />

        {/* Ambient glow blobs */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#4B5694]/10 via-transparent to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#7288AE]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#111844]/20 rounded-full blur-[90px] pointer-events-none" />
      </div>

      {/* ── Content wrapper ───────────────────────────────────────────────── */}
      <div className="relative z-10 h-full flex flex-col justify-between px-4 sm:px-6 md:px-12 pt-6 sm:pt-6 pb-12 sm:pb-12 md:pb-14 max-w-screen-2xl mx-auto w-full">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between w-full mt-2 sm:mt-0">
          {/* Spotlight label */}
          <div className="flex items-center gap-1.5 text-white/60 text-[10px] sm:text-xs font-semibold uppercase tracking-wider backdrop-blur-md bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7288AE] animate-pulse" />
            <span className="hidden [min-width:360px]:inline">Spotlight Media</span>
            <span className="inline [min-width:360px]:hidden">Spotlight</span>
          </div>

          {/* Brand Identity Pill */}
          <div
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-2xl border border-white/15 backdrop-blur-xl shadow-lg shadow-[#4B5694]/10"
            style={{
              background: `linear-gradient(135deg, rgba(75,86,148,0.3), rgba(114,136,174,0.1))`,
            }}
          >
            <div
              className="w-6 h-6 sm:w-9 sm:h-9 rounded-[10px] sm:rounded-xl flex items-center justify-center border border-white/20 bg-gradient-to-br from-[#4B5694] to-[#7288AE] shrink-0 shadow-inner"
            >
              <img src="/logo-icon.svg" alt="CineStream" className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="hidden [min-width:360px]:block sm:block">
              <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.2em] uppercase text-white/50">Featured</p>
              <p className="text-[11px] sm:text-sm font-black text-white leading-none">CineStream</p>
            </div>
          </div>
        </div>

        {/* ── Hero item info block ──────────────────────────────────────────── */}
        <motion.div
          key={`info-${item.id}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="max-w-full sm:max-w-lg md:max-w-2xl w-full flex flex-col justify-end"
        >
          {/* Tags Row: Type, Lang, Rating, Year */}
          <div className="flex items-center gap-2 sm:gap-2.5 mb-3 sm:mb-4 flex-wrap">
            <span
              className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg backdrop-blur-md shadow-sm"
              style={{
                background: `rgba(75,86,148,0.3)`,
                border: `1px solid rgba(114,136,174,0.4)`,
                color: `#A6BCE2`,
              }}
            >
              {isMovie ? "Featured Film" : "Featured Series"}
            </span>

            {isTmdbAnime(item) && (
              <span className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-black tracking-wider uppercase px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-[#4B5694]/40 border border-[#7288AE]/30 text-white backdrop-blur-md shadow-sm">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 640 480" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="640" height="480" fill="white"/>
                  <circle cx="320" cy="240" r="160" fill="#BC002D"/>
                </svg>
                JP Dub
              </span>
            )}

            {item.vote_average ? (
              <span className="flex items-center gap-1 text-amber-400 text-[10px] sm:text-xs font-bold bg-black/50 backdrop-blur-md px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg border border-amber-400/20 shadow-sm">
                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                {item.vote_average.toFixed(1)}
              </span>
            ) : null}

            {year && (
              <span className="flex items-center gap-1 text-white/80 text-[10px] sm:text-xs font-semibold bg-black/50 backdrop-blur-md px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg border border-white/10 shadow-sm">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/60" />
                {year}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-3 sm:mb-4 tracking-tight drop-shadow-2xl line-clamp-2 sm:line-clamp-3">
            {title}
          </h1>

          {/* Description */}
          {item.overview && (
            <p className="text-sm sm:text-base text-white/70 line-clamp-3 sm:line-clamp-2 md:line-clamp-3 mb-5 sm:mb-6 leading-relaxed max-w-xl text-shadow-sm font-medium">
              {item.overview}
            </p>
          )}

          {/* ── Action row ────────────────────────────────────────────────── */}
          {/* Side-by-side buttons on mobile and desktop */}
          <div className="flex flex-row items-center gap-2.5 sm:gap-4 w-full sm:w-auto mt-auto relative z-20">
            {/* Primary: Watch Now */}
            <Link
              href={watchLink}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm sm:text-base font-bold text-white px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(75,86,148,0.4)] hover:shadow-[0_0_25px_rgba(114,136,174,0.5)] border border-white/10 pointer-events-auto cursor-pointer"
              style={{
                background: `linear-gradient(135deg, #4B5694, #7288AE)`,
              }}
              prefetch={true}
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
              Watch Now
            </Link>

            {/* Secondary: More Info */}
            <Link
              href={link}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm sm:text-base font-semibold text-white px-5 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/20 transition-all active:scale-95 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] pointer-events-auto cursor-pointer"
              prefetch={true}
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              More Info
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
