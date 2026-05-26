"use client";

import Link from "next/link";
import { Play, Info, Star, Calendar } from "lucide-react";
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
  const watchLink = `${link}?autoplay=1`;

  return (
    <div className="relative w-full h-[80vh] md:h-[92vh] flex items-end overflow-hidden">
      <div className="absolute inset-0 z-0">
        {backdropUrl ? (
          <>
            <motion.img
              src={backdropUrl}
              alt={title}
              className="w-full h-full object-cover object-top"
              initial={{ opacity: 0, scale: 1.15 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 2.2, ease: [0.25, 0.1, 0.25, 1] }}
            />
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5 }}
              style={{
                background: `
                  linear-gradient(to top, hsl(259 30% 4%) 0%, hsl(259 30% 4% / 0.8) 30%, hsl(259 30% 4% / 0.2) 60%, transparent 100%),
                  linear-gradient(to right, hsl(259 30% 4% / 0.9) 0%, transparent 40%),
                  linear-gradient(to bottom, transparent 0%, hsl(259 30% 4% / 0.8) 90%, hsl(259 30% 4%) 100%)
                `
              }}
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#462C7D]/30 via-background to-background" />
        )}

        <div className="absolute bottom-0 inset-x-0 h-72 bg-gradient-to-t from-[#831C91]/8 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D552A3]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#462C7D]/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 pb-20 md:pb-28 px-5 md:px-14 max-w-4xl pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="flex items-center gap-3 mb-5"
        >
          <span className="flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] uppercase px-4 py-1.5 bg-gradient-to-r from-[#831C91]/20 to-[#D552A3]/10 border border-[#D552A3]/30 rounded-full text-[#D552A3] backdrop-blur-xl">
            {isMovie ? "Movie" : "TV Series"}
          </span>
          {year && (
            <span className="flex items-center gap-1 text-xs font-semibold text-white/50 tracking-wider backdrop-blur-sm">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          )}
          {item.vote_average ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 backdrop-blur-sm">
              <Star className="w-3 h-3 fill-current" />
              {item.vote_average.toFixed(1)}
            </span>
          ) : null}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="font-black text-5xl sm:text-6xl md:text-8xl text-white leading-none mb-6 tracking-tight"
          style={{ textShadow: "0 4px 40px rgba(0,0,0,0.6)" }}
        >
          <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
            {title}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-white/60 text-base md:text-lg leading-relaxed line-clamp-3 mb-10 max-w-2xl font-medium drop-shadow-lg"
        >
          {item.overview}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="flex items-center gap-4 flex-wrap"
        >
          <Link
            href={watchLink}
            className="group flex items-center gap-2.5 bg-gradient-to-r from-[#462C7D] to-[#831C91] hover:from-[#831C91] hover:to-[#D552A3] active:scale-95 text-white font-bold px-8 py-4 rounded-xl text-sm transition-all duration-300 shadow-2xl shadow-[#831C91]/40 hover:shadow-[#D552A3]/30 hover:shadow-2xl"
          >
            <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
            Watch Now
          </Link>

          <Link
            href={link}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 active:scale-95 text-white font-semibold px-6 py-4 rounded-xl text-sm transition-all duration-300 backdrop-blur-xl border border-white/10 shadow-lg"
          >
            <Info className="w-4 h-4" />
            More Info
          </Link>
        </motion.div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-20" />
      <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-background/40 to-transparent pointer-events-none z-10" />
    </div>
  );
}
