"use client";

import Link from "next/link";
import { Play, Info, Star, Calendar, Clock } from "lucide-react";
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
}

interface HeroBannerProps {
  item: MediaItem;
}

export function HeroBanner({ item }: HeroBannerProps) {
  if (!item) return null;

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : "";

  const isMovie = item.media_type === "movie" || !!item.title;
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const watchLink = isMovie
    ? `https://www.vidking.net/embed/movie/${item.id}`
    : `https://www.vidking.net/embed/tv/${item.id}`;

  return (
    <div className="relative w-full h-[75vh] md:h-[90vh] flex items-end overflow-hidden">
      <div className="absolute inset-0 z-0">
        {backdropUrl ? (
          <motion.img
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover object-top"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-900/20 via-background to-background" />
        )}

        {/* Cinematic gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-background/80 to-transparent" />
        
        {/* Subtle vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        
        {/* Glow accent from bottom */}
        <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-violet-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 pb-16 md:pb-24 px-5 md:px-10 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex items-center gap-3 mb-5"
        >
          <span className="flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] uppercase px-4 py-1.5 bg-gradient-to-r from-violet-500/20 to-violet-600/10 border border-violet-500/30 rounded-full text-violet-300">
            {isMovie ? "Movie" : "TV Series"}
          </span>
          {year && (
            <span className="flex items-center gap-1 text-xs font-semibold text-white/50 tracking-wider">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          )}
          {item.vote_average ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
              <Star className="w-3 h-3 fill-current" />
              {item.vote_average.toFixed(1)}
            </span>
          ) : null}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="font-bold text-4xl sm:text-5xl md:text-7xl text-white leading-tight mb-5 tracking-tight"
          style={{ textShadow: "0 4px 30px rgba(0,0,0,0.5)" }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-white/60 text-base md:text-lg leading-relaxed line-clamp-3 mb-8 max-w-xl font-medium"
        >
          {item.overview}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="flex items-center gap-3 flex-wrap"
        >
          <a
            href={watchLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 active:scale-95 text-white font-bold px-8 py-4 rounded-xl text-sm transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
          >
            <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
            Watch Now
          </a>

          <Link
            href={link}
            className="flex items-center gap-2 glass-light hover:bg-white/[0.08] active:scale-95 text-white font-semibold px-6 py-4 rounded-xl text-sm transition-all duration-300"
          >
            <Info className="w-4 h-4" />
            More Info
          </Link>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-20" />
      
      {/* Side fade for depth */}
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background/30 to-transparent pointer-events-none z-10" />
    </div>
  );
}
