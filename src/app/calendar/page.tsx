"use client";
export const runtime = "edge";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Play,
  Star,
  Tv,
  Sparkles,
  Bookmark,
  Clock,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useWatchlist } from "@/context/WatchlistContext";
import { usePageContentReady } from "@/lib/pageLoad";
import { fetchJson, filterExcludeAnime, cn } from "@/lib/utils";

interface CalendarReleaseItem {
  id: string;
  mediaId: number | string;
  mediaType: "tv" | "anime";
  title: string;
  poster: string | null;
  backdrop: string | null;
  dateIso: string; // YYYY-MM-DD
  timeLabel?: string | null;
  episodeLabel?: string | null;
  rating?: number | null;
  detailHref: string;
  watchHref: string;
}

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
  const [filterMode, setFilterMode] = useState<"all" | "watchlist" | "tv" | "anime">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [items, setItems] = useState<CalendarReleaseItem[]>([]);
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
      firstIso: toIsoDate(firstDay),
      lastIso: toIsoDate(lastDay),
      startUnix: Math.floor(firstDay.getTime() / 1000),
      endUnix: Math.floor(new Date(year, month + 1, 0, 23, 59, 59).getTime() / 1000),
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

    const loadSchedule = async () => {
      const collected: CalendarReleaseItem[] = [];

      // 1. Fetch TMDB TV releases in this month + airing today
      const tmdbTask = (async () => {
        try {
          const [p1, p2, airingToday] = await Promise.allSettled([
            fetchJson<{ results: any[] }>(
              `/api/tmdb/discover/tv?sortBy=popularity.desc&airDateGte=${monthRange.firstIso}&airDateLte=${monthRange.lastIso}&page=1`
            ),
            fetchJson<{ results: any[] }>(
              `/api/tmdb/discover/tv?sortBy=popularity.desc&airDateGte=${monthRange.firstIso}&airDateLte=${monthRange.lastIso}&page=2`
            ),
            fetchJson<{ results: any[] }>("/api/tmdb/tv/airing-today"),
          ]);

          const rawTv: any[] = [];
          if (p1.status === "fulfilled" && Array.isArray(p1.value?.results)) {
            rawTv.push(...p1.value.results);
          }
          if (p2.status === "fulfilled" && Array.isArray(p2.value?.results)) {
            rawTv.push(...p2.value.results);
          }
          if (
            airingToday.status === "fulfilled" &&
            Array.isArray(airingToday.value?.results)
          ) {
            for (const show of airingToday.value.results) {
              rawTv.push({ ...show, _airingTodayIso: todayIso });
            }
          }

          const cleanTv = filterExcludeAnime(rawTv);
          const seenTv = new Set<string>();

          for (const show of cleanTv) {
            if (!show?.id || (!show.poster_path && !show.backdrop_path)) continue;
            const dateIso = show._airingTodayIso || show.first_air_date;
            if (!dateIso || dateIso < monthRange.firstIso || dateIso > monthRange.lastIso) {
              continue;
            }
            const key = `tv-${show.id}-${dateIso}`;
            if (seenTv.has(key)) continue;
            seenTv.add(key);

            collected.push({
              id: key,
              mediaId: show.id,
              mediaType: "tv",
              title: show.name || show.title || "TV Series",
              poster: show.poster_path
                ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
                : null,
              backdrop: show.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}`
                : null,
              dateIso,
              episodeLabel: show._airingTodayIso ? "New Episode" : "Season Premiere",
              rating: show.vote_average || null,
              detailHref: `/tv/${show.id}`,
              watchHref: `/watch/tv/${show.id}/1/1`,
            });
          }
        } catch {}
      })();

      // 2. Fetch AniList AiringSchedule for this month (up to 2 pages)
      const animeTask = (async () => {
        try {
          const query = `
            query ($start: Int, $end: Int, $page: Int) {
              Page(page: $page, perPage: 50) {
                airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
                  id
                  episode
                  airingAt
                  media {
                    id
                    isAdult
                    title { english romaji }
                    coverImage { large extraLarge }
                    bannerImage
                    averageScore
                    format
                  }
                }
              }
            }
          `;
          const pages = await Promise.allSettled(
            [1, 2].map((page) =>
              fetch("https://graphql.anilist.co", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query,
                  variables: {
                    start: monthRange.startUnix,
                    end: monthRange.endUnix,
                    page,
                  },
                }),
                signal: AbortSignal.timeout(5500),
              }).then((r) => (r.ok ? r.json() : null))
            )
          );

          const seenAnime = new Set<string>();
          for (const res of pages) {
            if (res.status !== "fulfilled" || !res.value?.data?.Page?.airingSchedules) continue;
            for (const sched of res.value.data.Page.airingSchedules) {
              const media = sched?.media;
              if (!media || media.isAdult) continue;
              const airDate = new Date(sched.airingAt * 1000);
              const dateIso = toIsoDate(airDate);
              const key = `anime-${media.id}-ep${sched.episode}-${dateIso}`;
              if (seenAnime.has(key)) continue;
              seenAnime.add(key);

              collected.push({
                id: key,
                mediaId: media.id,
                mediaType: "anime",
                title: media.title?.english || media.title?.romaji || "Anime",
                poster: media.coverImage?.extraLarge || media.coverImage?.large || null,
                backdrop: media.bannerImage || media.coverImage?.extraLarge || null,
                dateIso,
                timeLabel: airDate.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                }),
                episodeLabel: `Episode ${sched.episode}`,
                rating: media.averageScore ? media.averageScore / 10 : null,
                detailHref: `/anime/${media.id}`,
                watchHref: `/watch/anime/${media.id}/${sched.episode || 1}`,
              });
            }
          }
        } catch {}
      })();

      await Promise.allSettled([tmdbTask, animeTask]);
      if (cancelled) return;

      collected.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      setItems(collected);
      setLoading(false);
    };

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [monthRange, todayIso]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
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

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarReleaseItem[]>();
    for (const it of filteredItems) {
      const list = map.get(it.dateIso) || [];
      list.push(it);
      map.set(it.dateIso, list);
    }
    return map;
  }, [filteredItems]);

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

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <Sidebar />

      <main className="w-full pt-16 md:pt-24 lg:pt-28 px-4 sm:px-6 md:px-10 lg:px-12 max-w-[1460px] mx-auto space-y-8">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/[0.08] pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-lg">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                Release Calendar
              </h1>
              <p className="text-xs sm:text-sm text-white/50 mt-0.5">
                Track upcoming TV episodes, premieres &amp; anime broadcasts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              {(
                [
                  { id: "all", label: "All Shows" },
                  { id: "watchlist", label: "My Shows", icon: Bookmark },
                  { id: "tv", label: "TV Series", icon: Tv },
                  { id: "anime", label: "Anime", icon: Sparkles },
                ] as const
              ).map((tab) => {
                const Icon = (tab as any).icon;
                const active = filterMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                      active
                        ? "bg-white text-black shadow-sm"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Grid vs List View Toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                  viewMode === "grid"
                    ? "bg-emerald-500 text-black"
                    : "text-white/60 hover:text-white"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer",
                  viewMode === "list"
                    ? "bg-emerald-500 text-black"
                    : "text-white/60 hover:text-white"
                )}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Month Navigation Bar */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-xl px-4 sm:px-6 py-3.5">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
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
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-[11px] font-black text-emerald-300 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Mon-Sun Monthly Calendar Grid */}
            <div className="xl:col-span-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-3 sm:p-5 shadow-2xl">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[11px] sm:text-xs font-black uppercase tracking-wider text-white/40 py-1.5"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
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
                        "relative min-h-[82px] sm:min-h-[108px] rounded-2xl border p-1.5 sm:p-2 flex flex-col justify-between text-left transition-all cursor-pointer overflow-hidden",
                        !cell.inMonth && "opacity-35",
                        isSelected
                          ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/50 shadow-lg"
                          : isToday
                          ? "border-sky-400/60 bg-sky-500/10"
                          : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={cn(
                            "text-xs sm:text-sm font-black leading-none",
                            isToday
                              ? "text-sky-300"
                              : isSelected
                              ? "text-emerald-300"
                              : "text-white/80"
                          )}
                        >
                          {cell.date.getDate()}
                        </span>
                        {dayReleases.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-black/70 border border-white/15 text-[9px] font-black text-white/80">
                            {dayReleases.length}
                          </span>
                        )}
                      </div>

                      {/* Stacked Mini-Posters (Cinejoy style) */}
                      {dayReleases.length > 0 && (
                        <div className="flex items-center -space-x-2.5 overflow-hidden pt-1 w-full">
                          {dayReleases.slice(0, 3).map((rel) => (
                            <div
                              key={rel.id}
                              className="w-6 h-8 sm:w-8 sm:h-11 rounded-md overflow-hidden ring-1 ring-black/90 bg-zinc-900 shrink-0 shadow-md"
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
                            <div className="w-6 h-8 sm:w-7 sm:h-11 rounded-md bg-black/90 border border-white/20 flex items-center justify-center text-[9px] font-black text-white shrink-0 z-10">
                              +{dayReleases.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Episode Breakdown Panel */}
            <div className="xl:col-span-4 rounded-3xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-xl p-5 space-y-4 shadow-2xl sticky top-24">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Selected Day
                  </span>
                  <h3 className="text-lg font-black text-white">
                    {new Date(`${selectedDateIso}T12:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-extrabold text-white/80">
                  {selectedDayItems.length}{" "}
                  {selectedDayItems.length === 1 ? "Release" : "Releases"}
                </span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : selectedDayItems.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <CalendarDays className="w-8 h-8 text-white/25 mx-auto" />
                  <p className="text-sm font-bold text-white/70">No scheduled releases</p>
                  <p className="text-xs text-white/40">
                    Select another highlighted day on the calendar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
                  {selectedDayItems.map((rel) => (
                    <div
                      key={rel.id}
                      className="group flex items-center gap-3.5 p-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all"
                    >
                      <Link
                        href={rel.detailHref}
                        className="w-12 h-16 sm:w-[54px] sm:h-[76px] rounded-xl overflow-hidden bg-zinc-900 shrink-0 ring-1 ring-white/10 block"
                      >
                        {rel.poster ? (
                          <img
                            src={rel.poster}
                            alt={rel.title}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </Link>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                              rel.mediaType === "anime"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-400/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                            )}
                          >
                            {rel.mediaType === "anime" ? "Anime" : "TV"}
                          </span>
                          {rel.episodeLabel && (
                            <span className="text-[11px] font-extrabold text-white/75">
                              {rel.episodeLabel}
                            </span>
                          )}
                        </div>

                        <Link
                          href={rel.detailHref}
                          className="block text-sm font-black text-white truncate hover:text-primary transition-colors"
                        >
                          {rel.title}
                        </Link>

                        <div className="flex items-center gap-2.5 text-[11px] text-white/50 font-semibold">
                          {rel.timeLabel && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {rel.timeLabel}
                            </span>
                          )}
                          {rel.rating && rel.rating > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                              <Star className="w-3 h-3 fill-current" />
                              {rel.rating.toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <Link
                        href={rel.watchHref}
                        title="Watch now"
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center shrink-0 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Chronological Schedule List View */
          <div className="space-y-6">
            {Array.from(byDate.entries()).map(([dateIso, dayList]) => (
              <div
                key={dateIso}
                className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {new Date(`${dateIso}T12:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <span className="text-xs font-bold text-white/45">
                    {dayList.length} {dayList.length === 1 ? "Episode" : "Episodes"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {dayList.map((rel) => (
                    <div
                      key={rel.id}
                      className="flex items-center gap-3.5 p-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.06] transition-all"
                    >
                      <Link
                        href={rel.detailHref}
                        className="w-14 h-20 rounded-xl overflow-hidden bg-zinc-900 shrink-0"
                      >
                        {rel.poster && (
                          <img
                            src={rel.poster}
                            alt={rel.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                          {rel.episodeLabel || "New Release"}
                        </span>
                        <Link
                          href={rel.detailHref}
                          className="block text-sm font-black text-white truncate hover:text-primary"
                        >
                          {rel.title}
                        </Link>
                        {rel.timeLabel && (
                          <span className="text-xs text-white/45 block">{rel.timeLabel}</span>
                        )}
                      </div>
                      <Link
                        href={rel.watchHref}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center shrink-0 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
