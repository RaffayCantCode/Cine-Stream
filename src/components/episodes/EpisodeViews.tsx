"use client";

import { useState, useMemo, memo, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { List, LayoutGrid, Hash, Play, Lock, Star, Clock } from "lucide-react";

export type EpisodeViewMode = "list" | "grid" | "numbers";

export interface EpisodeItem {
  key: string;
  number: number;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  airDate?: string | null;
  runtime?: number | null;
  rating?: number | null;
  hasRating?: boolean;
  isFiller?: boolean;
  isReleased: boolean;
  isSelected?: boolean;
  isPlaying?: boolean;
  portrait?: boolean;
  onClick: () => void;
}

const VIEW_ICONS: Record<EpisodeViewMode, ReactNode> = {
  list: <List className="w-4 h-4" />,
  grid: <LayoutGrid className="w-4 h-4" />,
  numbers: <Hash className="w-4 h-4" />,
};

const VIEW_LABELS: Record<EpisodeViewMode, string> = {
  list: "List",
  grid: "Grid",
  numbers: "Numbers",
};

// ── View Selector ───────────────────────────────────────────────────────────
interface EpisodeViewSelectorProps {
  mode: EpisodeViewMode;
  onChange: (mode: EpisodeViewMode) => void;
  views?: EpisodeViewMode[];
}

export function EpisodeViewSelector({ mode, onChange, views = ["list", "grid"] }: EpisodeViewSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] shadow-sm backdrop-blur-sm">
      {views.map((view) => (
        <button
          key={view}
          onClick={() => onChange(view)}
          aria-pressed={mode === view}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200",
            mode === view
              ? "bg-white/[0.1] text-white shadow-sm ring-1 ring-white/10"
              : "text-white/45 hover:text-white/85 hover:bg-white/[0.04]"
          )}
        >
          {VIEW_ICONS[view]}
          {VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatAirDate(dateValue?: string | null): string | null {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatEpisodeNumber(num: number): string {
  return String(num).padStart(2, "0");
}

function handleKeyClick(e: KeyboardEvent, onClick: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onClick();
  }
}

// ── List Card (Netflix-Style Cinematic Row) ───────────────────────────────────
export const EpisodeListCard = memo(function EpisodeListCard({ item }: { item: EpisodeItem }) {
  const isUpcoming = item.isReleased === false;
  const dateLabel = formatAirDate(item.airDate);

  return (
    <div
      onClick={item.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => handleKeyClick(e, item.onClick)}
      title={`Episode ${item.number}${item.isFiller ? " (Filler)" : ""}`}
      className={cn(
        "group relative flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6 p-3.5 sm:p-5 rounded-2xl border transition-colors transition-shadow duration-200 cursor-pointer select-none touch-manipulation overflow-hidden w-full",
        item.isSelected
          ? "border-primary/50 bg-gradient-to-r from-primary/15 via-white/[0.03] to-white/[0.01] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] ring-1 ring-primary/30"
          : isUpcoming
          ? "bg-white/[0.015] border-white/[0.05] hover:bg-white/[0.035] hover:border-white/[0.1]"
          : "bg-white/[0.03] hover:bg-white/[0.065] border-white/[0.07] hover:border-white/[0.18] hover:shadow-[0_16px_36px_-12px_rgba(0,0,0,0.7)]"
      )}
    >
      {/* Top subtle highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Large Netflix-style episode number index (desktop only) */}
      <div className="hidden md:flex shrink-0 w-10 items-center justify-center">
        <span className="text-2xl lg:text-3xl font-black text-white/30 group-hover:text-white transition-colors duration-200">
          {item.number}
        </span>
      </div>

      {/* 16:9 Thumbnail */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition-all duration-300 group-hover:ring-white/25 group-hover:shadow-lg",
          item.portrait
            ? "w-28 sm:w-36 md:w-40 aspect-[2/3]"
            : "w-full md:w-56 lg:w-64 xl:w-72 aspect-video"
        )}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-transparent">
            <Play className="w-8 h-8 text-white/20" />
          </div>
        )}

        {/* Hover vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Episode badge on mobile (where left index is hidden) */}
        <div className="md:hidden absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/20 text-[10px] font-black text-white">
          E{item.number}
        </div>

        {/* Selected / Current pill badge on thumbnail */}
        {item.isSelected && (
          <div className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-md bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            Current
          </div>
        )}

        {/* Runtime badge */}
        {item.runtime && item.runtime > 0 && (
          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white/90 text-[10px] font-bold tracking-tight border border-white/15 shadow-sm">
            {item.runtime}m
          </div>
        )}

        {/* Hover play button */}
        {!isUpcoming && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.8)] transform scale-80 group-hover:scale-100 transition-all duration-300">
              <Play className="w-5 h-5 fill-black text-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Upcoming lock badge */}
        {isUpcoming && (
          <div className="absolute inset-0 z-10 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5">
            <Lock className="w-5 h-5 text-white/60" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Upcoming</span>
          </div>
        )}
      </div>

      {/* Row Information Column */}
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1.5 w-full">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className={`font-black text-base sm:text-lg tracking-tight transition-colors ${
              item.isSelected ? "text-emerald-400" : "text-white group-hover:text-primary"
            }`}>
              {item.title}
            </h4>
            {item.isFiller && (
              <span className="px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/25 text-[10px] font-black uppercase tracking-wider">
                Filler
              </span>
            )}
          </div>

          {/* Selected / Playing pill */}
          {item.isSelected && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black tracking-wider uppercase shadow-lg shadow-emerald-500/30 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              <span>{item.isPlaying ? "Playing" : "Current"}</span>
            </div>
          )}
        </div>

        {/* Full Plot Description across the row */}
        {item.description && (
          <p className="text-white/65 text-xs sm:text-sm leading-relaxed line-clamp-2 md:line-clamp-3 font-normal max-w-5xl">
            {item.description}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 pt-1 text-xs text-white/45 flex-wrap">
          {item.runtime && item.runtime > 0 && (
            <span className="flex items-center gap-1 font-semibold text-white/60">
              <Clock className="w-3.5 h-3.5" /> {item.runtime} min
            </span>
          )}
          {dateLabel && <span>• {dateLabel}</span>}
          {item.hasRating && item.rating != null && (
            <span className="flex items-center gap-1 text-amber-300 font-bold bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md text-[11px] ml-1">
              <Star className="w-3 h-3 fill-current" /> {item.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Far Right Action Icon */}
      <div className="hidden lg:flex shrink-0 items-center justify-center pl-4 pr-2">
        <div className="w-11 h-11 rounded-full bg-white/[0.04] border border-white/10 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary/50 text-white/40 flex items-center justify-center transition-all duration-300 shadow-sm">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </div>
      </div>
    </div>
  );
});

export const EpisodeListView = memo(function EpisodeListView({ items, className }: { items: EpisodeItem[]; className?: string }) {
  return (
    <div className={cn("w-full space-y-3 sm:space-y-3.5", className)}>
      {items.map((item) => (
        <EpisodeListCard key={item.key} item={item} />
      ))}
    </div>
  );
});

// ── Grid Card ───────────────────────────────────────────────────────────────
export const EpisodeGridCard = memo(function EpisodeGridCard({ item }: { item: EpisodeItem }) {
  const isUpcoming = item.isReleased === false;

  return (
    <div
      onClick={item.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => handleKeyClick(e, item.onClick)}
      title={`Episode ${item.number}${item.isFiller ? " (Filler)" : ""}`}
      className={cn(
        "group relative flex flex-col cursor-pointer select-none touch-manipulation transition-transform duration-200 will-change-transform",
        isUpcoming ? "opacity-70 hover:opacity-95" : "hover:-translate-y-1"
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          "relative w-full aspect-video overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition-colors transition-shadow duration-200",
          item.isSelected ? "ring-2 ring-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]" : "group-hover:ring-white/30 group-hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.8)]"
        )}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.07] to-transparent">
            <span className="text-2xl font-black text-white/15">{formatEpisodeNumber(item.number)}</span>
          </div>
        )}

        {/* Gradient shade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Episode number badge — top-left floating glass pill */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/20 shadow-md">
          <span className="text-white text-[10px] sm:text-xs font-black tracking-wider">
            E{formatEpisodeNumber(item.number)}
          </span>
        </div>

        {/* Runtime badge — bottom-right */}
        {item.runtime && item.runtime > 0 && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-white/90 text-[10px] font-bold tracking-tight border border-white/15 shadow-sm">
            {item.runtime}m
          </div>
        )}

        {/* Filler tag */}
        {item.isFiller && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-amber-400/90 text-black text-[10px] font-black uppercase tracking-wider shadow-lg shadow-black/40">
            Filler
          </span>
        )}

        {/* Selected / playing badge */}
        {item.isSelected && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500 text-black text-[9px] font-black tracking-wider uppercase shadow-xl border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            <span>{item.isPlaying ? "Playing" : "Current"}</span>
          </div>
        )}

        {/* Play overlay */}
        {!isUpcoming && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 text-black flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.8)] transform scale-80 group-hover:scale-100 transition-all duration-200">
              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Upcoming overlay */}
        {isUpcoming && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1">
            <Lock className="w-4 h-4 text-white/60" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Upcoming</span>
          </div>
        )}
      </div>

      {/* Episode title ONLY (clean, visual, distinct from list view) */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <h3
          className={cn(
            "text-xs sm:text-sm font-bold leading-snug line-clamp-1 truncate transition-colors duration-200 tracking-tight",
            item.isSelected ? "text-emerald-400 font-extrabold" : "text-white/90 group-hover:text-white"
          )}
        >
          {item.title}
        </h3>
      </div>
    </div>
  );
});

export const EpisodeGridView = memo(function EpisodeGridView({ items }: { items: EpisodeItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 gap-3.5 sm:gap-4 md:gap-5 w-full">
      {items.map((item) => (
        <EpisodeGridCard key={item.key} item={item} />
      ))}
    </div>
  );
});

// ── Numbers View (Dynamic episode navigation for series of any size) ──────
interface NumbersTierConfig {
  tier: 1 | 2 | 3 | 4;
  gridClass: string;
  boxClass: string;
  lockIconClass: string;
  fillerDotClass: string;
}

function getTierConfig(count: number): NumbersTierConfig {
  if (count <= 12) {
    return {
      tier: 1,
      gridClass: "grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2",
      boxClass: "rounded-lg text-xs sm:text-sm font-bold p-1 min-h-[44px]",
      lockIconClass: "w-2.5 h-2.5 top-1 left-1",
      fillerDotClass: "w-1.5 h-1.5 top-1.5 right-1.5",
    };
  }
  if (count <= 50) {
    return {
      tier: 2,
      gridClass: "grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-1.5",
      boxClass: "rounded-lg text-xs sm:text-sm font-bold p-1 min-h-[40px] sm:min-h-[46px]",
      lockIconClass: "w-2 h-2 top-0.5 left-0.5",
      fillerDotClass: "w-1 h-1 top-1 right-1",
    };
  }
  if (count <= 100) {
    return {
      tier: 3,
      gridClass: "grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1.5",
      boxClass: "rounded-lg text-xs font-bold p-0.5 min-h-[36px] sm:min-h-[42px]",
      lockIconClass: "w-2 h-2 top-0.5 left-0.5",
      fillerDotClass: "w-1 h-1 top-0.5 right-0.5",
    };
  }
  // Tier 4: > 100 episodes (spacious compact grid for 100 to 1000+ episode series)
  return {
    tier: 4,
    gridClass: "grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1.5",
    boxClass: "rounded-lg p-0.5 min-h-[36px] sm:min-h-[42px]",
    lockIconClass: "w-2 h-2 top-0.5 left-0.5",
    fillerDotClass: "w-1 h-1 top-0.5 right-0.5",
  };
}

function getNumberFontSize(num: number, tier: 1 | 2 | 3 | 4): string {
  if (tier === 1) {
    if (num >= 1000) return "text-xs font-black tracking-tighter";
    if (num >= 100) return "text-xs sm:text-sm font-bold tracking-tight";
    return "text-xs sm:text-sm font-bold";
  }
  if (tier === 2) {
    if (num >= 1000) return "text-[11px] font-black tracking-tighter";
    if (num >= 100) return "text-xs sm:text-sm font-bold tracking-tight";
    return "text-xs sm:text-sm font-bold";
  }
  if (tier === 3) {
    if (num >= 1000) return "text-[10px] sm:text-[11px] font-black tracking-tighter leading-none";
    if (num >= 100) return "text-[11px] sm:text-xs font-extrabold tracking-tight";
    return "text-xs sm:text-sm font-bold";
  }
  // Tier 4: > 100 episodes
  if (num >= 1000) return "text-[10px] sm:text-[11px] font-black tracking-tighter leading-none";
  if (num >= 100) return "text-[11px] sm:text-xs font-extrabold tracking-tight";
  return "text-xs sm:text-sm font-bold";
}

export const EpisodeNumbersView = memo(function EpisodeNumbersView({ items }: { items: EpisodeItem[] }) {
  const count = items.length;
  const config = getTierConfig(count);

  const [activeRange, setActiveRange] = useState<string>("all");

  // Create range chunks for long series (over 100 episodes)
  const ranges = useMemo(() => {
    if (count <= 100) return [];
    const chunkSize = 100;
    const list: { label: string; start: number; end: number }[] = [];
    for (let i = 0; i < count; i += chunkSize) {
      const start = i + 1;
      const end = Math.min(i + chunkSize, count);
      list.push({ label: `${start}–${end}`, start, end });
    }
    return list;
  }, [count]);

  const displayedItems = useMemo(() => {
    if (activeRange === "all" || ranges.length === 0) return items;
    const selected = ranges.find((r) => r.label === activeRange);
    if (!selected) return items;
    return items.filter((item) => item.number >= selected.start && item.number <= selected.end);
  }, [items, activeRange, ranges]);

  return (
    <div className="space-y-3">
      {/* Range Pills for > 100 episode series */}
      {ranges.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveRange("all")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150 shrink-0",
              activeRange === "all"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]"
            )}
          >
            All ({count})
          </button>
          {ranges.map((r) => (
            <button
              key={r.label}
              onClick={() => setActiveRange(r.label)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150 shrink-0",
                activeRange === r.label
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Dynamic Episode Numbers Grid */}
      <div className={config.gridClass}>
        {displayedItems.map((item) => {
          const isUpcoming = item.isReleased === false;
          const fontClass = getNumberFontSize(item.number, config.tier);

          return (
            <button
              key={item.key}
              onClick={item.onClick}
              disabled={isUpcoming}
              title={`Episode ${item.number}${item.isFiller ? " (Filler)" : ""}`}
              className={cn(
                "relative aspect-square transition-all duration-150 flex items-center justify-center select-none",
                config.boxClass,
                fontClass,
                item.isSelected
                  ? "bg-emerald-500 text-black font-black shadow-lg shadow-emerald-500/30 scale-105 ring-2 ring-emerald-300 z-10"
                  : isUpcoming
                  ? "bg-white/[0.03] text-white/20 border border-white/[0.05] cursor-not-allowed"
                  : item.isFiller
                  ? "bg-white/[0.05] text-amber-300/90 border border-amber-400/25 hover:bg-amber-400/15 hover:text-amber-200 hover:border-amber-400/40"
                  : "bg-white/[0.06] text-white/70 border border-white/[0.07] hover:bg-white/[0.12] hover:text-white hover:border-white/20"
              )}
            >
              {item.number}
              {item.isSelected && (
                <span className="absolute -top-1.5 -right-1.5 z-20 px-1 py-0.2 rounded-full bg-emerald-400 text-black text-[7px] font-black uppercase tracking-tight shadow-md border border-emerald-300">
                  Cur
                </span>
              )}
              {isUpcoming ? (
                <Lock className={cn("absolute text-white/35", config.lockIconClass)} />
              ) : item.isFiller && !item.isSelected ? (
                <span className={cn("absolute rounded-full bg-amber-400", config.fillerDotClass)} />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Legend & Stats Footer */}
      <div className="flex items-center justify-between gap-4 pt-1 text-[10px] font-bold uppercase tracking-widest text-white/40 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-amber-400/80" /> Filler
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-2.5 h-2.5 text-white/40" /> Upcoming
          </span>
        </div>
        <div className="text-white/30 text-[9px]">
          {count} {count === 1 ? "Episode" : "Episodes"} &bull; {config.tier === 1 ? "Standard View" : config.tier === 2 ? "Compact View" : config.tier === 3 ? "Dense View" : "Micro View"}
        </div>
      </div>
    </div>
  );
});

// ── Episode Pagination Component (for clean 50-episode page navigation) ────
export interface EpisodePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function EpisodePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 50,
  onPageChange,
  className,
}: EpisodePaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (currentPage > 3) {
      pages.push("...");
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push("...");
    }
    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 border-t border-white/[0.06] mt-6", className)}>
      <div className="text-xs text-white/50 font-medium">
        Showing episodes <span className="text-white font-bold">{startItem}–{endItem}</span> of <span className="text-white font-bold">{totalItems.toLocaleString()}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-white/70 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-all select-none"
        >
          ← Prev
        </button>

        {pageNumbers.map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs font-bold text-white/30 select-none">
                ...
              </span>
            );
          }
          const isCurrent = p === currentPage;
          const rangeStart = (p - 1) * itemsPerPage + 1;
          const rangeEnd = Math.min(p * itemsPerPage, totalItems);
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              title={`Episodes ${rangeStart}–${rangeEnd}`}
              className={cn(
                "min-w-[36px] h-[36px] px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center select-none",
                isCurrent
                  ? "bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/25 ring-1 ring-white/20 scale-105"
                  : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08]"
              )}
            >
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-white/70 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-all select-none"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Episode Chunk Selector ([1–10] [11–20] ... batch pills) ─────────────────
export interface EpisodeChunkBarProps {
  totalEpisodes: number;
  chunkSize?: number;
  activeChunkIndex: number;
  onChunkChange: (index: number) => void;
  activeEpisodeNumber?: number;
  className?: string;
}

export function EpisodeChunkBar({
  totalEpisodes,
  chunkSize = 10,
  activeChunkIndex,
  onChunkChange,
  activeEpisodeNumber,
  className,
}: EpisodeChunkBarProps) {
  const totalChunks = Math.ceil(totalEpisodes / chunkSize);
  if (totalChunks <= 1) return null;

  return (
    <div className={cn("flex items-center justify-end gap-2.5 overflow-x-auto pb-1 scrollbar-none select-none flex-wrap", className)}>
      <span className="text-xs font-black uppercase tracking-wider text-white/50 shrink-0 mr-1">
        Episodes:
      </span>
      {Array.from({ length: totalChunks }, (_, idx) => {
        const start = idx * chunkSize + 1;
        const end = Math.min((idx + 1) * chunkSize, totalEpisodes);
        const isActive = idx === activeChunkIndex;
        const containsPlaying =
          activeEpisodeNumber != null && activeEpisodeNumber >= start && activeEpisodeNumber <= end;

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onChunkChange(idx)}
            className={cn(
              "h-10 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 shadow-sm",
              isActive
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/40 scale-[1.03]"
                : "bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] hover:border-white/20 text-white/75 hover:text-white"
            )}
          >
            {containsPlaying && !isActive && (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
            <span>{start}–{end}</span>
          </button>
        );
      })}
    </div>
  );
}


