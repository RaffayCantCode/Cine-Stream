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
        "group relative flex items-center justify-center rounded-xl border transition-all touch-manipulation",
        "border-border bg-card/60 text-foreground hover:bg-card hover:border-primary/50",
        compact ? "p-2.5" : "h-10 w-10",
        className
      )}
    >
      <span
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: active.preview, opacity: 0.25 }}
      />
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

  useEffect(() => {
    if (!open) return;
    const el = trackRef.current?.querySelector<HTMLElement>(`[data-theme="${current}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [open, index, current]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center p-4 transition-opacity duration-200",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Theme selection"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-[26px] border border-border bg-card/90 shadow-2xl shadow-black/70 backdrop-blur-2xl animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ background: `${active.accent}22`, color: active.accent, boxShadow: `inset 0 0 0 1px ${active.accent}44, 0 6px 18px -8px ${active.accent}66` }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-foreground leading-tight tracking-tight">Pick your style</h2>
                {active.isCustom && (
                  <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Admin Theme
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: active.accent }} />
                <span style={{ color: active.accent }}>{active.label}</span>
                <span>– changes apply instantly</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-card transition-colors touch-manipulation cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Large live preview stage */}
        <div className="px-5 sm:px-6">
          <div
            key={active.id}
            className="relative overflow-hidden rounded-2xl border border-white/15 shadow-xl animate-fade-in-up"
            style={{ background: active.preview }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),transparent_55%)]" />
            {/* Mini nav */}
            <div className="absolute inset-x-0 top-0 flex h-7 items-center justify-between bg-black/30 px-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: active.accent }} />
                <span className="h-2 w-2 rounded-full bg-white/30" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
              </div>
              <span className="h-1.5 w-10 rounded-full bg-white/25" />
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white/40" />
                <span className="h-2 w-2 rounded-full" style={{ background: active.accent }} />
              </div>
            </div>

            {/* Hero-like middle content */}
            <div className="flex items-end gap-4 px-4 pt-20 pb-4">
              <div className="min-w-0">
                <span
                  className="mb-2 inline-block rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest"
                  style={{ background: active.accent, color: "#0b0b12" }}
                >
                  {active.tagline}
                </span>
                <div className="h-3 w-40 rounded bg-white/55" />
                <div className="mt-1.5 h-2 w-24 rounded bg-white/30" />
                <div className="mt-2 flex gap-1 opacity-90">
                  <span className="h-1.5 w-16 rounded bg-white/40" />
                  <span className="h-1.5 w-10 rounded bg-white/25" />
                  <span className="h-1.5 w-12 rounded bg-white/40" />
                </div>
              </div>
              {/* Poster stack with accent glow */}
              <div className="ml-auto flex items-end -space-x-3">
                <div className="aspect-[2/3] w-10 rounded-md border border-white/30 bg-black/30" style={{ boxShadow: `0 14px 30px -6px ${active.accent}99` }} />
                <div className="aspect-[2/3] w-12 rounded-md border border-white/40 bg-black/20" style={{ boxShadow: `0 16px 36px -8px ${active.accent}bb` }} />
                <div className="aspect-[2/3] w-14 rounded-lg border border-white/50 bg-black/10" style={{ boxShadow: `0 20px 44px -10px ${active.accent}dd` }} />
              </div>
            </div>

            {/* Accent floor glow */}
            <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${active.accent}, transparent 85%)` }} />
            <div className="absolute -bottom-8 left-1/2 h-16 w-3/4 -translate-x-1/2 rounded-full opacity-50 blur-2xl" style={{ background: active.accent }} />
          </div>
        </div>

        {/* Description + controls */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground tracking-tight">{active.label}</p>
            <p className="text-xs leading-snug text-muted-foreground line-clamp-2">{active.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={prev}
              aria-label="Previous theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-foreground hover:bg-card hover:border-primary/50 transition-colors touch-manipulation cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/60 text-foreground hover:bg-card hover:border-primary/50 transition-colors touch-manipulation cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main built-in themes track */}
        <div className="px-5 sm:px-6 pt-3 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Standard Themes
          </span>
        </div>
        <div ref={trackRef} className="hide-scrollbar flex gap-2.5 overflow-x-auto px-5 sm:px-6 pb-2 snap-x">
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
                  "group relative flex shrink-0 snap-center flex-col gap-1.5 rounded-2xl p-2 text-left transition-all duration-200 touch-manipulation cursor-pointer",
                  isActive
                    ? "bg-primary/10 ring-2 ring-primary/50"
                    : "ring-1 ring-border hover:ring-primary/30 hover:bg-card"
                )}
              >
                <span
                  className="block h-14 w-20 rounded-lg overflow-hidden"
                  style={{ background: t.preview, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.18)` }}
                >
                  <span
                    className="block h-1 w-full translate-y-2"
                    style={{ background: t.accent }}
                  />
                </span>
                <span className="flex items-center gap-1 px-0.5 text-[10px] font-bold text-foreground">
                  {t.label}
                  {isActive && <Check className="h-3 w-3" style={{ color: t.accent }} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bonus Custom Themes Row (Created by Admins) */}
        {customThemes.length > 0 && (
          <div className="px-5 sm:px-6 pt-2.5 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-foreground/80">
                Bonus Custom Themes
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Live Admin Creations
              </span>
            </div>
            <div className="hide-scrollbar flex gap-2.5 overflow-x-auto pb-2 snap-x">
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
                      "group relative flex shrink-0 snap-center flex-col gap-1.5 rounded-2xl p-2 text-left transition-all duration-200 touch-manipulation cursor-pointer",
                      isCustomActive
                        ? "bg-amber-500/15 ring-2 ring-amber-500/60 shadow-lg"
                        : "ring-1 ring-border hover:ring-amber-500/40 hover:bg-card"
                    )}
                  >
                    <span
                      className="block h-14 w-20 rounded-lg overflow-hidden relative"
                      style={{ background: ct.preview, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.18)` }}
                    >
                      <span
                        className="block h-1 w-full translate-y-2"
                        style={{ background: ct.primary || ct.accent }}
                      />
                    </span>
                    <span className="flex items-center justify-between gap-1 px-0.5 text-[10px] font-bold text-foreground">
                      <span className="truncate max-w-[65px]">{ct.label}</span>
                      {isCustomActive && <Check className="h-3 w-3 shrink-0 text-amber-400" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-border/50">
          <p className="text-[11px] text-muted-foreground/80">
            {isDefault ? "Default theme applied." : "Your choice is saved and applied everywhere."}
          </p>
          <button
            onClick={() => onSelect(DEFAULT_THEME)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isDefault ? "Default" : "Reset to Global"}
          </button>
        </div>
      </div>
    </div>
  );
}