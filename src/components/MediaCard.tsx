"use client";

import Link from "next/link";
import { Star, Play } from "lucide-react";
import { motion } from "framer-motion";

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

export function MediaCard({ item, index = 0 }: MediaCardProps) {
  const isMovie = item.media_type === "movie" || !!item.title;
  const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
    >
      <Link
        href={link}
        className="group relative block aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 overflow-hidden rounded-xl bg-muted transition-all duration-300 hover:scale-[1.06] hover:z-10 focus:outline-none"
        style={{ transformOrigin: "center bottom" }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{title}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3.5">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-primary/40 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </div>
          </div>

          <div className="relative z-10">
            <h3 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              {item.vote_average ? (
                <div className="flex items-center gap-1 text-amber-400">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="font-bold text-xs">{item.vote_average.toFixed(1)}</span>
                </div>
              ) : null}
              {year && <span className="text-white/40 text-xs">{year}</span>}
            </div>
          </div>
        </div>

        {item.vote_average ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm text-amber-400 text-xs font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-0 transition-opacity">
            <Star className="w-2.5 h-2.5 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}
      </Link>
    </motion.div>
  );
}
