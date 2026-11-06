"use client";

import Link from "next/link";
import { memo } from "react";
import { MangaItem } from "@/lib/manga-fetch";
import { getMangaTheme } from "@/lib/manga-theme";
import { cn } from "@/lib/utils";

interface MangaCardProps {
  item: MangaItem;
  priority?: boolean;
  showBadges?: boolean;
}

export const MangaCard = memo(function MangaCard({
  item,
  priority = false,
  showBadges = true,
}: MangaCardProps) {
  const theme = getMangaTheme(item.type);
  const typeLabel = theme.label;

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
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "auto 320px",
        ["--primary" as string]: theme.primaryHsl,
        ["--primary-foreground" as string]: theme.primaryForegroundHsl,
      }}
      className={cn(
        "group relative flex flex-col w-full aspect-[2/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-950 border border-white/[0.08] hover:scale-[1.03] hover:-translate-y-1.5 active:scale-[0.98] transition-all duration-300 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer touch-manipulation",
        theme.cardHoverClass
      )}
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
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-[1.08] transition-transform duration-700 ease-out"
      />

      {/* Cinematic Gradient Scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent opacity-90 sm:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Identity accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] z-20 opacity-90"
        style={{ background: theme.gradient }}
      />

      {/* Top Floating Badges */}
      {showBadges && (
        <div className="absolute top-2.5 sm:top-3 inset-x-2 sm:inset-x-3 flex items-start justify-between gap-1.5 pointer-events-none z-10">
          <span
            className={cn(
              "px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg border text-[9px] sm:text-[10px] font-black uppercase tracking-wider backdrop-blur-md",
              theme.chipClass
            )}
          >
            {typeLabel}
          </span>

          {item.status && (
            <span
              className={cn(
                "px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-black/90 border border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.95)] text-[8px] sm:text-[9px] font-black uppercase tracking-wider backdrop-blur-md",
                item.status === "completed"
                  ? "text-emerald-400"
                  : item.status === "hiatus"
                  ? "text-amber-400"
                  : item.status === "cancelled"
                  ? "text-rose-400"
                  : "text-white/90"
              )}
            >
              {item.status}
            </span>
          )}
        </div>
      )}

      {/* Bottom Overlaid Text — always visible on touch, hover reveal on desktop */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-4 flex flex-col justify-end gap-1 sm:gap-1.5 z-10 opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transform translate-y-0 sm:translate-y-2 group-hover:translate-y-0 group-focus-visible:translate-y-0 transition-all duration-300 pointer-events-none">
        <h3
          className={cn(
            "font-black text-[11px] sm:text-base lg:text-lg text-white tracking-tight line-clamp-2 leading-tight drop-shadow-md transition-colors",
            theme.titleHoverClass
          )}
          title={item.title}
        >
          {item.title}
        </h3>

        <div className="flex items-center justify-between gap-2 text-[9px] sm:text-xs font-bold">
          <span
            className={cn(
              "truncate max-w-[130px] drop-shadow-sm font-black uppercase tracking-wide",
              theme.tagTextClass
            )}
          >
            {item.tags[0] || (item.authors && item.authors[0]) || "Series"}
          </span>
          {item.releaseYear && (
            <span className="text-white/60 text-[9px] sm:text-[11px] font-black shrink-0">
              {item.releaseYear}
            </span>
          )}
        </div>

        {/* Mini identity strip under the title */}
        <div
          className="h-[2px] w-8 sm:w-10 rounded-full mt-0.5 opacity-80"
          style={{ background: theme.gradient }}
        />
      </div>
    </Link>
  );
});
