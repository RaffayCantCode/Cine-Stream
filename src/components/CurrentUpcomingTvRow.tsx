"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Play, Star, Tv, Calendar } from "lucide-react";
import { fetchJson, filterExcludeAnime, cn } from "@/lib/utils";
import { cacheMediaPreview } from "@/lib/media-preview-cache";

interface TvLandscapeItem {
  id: number;
  name?: string;
  title?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  first_air_date?: string;
  origin_country?: string[];
  original_language?: string;
  genre_ids?: number[];
  badgeType?: "New Episode" | "New Season" | "Upcoming";
}

function formatShortDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const LandscapeTvCard = memo(function LandscapeTvCard({
  item,
  index,
}: {
  item: TvLandscapeItem;
  index: number;
}) {
  const router = useRouter();
  const title = item.name || item.title || "Untitled Series";
  const link = `/tv/${item.id}`;
  const imgPath = item.backdrop_path || item.poster_path;
  const imgUrl = imgPath
    ? imgPath.startsWith("http")
      ? imgPath
      : `https://image.tmdb.org/t/p/w780${imgPath}`
    : null;
  const [loaded, setLoaded] = useState(false);

  const warmedRef = useRef(false);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const warmDestination = useCallback(() => {
    if (warmedRef.current) return;
    warmedRef.current = true;
    cacheMediaPreview(item as any, "tv");
    void fetchJson(`/api/tmdb/tv/${item.id}`).catch(() => {});
    void fetchJson(`/api/tmdb/tv/${item.id}/season/1`).catch(() => {});
    router.prefetch(link);
  }, [item, link, router]);

  const scheduleWarm = useCallback(() => {
    if (warmedRef.current || warmTimerRef.current) return;
    warmTimerRef.current = setTimeout(() => {
      warmTimerRef.current = null;
      warmDestination();
    }, 120);
  }, [warmDestination]);

  const cancelWarm = useCallback(() => {
    if (warmTimerRef.current) {
      clearTimeout(warmTimerRef.current);
      warmTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelWarm, [cancelWarm]);

  const badge =
    item.badgeType ||
    (index % 3 === 0 ? "New Episode" : index % 3 === 1 ? "New Season" : "Upcoming");
  const badgeStyle =
    badge === "New Episode"
      ? "bg-rose-600 text-white border-rose-400/50 shadow-rose-600/30"
      : badge === "New Season"
      ? "bg-emerald-500 text-black border-emerald-300 shadow-emerald-500/30"
      : "bg-amber-400 text-black border-amber-300 shadow-amber-400/30";

  const shortDate = formatShortDate(item.first_air_date);
  const year = (item.first_air_date || "").slice(0, 4);

  return (
    <Link
      href={link}
      prefetch={false}
      onMouseEnter={scheduleWarm}
      onMouseLeave={cancelWarm}
      onFocus={warmDestination}
      onTouchStart={warmDestination}
      className="row-item group relative block w-[270px] sm:w-[310px] md:w-[350px] shrink-0 select-none focus:outline-none"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-card/80 ring-1 ring-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.55)] transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1 group-hover:ring-white/35 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.75)]">
        {!loaded && <div className="absolute inset-0 shimmer bg-white/[0.04]" />}
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={title}
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cn(
              "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e2530] to-[#0f1319]">
            <Tv className="w-8 h-8 text-white/25" />
          </div>
        )}

        {/* Cinematic bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

        {/* Status Pill Badge */}
        <div className="absolute top-3 left-3 z-20">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-lg",
              badgeStyle
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {badge}
          </span>
        </div>

        {/* Center hover play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-black text-black ml-0.5" />
          </div>
        </div>

        {/* Bottom overlay title & metadata */}
        <div className="absolute bottom-3 inset-x-3.5 z-20 flex flex-col gap-1">
          <h3 className="text-sm sm:text-base font-black text-white truncate drop-shadow-md group-hover:text-primary transition-colors">
            {title}
          </h3>
          <div className="flex items-center gap-2 text-[11px] font-extrabold text-white/75">
            {item.vote_average && item.vote_average > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <Star className="w-3 h-3 fill-current" />
                {item.vote_average.toFixed(1)}
              </span>
            ) : null}
            {year && <span>• {year}</span>}
            {shortDate && (
              <span className="inline-flex items-center gap-1 text-white/60">
                • <Calendar className="w-3 h-3" /> {shortDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

export const CurrentUpcomingTvRow = memo(function CurrentUpcomingTvRow({
  fallbackItems = [],
}: {
  fallbackItems?: any[];
}) {
  const [items, setItems] = useState<TvLandscapeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const todayIso = new Date().toISOString().split("T")[0];

    const load = async () => {
      try {
        const [airingRes, upcomingRes] = await Promise.allSettled([
          fetchJson<{ results: any[] }>("/api/tmdb/tv/airing-today"),
          fetchJson<{ results: any[] }>(
            `/api/tmdb/discover/tv?sortBy=popularity.desc&airDateGte=${todayIso}`
          ),
        ]);

        if (cancelled) return;

        const airing =
          airingRes.status === "fulfilled" && Array.isArray(airingRes.value?.results)
            ? filterExcludeAnime(airingRes.value.results)
            : [];
        const upcoming =
          upcomingRes.status === "fulfilled" && Array.isArray(upcomingRes.value?.results)
            ? filterExcludeAnime(upcomingRes.value.results)
            : [];

        const seen = new Set<number>();
        const merged: TvLandscapeItem[] = [];
        const maxLen = Math.max(airing.length, upcoming.length);

        for (let i = 0; i < maxLen; i++) {
          const a = airing[i];
          if (a?.id && (a.backdrop_path || a.poster_path) && !seen.has(a.id)) {
            seen.add(a.id);
            merged.push({ ...a, badgeType: "New Episode" });
          }
          const u = upcoming[i];
          if (u?.id && (u.backdrop_path || u.poster_path) && !seen.has(u.id)) {
            seen.add(u.id);
            const isFuture = u.first_air_date && u.first_air_date > todayIso;
            merged.push({
              ...u,
              badgeType: isFuture ? "Upcoming" : "New Season",
            });
          }
        }

        if (merged.length < 6 && fallbackItems.length > 0) {
          for (const it of fallbackItems) {
            if (!it?.id || seen.has(it.id)) continue;
            seen.add(it.id);
            merged.push({ ...it, badgeType: "New Episode" });
          }
        }

        setItems(merged.slice(0, 18));
      } catch {
        if (!cancelled && fallbackItems.length > 0) {
          setItems(fallbackItems.slice(0, 14));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [fallbackItems]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < max - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length, loading]);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!loading && items.length === 0) return null;

  return (
    <div className="py-3 md:py-4 space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 md:h-8 bg-gradient-to-b from-emerald-400 to-teal-600 rounded-full" />
          <div className="flex items-center gap-2.5">
            <Tv className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md">
              Current &amp; Upcoming TV Shows
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollByAmount("left")}
              disabled={!canScrollLeft}
              className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all ${
                canScrollLeft
                  ? "hover:bg-white/15 hover:border-white/30 cursor-pointer"
                  : "opacity-30 cursor-not-allowed"
              }`}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount("right")}
              disabled={!canScrollRight}
              className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all ${
                canScrollRight
                  ? "hover:bg-white/15 hover:border-white/30 cursor-pointer"
                  : "opacity-30 cursor-not-allowed"
              }`}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <Link
            href="/calendar"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-300/80 hover:text-emerald-300 transition-colors group px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/20"
          >
            <span>Release Calendar</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="w-full overflow-x-auto overflow-y-visible pt-3 pb-5 hide-scrollbar"
      >
        <div className="flex px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16 w-max gap-4 md:gap-5">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-video w-[270px] sm:w-[310px] md:w-[350px] shrink-0 rounded-2xl shimmer"
                />
              ))
            : items.map((item, i) => (
                <LandscapeTvCard key={item.id} item={item} index={i} />
              ))}
        </div>
      </div>
    </div>
  );
});
