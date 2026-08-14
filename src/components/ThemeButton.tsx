"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Palette, Check, X, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEMES, DEFAULT_THEME, getTheme, ThemeId, ThemeDefinition } from "@/lib/themes";
import { useTheme } from "@/context/ThemeContext";

interface ThemeButtonProps {
  className?: string;
  compact?: boolean;
}

export function ThemeButton({ className, compact = false }: ThemeButtonProps) {
  const { theme, setTheme, customThemes } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const active = useMemo(() => getTheme(theme, customThemes), [theme, customThemes]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const Trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Change theme"
      title={`Theme: ${active.label}`}
      className={cn(
        "group relative flex items-center justify-center rounded-xl border transition-colors touch-manipulation",
        "border-border bg-card/60 text-foreground hover:bg-card hover:border-primary/50",
        compact ? "w-8 h-8 p-0" : "h-10 w-10",
        className
      )}
    >
      <Palette className="relative w-[18px] h-[18px]" />
    </button>
  );

  return (
    <>
      {Trigger}
      {mounted &&
        createPortal(
          <ThemeSlider 
            open={open} 
            onClose={() => setOpen(false)} 
            current={theme} 
            onSelect={setTheme} 
            customThemes={customThemes}
          />,
          document.body
        )}
    </>
  );
}

interface ThemeSliderProps {
  open: boolean;
  onClose: () => void;
  current: ThemeId;
  onSelect: (theme: ThemeId) => void;
  customThemes: ThemeDefinition[];
}

