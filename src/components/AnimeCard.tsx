"use client";

import Link from "next/link";
import { Star, Play } from "lucide-react";
import { motion } from "framer-motion";

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
}

export function AnimeCard({ item, index = 0 }: AnimeCardProps) {
  const subCount = item.episodes?.sub ?? null;
  const dubCount = item.episodes?.dub ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <Link
        href={`/anime/${item.id}`}
        className="group relative block aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 overflow-hidden rounded-2xl bg-muted transition-all duration-500 hover:scale-[1.06] hover:z-10 focus:outline-none"
        style={{ transformOrigin: "center bottom" }}
      >
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{item.name}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
          <span className="bg-[#4B5694]/90 backdrop-blur-xl text-white text-[9px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-md uppercase leading-none shadow-lg">
            JP SUB
          </span>
          {dubCount !== null && dubCount > 0 && (
            <span className="bg-amber-500/90 backdrop-blur-xl text-white text-[9px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-md uppercase leading-none shadow-lg">
              DUB
            </span>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

        <div className="absolute bottom-0 inset-x-0 z-10 p-2.5 pointer-events-none">
          <h3 className="text-white font-bold text-[11px] leading-tight line-clamp-2 drop-shadow-xl">
            {item.name}
          </h3>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-3.5">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="w-12 h-12 rounded-full bg-[#4B5694]/90 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-[#4B5694]/50 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </div>
          </div>

          <div className="relative z-10">
            {/* Show Year and Rating on hover instead of Title */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap text-[9px] font-bold text-white/90">
              {item.seasonYear && (
                <span className="bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm uppercase">
                  {item.season ? `${item.season} ` : ""}{item.seasonYear}
                </span>
              )}
              {item.rating && (
                <span className="flex items-center gap-0.5 text-amber-400 bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded backdrop-blur-sm">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {item.rating}
                </span>
              )}
            </div>

            {/* Show Genres on hover */}
            {item.genres && item.genres.length > 0 && (
              <p className="text-[10px] font-bold text-[#7288AE] line-clamp-1 mb-1.5 uppercase tracking-wide leading-none">
                {item.genres.slice(0, 2).join(" · ")}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {item.type && (
                <span className="text-white/40 text-[9px] font-bold uppercase tracking-wider">
                  {item.type}
                </span>
              )}
              {subCount !== null && (
                <span className="flex items-center gap-0.5 text-white/40 text-[9px] font-semibold">
                  {subCount} eps
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/0 group-hover:ring-[#7288AE]/40 transition-all duration-500 pointer-events-none" />
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(213,82,163,0.15)" }} />
      </Link>
    </motion.div>
  );
}
