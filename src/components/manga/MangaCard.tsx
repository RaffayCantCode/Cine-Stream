"use client";

import Link from "next/link";
import { memo } from "react";
import { MangaItem } from "@/lib/manga-fetch";
import { cn } from "@/lib/utils";

interface MangaCardProps {
  item: MangaItem;
  priority?: boolean;
  showBadges?: boolean;
}

export const MangaCard = memo(function MangaCard({ item, priority = false, showBadges = true }: MangaCardProps) {
  const typeLabels = {
    manga: "Manga",
    manhwa: "Manhwa",
    manhua: "Manhua",
  };

  const handleSaveCover = () => {
    if (item.coverImage && !item.coverImage.includes("icon-512.png")) {
      try {
        sessionStorage.setItem(`cs_manga_cover_${item.id}`, item.coverImage);
      } catch {}
    }
    if (item.type) {
      try {
        sessionStorage.setItem(`cs_manga_type_${item.id}`, item.type);
      } catch {}
    }
    if (item.title) {
      try {
        sessionStorage.setItem(`cs_manga_title_${item.id}`, item.title);
      } catch {}
    }
  };

  return (
    <Link
      href={`/manga/${item.id}`}
      onMouseEnter={handleSaveCover}
      onPointerDown={handleSaveCover}
      onClick={handleSaveCover}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 320px" }}
      className="group relative flex flex-col w-full aspect-[2/3] rounded-3xl overflow-hidden bg-zinc-950 border border-white/[0.08] hover:border-primary/50 hover:shadow-[0_14px_32px_hsl(var(--primary)/0.16)] hover:scale-[1.03] hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 select-none focus:outline-none cursor-pointer touch-manipulation"
    >
      {/* Full-Bleed Poster Image */}
      <img
        src={item.coverImage}
        alt={item.title}
        referrerPolicy="no-referrer"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes("icon-512.png")) {
            target.src = "/icon-512.png";
          }
        }}
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 ease-out"
      />

      {/* Cinematic Gradient Scrim (appears on hover) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Top Floating Badges (Solid Pitch-Black Box with Bold High-Contrast Text - always visible) */}
      {showBadges && (
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
                  : item.status === "hiatus"
                  ? "text-amber-400"
                  : item.status === "cancelled"
                  ? "text-rose-400"
                  : "text-white"
              )}
            >
              {item.status}
            </span>
          )}
        </div>
      )}

      {/* Bottom Overlaid Text (Title, Genre, Year - Only visible on hover) */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-4.5 flex flex-col justify-end gap-1.5 z-10 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transform translate-y-2 group-hover:translate-y-0 group-focus-visible:translate-y-0 transition-all duration-300 pointer-events-none">
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