function ThemeSlider({ open, onClose, current, onSelect, customThemes = [] }: ThemeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const customTrackRef = useRef<HTMLDivElement>(null);
  const allThemes = useMemo(() => [...THEMES, ...customThemes], [customThemes]);
  const [index, setIndex] = useState(() => Math.max(0, allThemes.findIndex((t) => t.id === current)));

  useEffect(() => {
    setIndex(Math.max(0, allThemes.findIndex((t) => t.id === current)));
  }, [current, allThemes]);

  const active = allThemes[index] ?? THEMES[0];
  const isDefault = current === DEFAULT_THEME;

  const prev = () => go((index - 1 + allThemes.length) % allThemes.length);
  const next = () => go((index + 1) % allThemes.length);
  const go = (i: number) => {
    setIndex(i);
    onSelect(allThemes[i].id);
  };

  const initialOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initialOpenRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const el = trackRef.current?.querySelector<HTMLElement>(`[data-theme="${current}"]`) ||
                 customTrackRef.current?.querySelector<HTMLElement>(`[data-theme="${current}"]`);
      if (el) {
        el.scrollIntoView({
          behavior: initialOpenRef.current ? "smooth" : "auto",
          block: "nearest",
          inline: "center",
        });
        initialOpenRef.current = true;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open, current]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ease-out",
        open ? "opacity-100 backdrop-blur-md" : "pointer-events-none opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Theme selection"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />

      <div className={cn(
        "relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#090D16] shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out",
        open ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 shadow-inner"
            >
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Theme Studio & Palette</h2>
                {active.isCustom && (
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Admin Theme
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full transition-colors duration-300" style={{ background: active.accent }} />
                <span style={{ color: active.accent }} className="font-semibold transition-colors duration-300">{active.label}</span>
                <span>– applies live instantly</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Large live preview stage */}
        <div className="px-5 sm:px-6 pt-5">
          <div
            className="relative overflow-hidden rounded-xl border border-white/10 shadow-lg p-5 transition-all duration-300 ease-out"
            style={{ background: active.preview }}
          >
            {/* Top Bar Preview */}
            <div className="flex items-center justify-between text-xs mb-4">
              <span
                className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow transition-colors duration-300"
                style={{ backgroundColor: active.accent, color: "#000" }}
              >
                {active.tagline || "Theme Preview"}
              </span>
              <span className="text-xs font-semibold text-white/90 transition-all duration-300">
                {active.label}
              </span>
            </div>

            {/* Content Card Preview */}
            <div className="p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between transition-all duration-300">
              <div className="space-y-1.5">
                <div className="h-3 w-32 rounded bg-white/50" />
                <div className="h-2 w-20 rounded bg-white/30" />
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold shadow transition-all duration-300"
                style={{ backgroundColor: active.accent, color: "#000" }}
              >
                Watch Now
              </button>
            </div>
          </div>
        </div>

        {/* Description + controls */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-tight transition-colors duration-300">{active.label}</p>
            <p className="text-xs text-zinc-400 line-clamp-1 transition-colors duration-300">{active.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={prev}
              aria-label="Previous theme"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next theme"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main built-in themes track */}
        <div className="px-5 sm:px-6 pt-4 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Standard Themes
          </span>
        </div>
        <div ref={trackRef} className="hide-scrollbar flex gap-2.5 overflow-x-auto px-5 sm:px-6 pb-3 snap-x">
          {THEMES.map((t) => {
            const isActive = t.id === current;
            return (
              <button
                key={t.id}
                data-theme={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                aria-pressed={isActive}
                className={cn(
                  "group relative flex shrink-0 snap-center flex-col gap-1.5 rounded-xl p-2 text-left transition-all duration-200 cursor-pointer active:scale-95",
                  isActive
                    ? "bg-zinc-900 border border-primary ring-2 ring-primary/30 text-white shadow-lg"
                    : "bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                )}
              >
                <span
                  className="block h-12 w-20 rounded-lg overflow-hidden border border-white/10 relative p-1.5 shadow-inner transition-transform duration-200 group-hover:scale-105"
                  style={{ background: t.preview }}
                >
                  <span
                    className="block h-1.5 w-full rounded-full shadow-sm"
                    style={{ background: t.accent }}
                  />
                </span>
                <span className="flex items-center gap-1 px-0.5 text-[10px] font-bold">
                  <span className="truncate max-w-[65px]">{t.label}</span>
                  {isActive && <Check className="h-3 w-3 shrink-0" style={{ color: t.accent }} strokeWidth={2.5} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bonus Custom Themes Row (Created by Admins) */}
        {customThemes.length > 0 && (
          <div className="px-5 sm:px-6 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                Bonus Custom Themes
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Live Admin Creations
              </span>
            </div>
            <div ref={customTrackRef} className="hide-scrollbar flex gap-2.5 overflow-x-auto pb-3 snap-x">
              {customThemes.map((ct) => {
                const isCustomActive = current === ct.id;
                return (
                  <button
                    key={ct.id}
                    data-theme={ct.id}
                    type="button"
                    onClick={() => onSelect(ct.id)}
                    aria-pressed={isCustomActive}
                    className={cn(
                      "group relative flex shrink-0 snap-center flex-col gap-1.5 rounded-xl p-2 text-left transition-all duration-200 cursor-pointer active:scale-95",
                      isCustomActive
                        ? "bg-zinc-900 border border-amber-500 ring-2 ring-amber-500/30 text-white shadow-lg"
                        : "bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <span
                      className="block h-12 w-20 rounded-lg overflow-hidden border border-white/10 relative p-1.5 shadow-inner transition-transform duration-200 group-hover:scale-105"
                      style={{ backgroundColor: ct.background || "#090E17" }}
                    >
                      <span
                        className="block h-1.5 w-full rounded-full shadow-sm"
                        style={{ backgroundColor: ct.primary || ct.accent || "#38BDF8" }}
                      />
                      <div
                        className="w-full h-4 mt-1 rounded-md opacity-40"
                        style={{ backgroundColor: ct.card || "rgba(255,255,255,0.1)" }}
                      />
                    </span>
                    <span className="flex items-center justify-between gap-1 px-0.5 text-[10px] font-bold">
                      <span className="truncate max-w-[65px]">{ct.label}</span>
                      {isCustomActive && <Check className="h-3 w-3 shrink-0 text-amber-400" strokeWidth={2.5} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/40">
          <p className="text-[11px] text-zinc-400">
            {isDefault ? "Default theme applied." : "Choice saved live to your session."}
          </p>
          <button
            onClick={() => onSelect(DEFAULT_THEME)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isDefault ? "Default" : "Reset to Default"}
          </button>
        </div>
      </div>
    </div>
  );
}