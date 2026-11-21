"use client";
export const runtime = "edge";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Play,
  Star,
  Film,
  Tv,
  Sparkles,
  Bookmark,
  Flame,
  Layers,
  Repeat,
} from "lucide-react";
import { SiNetflix, SiAppletv, SiCrunchyroll, SiImdb } from "react-icons/si";
import { Sidebar } from "@/components/Sidebar";
import { ProviderIcon } from "@/components/ProviderIcon";
import { useWatchlist } from "@/context/WatchlistContext";
import { usePageContentReady } from "@/lib/pageLoad";
import { fetchJson, cn } from "@/lib/utils";
import type { CalendarApiItem } from "@/app/api/calendar/route";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ReleaseCalendarPage() {
  usePageContentReady(true);
  const watchlist = useWatchlist();
  const watchlistIds = useMemo(() => {
    const set = new Set<string>();
    for (const it of watchlist?.items || []) {
      set.add(`${it.mediaType}:${it.mediaId}`);
      set.add(String(it.mediaId));
    }
    return set;
  }, [watchlist?.items]);

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(today), [today]);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  // Media category selector: TV Series (default), Movies, Anime, or My Watchlist
  const [filterMode, setFilterMode] = useState<"tv" | "movie" | "anime" | "watchlist">("tv");
  // Scope toggle: "top" = Top & Trending Hits (default, clean & fast!) vs "all" = All Normal Releases
  const [scopeMode, setScopeMode] = useState<"top" | "all">("top");
  const [items, setItems] = useState<CalendarApiItem[]>([]);
  const [loading, setLoading] = useState(true);

  const monthRange = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-based index (0 = Mon .. 6 = Sun)
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const cells: { date: Date; iso: string; inMonth: boolean }[] = [];

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      );
      cells.push({
        date: d,
        iso: toIsoDate(d),
        inMonth: d.getMonth() === month,
      });
    }

    return {
      year,
      month: month + 1,
      cells,
      monthLabel: firstDay.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    };
  }, [currentMonth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchJson<{ items: CalendarApiItem[] }>(
      `/api/calendar?year=${monthRange.year}&month=${monthRange.month}`
    )
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [monthRange.year, monthRange.month]);

  const categoryItems = useMemo(() => {
    return items.filter((it) => {
      if (filterMode === "movie") return it.mediaType === "movie";
      if (filterMode === "tv") return it.mediaType === "tv";
      if (filterMode === "anime") return it.mediaType === "anime";
      if (filterMode === "watchlist") {
        return (
          watchlistIds.has(`${it.mediaType}:${it.mediaId}`) ||
          watchlistIds.has(String(it.mediaId))
        );
      }
      return true;
    });
  }, [items, filterMode, watchlistIds]);

  const filteredItems = useMemo(() => {
    if (scopeMode === "all" || filterMode === "watchlist") {
      return categoryItems;
    }
    const topOnly = categoryItems.filter((it) => it.isTop);
    return topOnly.length > 0 ? topOnly : categoryItems;
  }, [categoryItems, scopeMode, filterMode]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarApiItem[]>();
    for (const it of filteredItems) {
      const list = map.get(it.dateIso) || [];
      list.push(it);
      map.set(it.dateIso, list);
    }
    return map;
  }, [filteredItems]);

  // Automatically select today (if it has items) or the nearest date with items when switching tabs
  useEffect(() => {
    if (loading) return;
    if ((byDate.get(selectedDateIso) || []).length > 0) return;
    if ((byDate.get(todayIso) || []).length > 0) {
      setSelectedDateIso(todayIso);
      return;
    }
    const firstWithItems = Array.from(byDate.keys())[0];
    if (firstWithItems) {
      setSelectedDateIso(firstWithItems);
    }
  }, [filterMode, scopeMode, byDate, loading, selectedDateIso, todayIso]);

  const selectedDayItems = byDate.get(selectedDateIso) || [];

  const changeMonth = (delta: number) => {
    const next = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + delta,
      1
    );
    setCurrentMonth(next);
    setSelectedDateIso(toIsoDate(next));
  };

  const scopeNoun =
    filterMode === "movie"
      ? "Movies"
      : filterMode === "anime"
      ? "Anime"
      : "Shows";

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <Sidebar />

      <main className="w-full pt-16 md:pt-24 lg:pt-28 px-4 sm:px-6 md:px-10 lg:px-12 max-w-[1480px] mx-auto space-y-6">
        {/* Clean, Intuitive Header & Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 border-b border-white/[0.08] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/15 backdrop-blur-2xl flex items-center justify-center text-white shadow-xl shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                  Release Calendar
                </h1>
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <SiNetflix className="w-3.5 h-3.5 text-[#E50914]" />
                  <SiAppletv className="w-4 h-4 text-white" />
                  <ProviderIcon slug="hbo-max" className="w-5 h-3 opacity-90" />
                  <SiCrunchyroll className="w-3.5 h-3.5 text-[#F47521]" />
                  <SiImdb className="w-4 h-4 text-[#F5C518]" />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-white/55 mt-0.5">
                Pick a day on the calendar to see what drops — ongoing shows repeat every week on their air day
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* 1. Category Selector: TV Series | Movies | Anime | My Watchlist */}
            <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.1] backdrop-blur-2xl">
              {(
                [
                  { id: "tv", label: "TV Series", icon: Tv },
                  { id: "movie", label: "Movies", icon: Film },
                  { id: "anime", label: "Anime", icon: Sparkles },
                  { id: "watchlist", label: "My Watchlist", icon: Bookmark },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = filterMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                      active
                        ? "bg-white text-black shadow-md"
                        : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 2. Simple Scope Setting: Top & Trending vs All Normal Releases */}
            {filterMode !== "watchlist" && (
              <div
                className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.1] backdrop-blur-2xl"
                title="Switch between only the biggest trending hits or all normal releases"
              >
                <button
                  type="button"
                  onClick={() => setScopeMode("top")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                    scopeMode === "top"
                      ? "bg-white text-black shadow-md"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Top {scopeNoun}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScopeMode("all")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                    scopeMode === "all"
                      ? "bg-white text-black shadow-md"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All {scopeNoun}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Month Navigation Bar */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.09] bg-white/[0.025] backdrop-blur-2xl px-4 sm:px-6 py-3">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev Month</span>
          </button>

          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {monthRange.monthLabel}
            </h2>
            <button
              type="button"
              onClick={() => {
                setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelectedDateIso(todayIso);
              }}
              className="px-3 py-1 rounded-lg bg-white/[0.08] hover:bg-white text-white hover:text-black border border-white/15 text-[11px] font-black transition-colors cursor-pointer"
            >
              Jump to Today
            </button>
          </div>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <span className="hidden sm:inline">Next Month</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Main Calendar Grid + Selected Day Breakdown Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Mon-Sun Monthly Calendar Grid */}
          <div className="xl:col-span-8 rounded-3xl border border-white/[0.09] bg-white/[0.02] backdrop-blur-2xl p-3 sm:p-5 shadow-2xl">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-[11px] sm:text-xs font-black uppercase tracking-wider text-white/45 py-1.5"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {monthRange.cells.map((cell) => {
                const dayReleases = byDate.get(cell.iso) || [];
                const isToday = cell.iso === todayIso;
                const isSelected = cell.iso === selectedDateIso;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedDateIso(cell.iso)}
                    className={cn(
                      "group relative min-h-[96px] sm:min-h-[124px] rounded-2xl border p-2 flex flex-col justify-between text-left transition-all cursor-pointer overflow-hidden",
                      !cell.inMonth && "opacity-30",
                      isSelected
                        ? "border-white bg-white/[0.13] ring-1 ring-white/50 shadow-[0_0_25px_rgba(255,255,255,0.12)]"
                        : isToday
                        ? "border-white/45 bg-white/[0.07]"
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20"
                    )}
                  >
                    {/* Day Number & Release Count */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={cn(
                          "text-xs sm:text-sm font-black leading-none flex items-center gap-1",
                          isToday || isSelected ? "text-white" : "text-white/75"
                        )}
                      >
                        <span>{cell.date.getDate()}</span>
                        {isToday && (
                          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white text-black text-[8px] font-black uppercase">
                            Today
                          </span>
                        )}
                      </span>
                      {dayReleases.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-black/75 border border-white/15 text-[9px] font-black text-white/85">
                          {dayReleases.length}
                        </span>
                      )}
                    </div>

                    {/* Visual Poster Thumbnails + Top Title Preview */}
                    {dayReleases.length > 0 ? (
                      <div className="space-y-1.5 w-full pt-1.5">
                        <div className="flex items-center -space-x-2 overflow-hidden w-full">
                          {dayReleases.slice(0, 3).map((rel) => (
                            <div
                              key={rel.id}
                              className="w-7 h-10 sm:w-8 sm:h-11 rounded-md overflow-hidden ring-1 ring-black/90 bg-zinc-900 shrink-0 shadow-md"
                            >
                              {rel.poster ? (
                                <img
                                  src={rel.poster}
                                  alt={rel.title}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-white/10" />
                              )}
                            </div>
                          ))}
                          {dayReleases.length > 3 && (
                            <div className="w-6 h-10 sm:w-7 sm:h-11 rounded-md bg-black/90 border border-white/20 flex items-center justify-center text-[9px] font-black text-white shrink-0 z-10">
                              +{dayReleases.length - 3}
                            </div>
                          )}
                        </div>
                        <p className="hidden sm:block text-[10px] font-bold text-white/75 truncate leading-tight">
                          {dayReleases[0].title}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[10px] text-white/20 font-medium pt-4">
                        —
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Selected Day Easy-to-Read Schedule */}
          <div className="xl:col-span-4 rounded-3xl border border-white/[0.09] bg-white/[0.025] backdrop-blur-2xl p-5 space-y-4 shadow-2xl sticky top-24">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#D3D1CE]">
                  {scopeMode === "top" ? `Top ${scopeNoun} Schedule` : `All ${scopeNoun} Schedule`}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {new Date(`${selectedDateIso}T12:00:00`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-extrabold text-white/85">
                {selectedDayItems.length}{" "}
                {selectedDayItems.length === 1 ? "Title" : "Titles"}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-22 rounded-2xl bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : selectedDayItems.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <CalendarDays className="w-8 h-8 text-white/25 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white/75">
                    No {scopeMode === "top" ? `top ${scopeNoun.toLowerCase()}` : scopeNoun.toLowerCase()} on this date
                  </p>
                  <p className="text-xs text-white/40">
                    Click any day with posters on the calendar{scopeMode === "top" ? ` or switch to "All ${scopeNoun}" above` : ""}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                {selectedDayItems.map((rel) => (
                  <div
                    key={rel.id}
                    className="group flex items-center gap-3.5 p-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all"
                  >
                    <Link
                      href={rel.detailHref}
                      className="w-[50px] h-[72px] sm:w-[56px] sm:h-[80px] rounded-xl overflow-hidden bg-zinc-900 shrink-0 ring-1 ring-white/15 block shadow-md"
                    >
                      {rel.poster ? (
                        <img
                          src={rel.poster}
                          alt={rel.title}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </Link>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rel.episodeLabel && (
                          <span className="px-2 py-0.5 rounded-md bg-white text-black text-[10px] font-black uppercase tracking-wider">
                            {rel.episodeLabel}
                          </span>
                        )}
                        {rel.weekdayLabel && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[10px] font-bold text-white/70">
                            <Repeat className="w-2.5 h-2.5" />
                            <span>{rel.weekdayLabel}</span>
                          </span>
                        )}
                      </div>

                      <Link
                        href={rel.detailHref}
                        className="block text-sm sm:text-[15px] font-black text-white truncate hover:text-[#D3D1CE] transition-colors"
                      >
                        {rel.title}
                      </Link>

                      <div className="flex items-center gap-2.5 text-[11px] text-white/50 font-semibold">
                        {rel.rating && rel.rating > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                            <Star className="w-3 h-3 fill-current" />
                            {rel.rating.toFixed(1)}
                          </span>
                        ) : null}
                        {rel.timeLabel && <span>• {rel.timeLabel}</span>}
                      </div>
                    </div>

                    <Link
                      href={rel.watchHref}
                      title="Watch now"
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center shrink-0 transition-all shadow-md"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
