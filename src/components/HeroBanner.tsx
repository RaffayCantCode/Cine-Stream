"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Play, Info, Star, Calendar, Sparkles, Languages } from "lucide-react";
import { isTmdbAnime } from "@/lib/utils";
import { motion } from "framer-motion";

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
       Mobile: tall enough (min-h) to accommodate all content safely.
       Tablet+: taller cinematic band.
    ─────────────────────────────────────────────────────────────────────────── */
    <div className="relative w-full min-h-[500px] h-[72vw] max-h-[560px] sm:h-[60vw] sm:max-h-[640px] md:h-[70vh] md:max-h-none flex items-end overflow-hidden">
      {/* ── Background image & gradient overlays ─────────────────────────── */}
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
            {/* Stronger left → centre gradient on mobile for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d1233]/90 via-[#0d1233]/50 to-transparent md:from-[#0d1233]/70 md:via-[#0d1233]/20" />
            {/* Bottom-up gradient — heavier on mobile */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent md:via-background/30" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-transparent md:from-background/25" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#111844]/30 via-background to-background" />
        )}

        {/* Ambient glow blobs */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#4B5694]/5 via-transparent to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#7288AE]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#111844]/10 rounded-full blur-[90px] pointer-events-none" />
      </div>

      {/* ── Content wrapper ───────────────────────────────────────────────── */}
      <div className="relative z-10 h-full flex flex-col justify-between px-4 sm:px-6 md:px-12 pt-4 sm:pt-6 pb-6 sm:pb-8 md:pb-10 max-w-screen-2xl mx-auto w-full">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between w-full">
          {/* Spotlight label */}
          <div className="flex items-center gap-1.5 text-white/50 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7288AE] animate-pulse" />
            <span className="hidden xs:inline">Spotlight Media</span>
            <span className="xs:hidden">Spotlight</span>
          </div>

          {/* Brand Identity Pill — full on sm+, icon-only on tiny screens */}
          <div
            className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/15 backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, rgba(75,86,148,0.25), rgba(114,136,174,0.1))`,
              boxShadow: `0 4px 24px rgba(75,86,148,0.15)`,
            }}
          >
            <div
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border border-white/10 bg-gradient-to-br from-[#4B5694] to-[#7288AE] shrink-0"
            >
              <img src="/logo-icon.svg" alt="CineStream" className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            {/* Hide text label on screens narrower than 380px to avoid crowding */}
            <div className="hidden [min-width:360px]:block sm:block">
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/40">Featured</p>
              <p className="text-xs sm:text-sm font-black text-white leading-none">CineStream</p>
            </div>
          </div>
        </div>

        {/* ── Hero item info block ──────────────────────────────────────────── */}
        <div className="max-w-sm sm:max-w-lg md:max-w-xl w-full">
          {/* Type badge + anime language badge */}
          <div className="flex items-center gap-2.5 mb-3 sm:mb-2.5 flex-wrap">
            <p
              className="text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase px-3 sm:px-3 py-1.5 rounded-full inline-block"
              style={{
                background: `rgba(75,86,148,0.25)`,
                border: `1px solid rgba(114,136,174,0.3)`,
                color: `#7288AE`,
              }}
            >
              {isMovie ? "Featured Film" : "Featured Series"}
            </p>

            {isTmdbAnime(item) && (
              <span
                className="flex items-center gap-1.5 text-[13px] sm:text-sm font-black tracking-wider uppercase px-3.5 py-1.5 rounded-full"
                style={{
                  background: `rgba(75,86,148,0.35)`,
                  border: `1px solid rgba(114,136,174,0.4)`,
                  color: `#fff`,
                }}
              >
                <Languages className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                Eng Dub
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight mb-2 sm:mb-3 md:mb-3.5 tracking-tight drop-shadow-2xl line-clamp-2">
            {title}
          </h1>

          {/* Description — smaller on mobile, clamped to 2 lines */}
          {item.overview && (
            <p className="text-xs sm:text-sm text-white/70 line-clamp-2 mb-3 sm:mb-4 md:mb-5 leading-relaxed">
              {item.overview}
            </p>
          )}

          {/* ── Action row ────────────────────────────────────────────────── */}
          {/* Buttons stack vertically on mobile, side-by-side on sm+ */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* Primary: Watch Now */}
            <Link
              href={watchLink}
              className="flex items-center justify-center gap-2 text-sm font-bold text-white px-5 py-3 rounded-xl transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-lg shadow-[#4B5694]/20 w-full sm:w-auto"
              style={{
                background: `linear-gradient(135deg, #4B5694, #7288AE)`,
                boxShadow: `0 4px 20px rgba(75,86,148,0.4)`,
              }}
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              Watch Now
            </Link>

            {/* Secondary: More Info */}
            <Link
              href={link}
              className="flex items-center justify-center gap-2 text-sm font-semibold text-white px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/10 transition-all active:scale-95 w-full sm:w-auto"
            >
              <Info className="w-4 h-4 shrink-0" />
              More Info
            </Link>

            {/* Meta badges — side by side on their own row on mobile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {item.vote_average ? (
                <span className="flex items-center gap-1 text-amber-400 text-xs sm:text-sm font-bold bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-amber-400/20 shrink-0">
                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                  {item.vote_average.toFixed(1)}
                </span>
              ) : null}

              {year && (
                <span className="flex items-center gap-1 text-white/60 text-xs font-semibold bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10 shrink-0">
                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {year}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
