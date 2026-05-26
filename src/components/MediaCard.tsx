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

export const MediaCard = memo(function MediaCard({ item, index = 0 }: MediaCardProps) {
  const isMovie = item.media_type === "movie" || !!item.title;
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;

  const isPriority = index < 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="row-item"
      layout
    >
      <Link
        href={link}
        className="group relative block aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 overflow-hidden rounded-2xl bg-muted/50 transition-all duration-500 hover:scale-[1.08] hover:z-10 focus:outline-none will-change-transform"
        style={{ transformOrigin: "center bottom" }}
        prefetch={false}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
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

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-500" />

        <div className="absolute inset-0 flex flex-col justify-between p-3.5 opacity-0 group-hover:opacity-100 transition-all duration-500">
          {item.vote_average ? (
            <div className="flex justify-end">
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-xl text-amber-400 text-xs font-bold px-2 py-1 rounded-lg border border-white/10 shadow-lg">
                <Star className="w-3 h-3 fill-current" />
                {item.vote_average.toFixed(1)}
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#462C7D] to-[#831C91] flex items-center justify-center shadow-2xl shadow-[#831C91]/50 translate-y-4 group-hover:translate-y-0 transition-all duration-500 group-hover:scale-110">
              <Play className="w-6 h-6 fill-white text-white ml-0.5" />
            </div>
          </div>

          <div className="relative z-10 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
            <h3 className="text-white font-bold text-sm leading-tight mb-1.5 line-clamp-2 drop-shadow-lg">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              {year && (
                <span className="text-white/80 text-xs font-medium bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded">
                  {year}
                </span>
              )}
              <span className="text-white/50 text-xs">
                {isMovie ? "Movie" : "TV"}
              </span>
            </div>
          </div>
        </div>

        {item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded-md group-hover:opacity-0 transition-opacity duration-300">
            <Star className="w-2.5 h-2.5 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}

        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/0 group-hover:ring-[#D552A3]/40 transition-all duration-500 pointer-events-none" />
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(213,82,163,0.15)" }} />
      </Link>
    </motion.div>
  );
});
