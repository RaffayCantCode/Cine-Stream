"use client";

import Link from "next/link";
import { Star, Play } from "lucide-react";
import { motion } from "framer-motion";
import { memo } from "react";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

interface MediaCardProps {
  item: MediaItem;
  index?: number;
}

// Memoized to prevent unnecessary re-renders
export const MediaCard = memo(function MediaCard({ item, index = 0 }: MediaCardProps) {
  const isMovie = item.media_type === "movie" || !!item.title;
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;
  
  // Priority loading for first 6 items (visible in viewport)
  const isPriority = index < 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: "easeOut" }}
      className="row-item"
      layout
    >
      <Link
        href={link}
        className="group relative block aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 overflow-hidden rounded-xl bg-muted/50 transition-all duration-300 hover:scale-[1.08] hover:z-10 focus:outline-none card-glow will-change-transform"
        style={{ transformOrigin: "center bottom" }}
        prefetch={false}
      >
        {/* Poster Image with performance optimizations */}
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
            loading={isPriority ? "eager" : "lazy"}
            decoding={isPriority ? "sync" : "async"}
            fetchPriority={isPriority ? "high" : "low"}
            width={210}
            height={315}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{title}</span>
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
        
        {/* Top gradient for better rating visibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-300" />

        {/* Hover Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-3.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
          {/* Top: Rating */}
          {item.vote_average ? (
            <div className="flex justify-end">
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/10">
                <Star className="w-3 h-3 fill-current" />
                {item.vote_average.toFixed(1)}
              </div>
            </div>
          ) : (
            <div />
          )}

          {/* Center: Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 translate-y-4 group-hover:translate-y-0 transition-all duration-300 group-hover:scale-110">
              <Play className="w-6 h-6 fill-white text-white ml-0.5" />
            </div>
          </div>

          {/* Bottom: Title & Year */}
          <div className="relative z-10 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-white font-bold text-sm leading-tight mb-1.5 line-clamp-2 drop-shadow-lg">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              {year && (
                <span className="text-white/70 text-xs font-medium bg-white/10 px-2 py-0.5 rounded">
                  {year}
                </span>
              )}
              <span className="text-white/50 text-xs">
                {isMovie ? "Movie" : "TV"}
              </span>
            </div>
          </div>
        </div>

        {/* Always visible rating badge */}
        {item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded-md group-hover:opacity-0 transition-opacity duration-300">
            <Star className="w-2.5 h-2.5 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}
        
        {/* Subtle border glow on hover */}
        <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-violet-500/30 transition-all duration-300 pointer-events-none" />
      </Link>
    </motion.div>
  );
});
