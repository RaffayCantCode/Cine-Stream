"use client";

import { useState, useMemo, type KeyboardEvent, type ReactNode } from "react";
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

// ── List Card ───────────────────────────────────────────────────────────────
export function EpisodeListCard({ item }: { item: EpisodeItem }) {
  const isUpcoming = item.isReleased === false;
  const dateLabel = formatAirDate(item.airDate);
  const hasMeta = dateLabel !== null || (item.runtime && item.runtime > 0);

  return (
    <div
      onClick={item.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => handleKeyClick(e, item.onClick)}
      title={`Episode ${item.number}${item.isFiller ? " (Filler)" : ""}`}
      className={cn(
        "group relative flex gap-3 sm:gap-5 p-3 sm:p-4 rounded-2xl border transition-all duration-300 cursor-pointer select-none touch-manipulation",
        item.isSelected
          ? "border-primary/35 bg-gradient-to-br from-primary/15 via-white/[0.03] to-white/[0.02] shadow-lg shadow-primary/10"
          : isUpcoming
          ? "bg-white/[0.015] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]"
          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.14] hover:shadow-[0_18px_44px_-18px_rgba(0,0,0,0.6)] hover:-translate-y-0.5"
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          "relative shrink-0 self-start overflow-hidden rounded-xl ring-1 ring-white/10 bg-muted transition-shadow duration-300",
          item.portrait
            ? "w-28 sm:w-36 md:w-40 aspect-[2/3]"
            : "w-36 sm:w-48 md:w-56 lg:w-64 xl:w-72 aspect-video"
        )}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-transparent">
            <Play className="w-6 h-6 text-white/25" />
          </div>
        )}

        {/* Hover play overlay */}
        {!isUpcoming && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 fill-black text-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Episode number badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/65 backdrop-blur-md border border-white/15">
          <span className="text-white text-[10px] font-extrabold tracking-wider">E{item.number}</span>
        </div>

        {/* Selected / playing badge */}
        {item.isSelected && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-black tracking-wider uppercase shadow-xl shadow-black/50 border border-white/25">
            {item.isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            {item.isPlaying ? "Playing" : "Current"}
          </div>
        )}

        {/* Upcoming overlay */}
        {isUpcoming && (
          <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5">
            <Lock className="w-5 h-5 text-white/50" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Upcoming</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col py-0.5">
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold uppercase tracking-widest text-white/45">
          <span>Episode {item.number}</span>
          {item.isFiller && (
            <span className="px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
              Filler
            </span>
          )}
        </div>

        <h4 className="text-white font-black text-base sm:text-lg leading-snug mt-1.5 line-clamp-2">
          {item.title}
        </h4>

        {item.description && (
          <p className="text-white/70 text-xs sm:text-sm leading-relaxed mt-1.5 line-clamp-2 sm:line-clamp-3">
            {item.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-auto pt-2.5 flex-wrap text-[11px] font-semibold text-white/45">
          {hasMeta && (
            <span className="flex items-center gap-1.5">
              {item.runtime && item.runtime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {item.runtime} min
                </span>
              )}
              {item.runtime && item.runtime > 0 && dateLabel && <span className="opacity-40">•</span>}
              {dateLabel && <span>{dateLabel}</span>}
            </span>
          )}
          {item.hasRating && item.rating != null && (
            <span className="flex items-center gap-1 text-amber-400">
              <Star className="w-3 h-3 fill-current" /> {item.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function EpisodeListView({ items }: { items: EpisodeItem[] }) {
  return (
    <div className="space-y-2.5 sm:space-y-3">
      {items.map((item) => (
        <EpisodeListCard key={item.key} item={item} />
      ))}
    </div>
  );
}

// ── Grid Card ───────────────────────────────────────────────────────────────
export function EpisodeGridCard({ item }: { item: EpisodeItem }) {
  const isUpcoming = item.isReleased === false;
  return (
    <div
      onClick={item.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => handleKeyClick(e, item.onClick)}
      title={`Episode ${item.number}${item.isFiller ? " (Filler)" : ""}`}
      className={cn(
        "group relative flex flex-col cursor-pointer select-none touch-manipulation transition-all duration-300",
        isUpcoming ? "opacity-70 hover:opacity-95" : "hover:-translate-y-1"
      )}
    >
      <div
        className={cn(
          "relative w-full aspect-video overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 transition-all duration-300",
          !isUpcoming && "group-hover:ring-white/25 group-hover:shadow-[0_16px_34px_-12px_rgba(0,0,0,0.65)]"
        )}
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.07] to-transparent">
            <span className="text-2xl font-black text-white/15">{formatEpisodeNumber(item.number)}</span>
          </div>
        )}

        {/* Bottom shade for badge legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Episode number badge — bottom-left */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15">
          <span className="text-white text-[10px] font-black tracking-wider">
            {formatEpisodeNumber(item.number)}
          </span>
        </div>

        {/* Filler tag — top-left */}
        {item.isFiller && (
          <span className="absolute top-2 left-2 px-2 py-1 rounded-md bg-amber-400/90 text-black text-[10px] font-black uppercase tracking-wider shadow-lg shadow-black/40">
            Filler
          </span>
        )}

        {/* Selected / playing badge */}
        {item.isSelected && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-black tracking-wider uppercase shadow-xl shadow-black/50 border border-white/25">
            {item.isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            {item.isPlaying ? "Playing" : "Current"}
          </div>
        )}

        {/* Play overlay */}
        {!isUpcoming && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-4 h-4 fill-black text-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Upcoming overlay */}
        {isUpcoming && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1">
            <Lock className="w-4 h-4 text-white/60" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white/70">Upcoming</span>
          </div>
        )}
      </div>

      <h3
        className={cn(
          "mt-2.5 text-sm font-bold leading-snug line-clamp-2 transition-colors duration-200",
          item.isSelected ? "text-primary" : "text-white/90 group-hover:text-white"
        )}
      >
        {item.title}
      </h3>
    </div>
  );
}

export function EpisodeGridView({ items }: { items: EpisodeItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {items.map((item) => (
        <EpisodeGridCard key={item.key} item={item} />
      ))}
    </div>
  );
}

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

export function EpisodeNumbersView({ items }: { items: EpisodeItem[] }) {
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
                  ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105 ring-1 ring-white/20 z-10"
                  : isUpcoming
                  ? "bg-white/[0.03] text-white/20 border border-white/[0.05] cursor-not-allowed"
                  : item.isFiller
                  ? "bg-white/[0.05] text-amber-300/90 border border-amber-400/25 hover:bg-amber-400/15 hover:text-amber-200 hover:border-amber-400/40"
                  : "bg-white/[0.06] text-white/70 border border-white/[0.07] hover:bg-white/[0.12] hover:text-white hover:border-white/20"
              )}
            >
              {item.number}
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
}

