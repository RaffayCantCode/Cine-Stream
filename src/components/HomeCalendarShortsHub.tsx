"use client";

import { memo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Flame,
  ChevronRight,
  Play,
  Clock,
  Sparkles,
  Tv,
  Film,
} from "lucide-react";

interface HomeCalendarShortsHubProps {
  previewItems?: any[];
}

export const HomeCalendarShortsHub = memo(function HomeCalendarShortsHub({
  previewItems = [],
}: HomeCalendarShortsHubProps) {
  const posters = previewItems
    .filter((it) => it?.poster_path || it?.backdrop_path)
    .slice(0, 6);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="py-3 md:py-5 px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* 1. Release Calendar Hub Card */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-br from-[#0e1b18]/90 via-[#0b1118]/95 to-[#07090e] p-6 sm:p-7 flex flex-col justify-between gap-6 shadow-[0_18px_45px_rgba(0,0,0,0.55)] hover:border-emerald-400/35 transition-all duration-300">
          {/* Ambient glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none group-hover:bg-emerald-500/25 transition-colors" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-md">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Live Schedule • {todayLabel}</span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                TV &amp; Anime Release Calendar
              </h3>
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                Track daily episode drops, season premieres, and weekly anime broadcasts across your watchlist in an interactive monthly calendar.
              </p>
            </div>

            {/* Mini stacked poster preview */}
            {posters.length >= 3 && (
              <div className="hidden sm:flex items-center -space-x-4 shrink-0 pt-1 pr-2">
                {posters.slice(0, 3).map((item, idx) => (
                  <div
                    key={`cal-prev-${item.id || idx}`}
                    className="w-14 h-20 rounded-xl overflow-hidden ring-2 ring-[#0b1118] shadow-xl bg-zinc-900 transition-transform duration-300 group-hover:translate-y-[-2px]"
                    style={{ transform: `rotate(${(idx - 1) * 6}deg)` }}
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w185${item.poster_path || item.backdrop_path}`}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4 pt-2 border-t border-white/[0.07] flex-wrap">
            <div className="flex items-center gap-3 text-xs font-bold text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-emerald-400" /> TV Series
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Anime Simuldubs
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" /> Local Air Times
              </span>
            </div>

            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.03] active:scale-95"
            >
              <span>View Calendar</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>

        {/* 2. Vertical Shorts & Trailers Feed Card */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/[0.09] bg-gradient-to-br from-[#1f0d16]/90 via-[#120b18]/95 to-[#07090e] p-6 sm:p-7 flex flex-col justify-between gap-6 shadow-[0_18px_45px_rgba(0,0,0,0.55)] hover:border-rose-400/35 transition-all duration-300">
          {/* Ambient glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-rose-500/15 blur-3xl pointer-events-none group-hover:bg-rose-500/25 transition-colors" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-md">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300 text-[11px] font-black uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5" />
                <span>Instant Discovery Feed</span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                Shorts &amp; Trailers Feed
              </h3>
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                Swipe through a full-screen vertical feed of trending Movie, TV, and Anime trailers—add to your watchlist or jump straight into watching.
              </p>
            </div>

            {/* Mini stacked poster preview */}
            {posters.length >= 6 && (
              <div className="hidden sm:flex items-center -space-x-4 shrink-0 pt-1 pr-2">
                {posters.slice(3, 6).map((item, idx) => (
                  <div
                    key={`short-prev-${item.id || idx}`}
                    className="w-14 h-20 rounded-xl overflow-hidden ring-2 ring-[#120b18] shadow-xl bg-zinc-900 transition-transform duration-300 group-hover:translate-y-[-2px]"
                    style={{ transform: `rotate(${(idx - 1) * 6}deg)` }}
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w185${item.poster_path || item.backdrop_path}`}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4 pt-2 border-t border-white/[0.07] flex-wrap">
            <div className="flex items-center gap-3 text-xs font-bold text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-rose-400" /> Movies
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-amber-400" /> Series
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Anime Trailers
              </span>
            </div>

            <Link
              href="/shorts"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-rose-600/25 transition-all hover:scale-[1.03] active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Open Shorts</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
});
