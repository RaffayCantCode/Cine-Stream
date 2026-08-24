"use client";

import Link from "next/link";
import { memo } from "react";
import { MangaItem } from "@/lib/manga-fetch";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface MangaCardProps {
  item: MangaItem;
  priority?: boolean;
}

export const MangaCard = memo(function MangaCard({ item, priority = false }: MangaCardProps) {
  const typeLabels = {
    manga: "Manga",
    manhwa: "Manhwa",
    manhua: "Manhua",
  };

  return (
    <Link
      href={`/manga/${item.id}`}
      className="group relative flex flex-col w-full aspect-[2/3] rounded-3xl overflow-hidden bg-zinc-950 border border-white/[0.08] hover:border-primary/70 hover:shadow-[0_16px_40px_hsl(var(--primary)/0.25)] hover:scale-[1.03] hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 select-none focus:outline-none cursor-pointer touch-manipulation"
    >
      {/* Full-Bleed Poster Image */}
      <img
        src={item.coverImage}
        alt={item.title}
        referrerPolicy="no-referrer"
        loading={priority ? "eager" : "lazy"}
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-out will-change-transform"
      />

      {/* Cinematic Gradient Scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 group-hover:opacity-95 transition-opacity" />

      {/* Top Floating Badges (Solid Pitch-Black Box with Bold High-Contrast Text) */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
        <span className="px-2.5 py-1 rounded-lg bg-black/95 text-primary border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.95)] text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
          {typeLabels[item.type] || "Manga"}
        </span>

        {item.status && (
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg bg-black/95 border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.95)] text-[9px] font-black uppercase tracking-wider backdrop-blur-md",
              item.status === "completed"
                ? "text-emerald-400"
                : "text-white"
            )}
          >
            {item.status}
          </span>
        )}
      </div>

      {/* Center Read Now Action on Hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none">
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-black shadow-2xl shadow-primary/40 scale-75 group-hover:scale-100 transition-transform duration-300 border border-primary/60 backdrop-blur-sm">
          <BookOpen className="w-4 h-4" />
          <span>Read Now</span>
        </div>
      </div>

      {/* Bottom Overlaid Text (Title, Genre, Year) */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-4.5 flex flex-col justify-end gap-1.5 z-10">
        <h3
          className="font-black text-base sm:text-lg text-white tracking-tight line-clamp-2 leading-tight drop-shadow-md group-hover:text-primary transition-colors"
          title={item.title}
        >
          {item.title}
        </h3>

        <div className="flex items-center justify-between text-xs text-white/70 font-bold">
          <span className="truncate max-w-[130px] drop-shadow-sm text-primary font-black">
            {item.tags[0] || (item.authors && item.authors[0]) || "Webtoon"}
          </span>
          {item.releaseYear && (
            <span className="text-white/60 text-[11px] font-black">{item.releaseYear}</span>
          )}
        </div>
      </div>
    </Link>
  );
});
