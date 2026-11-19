"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check, Dices, Search, X, ArrowUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  badge?: string;
}

export interface FilterDropdownConfig {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** If true, shows an accent dot next to the selected label (e.g. "• Popular") */
  showActiveDot?: boolean;
  /** Value that represents "no filter / default" (usually "") */
  defaultValue?: string;
}

interface BrowseFilterBarProps {
  filters: FilterDropdownConfig[];
  onShuffle?: () => void;
  isShuffling?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  isSearching?: boolean;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  accentColor?: "red" | "emerald" | "purple" | "blue";
}

const ACCENT_STYLES = {
  red: {
    dot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.7)]",
    activePill: "border-rose-400/35 bg-rose-500/15 text-white",
    activeItem: "bg-rose-500/15 text-rose-200",
    check: "text-rose-400",
    focusBorder: "focus:border-rose-400/50",
  },
  emerald: {
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",
    activePill: "border-emerald-400/35 bg-emerald-500/15 text-white",
    activeItem: "bg-emerald-500/15 text-emerald-200",
    check: "text-emerald-400",
    focusBorder: "focus:border-emerald-400/50",
  },
  purple: {
    dot: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.7)]",
    activePill: "border-purple-400/35 bg-purple-500/15 text-white",
    activeItem: "bg-purple-500/15 text-purple-200",
    check: "text-purple-400",
    focusBorder: "focus:border-purple-400/50",
  },
  blue: {
    dot: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]",
    activePill: "border-sky-400/35 bg-sky-500/15 text-white",
    activeItem: "bg-sky-500/15 text-sky-200",
    check: "text-sky-400",
    focusBorder: "focus:border-sky-400/50",
  },
};

function FilterDropdown({
  config,
  isOpen,
  onToggle,
  onClose,
  accent,
}: {
  config: FilterDropdownConfig;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  accent: (typeof ACCENT_STYLES)["blue"];
}) {
  const defaultVal = config.defaultValue ?? "";
  const isModified = config.value !== defaultVal;
  const selectedOption = config.options.find((o) => o.value === config.value);
  const displayLabel = isModified || config.showActiveDot
    ? (selectedOption?.label || config.label)
    : config.label;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "h-9 px-3.5 sm:px-4 rounded-full border text-xs sm:text-[13px] font-semibold transition-all duration-200 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer select-none",
          isModified
            ? accent.activePill
            : isOpen
            ? "bg-white/[0.12] border-white/25 text-white"
            : "bg-white/[0.06] hover:bg-white/[0.11] border-white/[0.1] text-white/85 hover:text-white"
        )}
      >
        {(config.showActiveDot || isModified) && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              isModified ? accent.dot : "bg-white/90"
            )}
          />
        )}
        <span className="max-w-[115px] truncate">{displayLabel}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-white/55 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180 text-white"
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 sm:left-0 mt-2 min-w-[190px] max-w-[240px] max-h-72 overflow-y-auto rounded-2xl bg-[#121620]/98 backdrop-blur-2xl border border-white/[0.14] shadow-2xl shadow-black/80 p-1.5 z-[100] animate-in fade-in zoom-in-95 duration-150"
        >
          {config.options.map((opt) => {
            const active = opt.value === config.value;
            return (
              <button
                key={opt.value || "__all__"}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  config.onChange(opt.value);
                  onClose();
                }}
                className={cn(
                  "w-full px-3 py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer",
                  active
                    ? cn("font-bold", accent.activeItem)
                    : "text-white/75 hover:bg-white/[0.07] hover:text-white"
                )}
              >
                <span className="truncate">{opt.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.07] text-white/50">
                      {opt.badge}
                    </span>
                  )}
                  {active && <Check className={cn("w-3.5 h-3.5", accent.check)} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BrowseFilterBar({
  filters,
  onShuffle,
  isShuffling = false,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  isSearching = false,
  hasActiveFilters = false,
  onResetFilters,
  accentColor = "blue",
}: BrowseFilterBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [diceSpin, setDiceSpin] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const accent = ACCENT_STYLES[accentColor];

  useEffect(() => {
    if (!openId) return;
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openId]);

  const handleDiceClick = useCallback(() => {
    setOpenId(null);
    setDiceSpin(true);
    onShuffle?.();
    setTimeout(() => setDiceSpin(false), 450);
  }, [onShuffle]);

  return (
    <div ref={containerRef} className="relative z-40 flex flex-col gap-3 w-full">
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 justify-between">
        {/* Search pill (compact) */}
        {onSearchChange && (
          <div className="relative w-full sm:w-64 md:w-72">
            <Search
              className={cn(
                "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors",
                isSearching ? "text-white animate-pulse" : "text-white/40"
              )}
            />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                "w-full h-11 pl-10 pr-9 rounded-full bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/35 text-sm outline-none transition-all backdrop-blur-md",
                accent.focusBorder
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Glass Pill Filter Dock */}
        <div className="relative z-40 flex flex-wrap items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl sm:rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl shadow-lg shadow-black/30">
          {onShuffle && (
            <button
              type="button"
              onClick={handleDiceClick}
              disabled={isShuffling}
              title="Surprise me (Random page)"
              aria-label="Surprise me"
              className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-white/80 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Dices className={cn("w-4 h-4 transition-transform duration-300", (diceSpin || isShuffling) && "rotate-180")} />
            </button>
          )}

          {filters.map((cfg) => (
            <FilterDropdown
              key={cfg.id}
              config={cfg}
              isOpen={openId === cfg.id}
              onToggle={() => setOpenId((prev) => (prev === cfg.id ? null : cfg.id))}
              onClose={() => setOpenId(null)}
              accent={accent}
            />
          ))}

          {hasActiveFilters && onResetFilters && (
            <button
              type="button"
              onClick={() => {
                setOpenId(null);
                onResetFilters();
              }}
              title="Reset all filters"
              className="h-9 px-3 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.1] text-white/65 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 550);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-[#1a202c]/90 hover:bg-[#252e3f] border border-white/15 text-white/85 hover:text-white shadow-xl shadow-black/60 backdrop-blur-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
