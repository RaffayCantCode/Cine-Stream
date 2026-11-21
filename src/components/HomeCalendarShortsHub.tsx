"use client";

import { memo } from "react";
import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { SiNetflix, SiAppletv, SiYoutube, SiCrunchyroll, SiImdb } from "react-icons/si";
import { ProviderIcon } from "@/components/ProviderIcon";

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
        {/* 1. Release Calendar Hub Card — Pure Glassmorphic & Classic Silver/White */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/[0.1] hover:border-white/25 bg-white/[0.03] hover:bg-white/[0.045] backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)] transition-all duration-300">
          {/* Subtle top glass specular highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/[0.04] blur-3xl pointer-events-none group-hover:bg-white/[0.07] transition-colors" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-2.5 max-w-md">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/15 text-[#D3D1CE] text-[11px] font-black uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Release Schedule • {todayLabel}</span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                Release Calendar
              </h3>
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                See exact release dates for upcoming Movies, weekly TV Series episodes, and Anime broadcasts in an interactive monthly calendar.
              </p>
            </div>

            {/* Mini stacked poster preview */}
            {posters.length >= 3 && (
              <div className="hidden sm:flex items-center -space-x-4 shrink-0 pt-1 pr-2">
                {posters.slice(0, 3).map((item, idx) => (
                  <div
                    key={`cal-prev-${item.id || idx}`}
                    className="w-14 h-20 rounded-xl overflow-hidden ring-1 ring-white/20 shadow-2xl bg-zinc-900 transition-transform duration-300 group-hover:-translate-y-1"
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

          <div className="relative z-10 flex items-center justify-between gap-4 pt-3 border-t border-white/[0.08] flex-wrap">
            {/* Real Brand Icons Row */}
            <div className="flex items-center gap-3.5 text-white/65">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <SiNetflix className="w-3.5 h-3.5 text-[#E50914]" title="Netflix" />
                <SiAppletv className="w-4 h-4 text-white" title="Apple TV+" />
                <ProviderIcon slug="hbo-max" className="w-6 h-3.5 opacity-90" />
                <SiCrunchyroll className="w-3.5 h-3.5 text-[#F47521]" title="Crunchyroll" />
              </div>
              <span className="text-xs font-bold text-[#D3D1CE]/70 tracking-wide">
                Movies • Series • Anime
              </span>
            </div>

            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white hover:bg-[#D3D1CE] text-black font-black text-xs sm:text-sm shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all hover:scale-[1.03] active:scale-95"
            >
              <span>Open Calendar</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>

        {/* 2. Vertical Shorts & Trailers Feed Card — Pure Glassmorphic & Classic Silver/White */}
        <div className="group relative overflow-hidden rounded-3xl border border-white/[0.1] hover:border-white/25 bg-white/[0.03] hover:bg-white/[0.045] backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)] transition-all duration-300">
          {/* Subtle top glass specular highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/[0.04] blur-3xl pointer-events-none group-hover:bg-white/[0.07] transition-colors" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-2.5 max-w-md">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/15 text-[#D3D1CE] text-[11px] font-black uppercase tracking-widest">
                <SiYoutube className="w-3.5 h-3.5 text-[#FF0000]" />
                <span>Vertical Cinema Feed</span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                Shorts &amp; Trailers
              </h3>
              <p className="text-xs sm:text-sm text-white/55 leading-relaxed">
                Swipe through an instant full-screen feed of official trailers—preview trending titles in HD, save to your watchlist, or start streaming.
              </p>
            </div>

            {/* Mini stacked poster preview */}
            {posters.length >= 6 && (
              <div className="hidden sm:flex items-center -space-x-4 shrink-0 pt-1 pr-2">
                {posters.slice(3, 6).map((item, idx) => (
                  <div
                    key={`short-prev-${item.id || idx}`}
                    className="w-14 h-20 rounded-xl overflow-hidden ring-1 ring-white/20 shadow-2xl bg-zinc-900 transition-transform duration-300 group-hover:-translate-y-1"
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

          <div className="relative z-10 flex items-center justify-between gap-4 pt-3 border-t border-white/[0.08] flex-wrap">
            {/* Real Brand Icons Row */}
            <div className="flex items-center gap-3.5 text-white/65">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <SiYoutube className="w-4 h-4 text-[#FF0000]" title="YouTube Trailers" />
                <SiImdb className="w-4 h-4 text-[#F5C518]" title="IMDb Rated" />
                <ProviderIcon slug="prime-video" className="w-5 h-3.5 opacity-90" />
                <ProviderIcon slug="disney-plus" className="w-4 h-4 opacity-90" />
              </div>
              <span className="text-xs font-bold text-[#D3D1CE]/70 tracking-wide">
                Official HD Trailers
              </span>
            </div>

            <Link
              href="/shorts"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white hover:bg-[#D3D1CE] text-black font-black text-xs sm:text-sm shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all hover:scale-[1.03] active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Watch Shorts</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
});
