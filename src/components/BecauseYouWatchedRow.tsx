"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronLeft, ChevronRight, Check, Film, Tv, Sparkles } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { cn } from "@/lib/utils";

interface WatchedSeed {
  key: string;
  mediaId: string;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  updatedAt: number;
}

const BYW_CACHE_PREFIX = "cinestream_byw_mix_v1_";
const memoryRecsCache = new Map<string, any[]>();

function cleanSeedTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  return rawTitle
    .replace(/\s*[-–—]\s*(?:Ep(?:isode)?|S\d+\s*E\d+|Season\s*\d+).*$/i, "")
    .replace(/\s*\(S\d+\s*E\d+\)\s*$/i, "")
    .trim();
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="aspect-[2/3] w-[140px] sm:w-[168px] md:w-[195px] lg:w-[215px] shrink-0 rounded-xl shimmer"
      style={{ animationDelay: `${index * 80}ms` }}
    />
  );
}

export const BecauseYouWatchedRow = memo(function BecauseYouWatchedRow() {
  const { status } = useSession();
  const [seeds, setSeeds] = useState<WatchedSeed[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const loadLocalSeeds = useCallback((): WatchedSeed[] => {
    if (typeof window === "undefined") return [];
    const collected: WatchedSeed[] = [];
    const seenTitles = new Set<string>();

    const pushSeed = (mediaId: string | number | undefined, mediaType: string | undefined, rawTitle: string | undefined, updatedAt = Date.now()) => {
      const cleanTitle = cleanSeedTitle(String(rawTitle || ""));
      if (!cleanTitle || cleanTitle.length < 2) return;
      const normTitle = cleanTitle.toLowerCase();
      if (seenTitles.has(normTitle)) return;
      seenTitles.add(normTitle);

      const mType: "movie" | "tv" | "anime" =
        mediaType === "movie" ? "movie" : mediaType === "anime" ? "anime" : "tv";
      const idStr = String(mediaId || cleanTitle);
      collected.push({
        key: `${mType}:${idStr}`,
        mediaId: idStr,
        mediaType: mType,
        title: cleanTitle,
        updatedAt,
      });
    };

    try {
      const rawCw = localStorage.getItem("cinestream_cw_cache");
      if (rawCw) {
        const parsed = JSON.parse(rawCw);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const ts = entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now();
            pushSeed(entry.mediaId || entry.id, entry.mediaType, entry.title || entry.name, ts);
          }
        }
      }
    } catch {}

    try {
      const rawTv = localStorage.getItem("cinestream_active_tv_show");
      if (rawTv) {
        const parsed = JSON.parse(rawTv);
        pushSeed(parsed?.mediaId || parsed?.id, "tv", parsed?.title, Date.now() - 1000);
      }
    } catch {}

    try {
      const rawAnime = localStorage.getItem("cinestream_active_anime_show");
      if (rawAnime) {
        const parsed = JSON.parse(rawAnime);
        pushSeed(parsed?.mediaId || parsed?.id, "anime", parsed?.title, Date.now() - 2000);
      }
    } catch {}

    return collected.slice(0, 12);
  }, []);

  const refreshSeeds = useCallback(async () => {
    const local = loadLocalSeeds();
    if (local.length > 0) {
      setSeeds(local);
      setSelectedKey((prev) => (prev && local.some((s) => s.key === prev) ? prev : local[0].key));
    }

    if (status === "authenticated") {
      try {
        const res = await fetch("/api/watch-history");
        if (res.ok) {
          const data = await res.json();
          const serverItems: any[] = data?.items || [];
          if (serverItems.length > 0) {
            const mergedMap = new Map<string, WatchedSeed>();
            for (const s of local) {
              mergedMap.set(s.title.toLowerCase(), s);
            }
            for (const entry of serverItems) {
              const cleanTitle = cleanSeedTitle(String(entry.title || entry.name || ""));
              if (!cleanTitle) continue;
              const lower = cleanTitle.toLowerCase();
              if (!mergedMap.has(lower)) {
                const mType: "movie" | "tv" | "anime" =
                  entry.mediaType === "movie" ? "movie" : entry.mediaType === "anime" ? "anime" : "tv";
                const idStr = String(entry.mediaId || entry.id || cleanTitle);
                mergedMap.set(lower, {
                  key: `${mType}:${idStr}`,
                  mediaId: idStr,
                  mediaType: mType,
                  title: cleanTitle,
                  updatedAt: entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now(),
                });
              }
            }
            const merged = Array.from(mergedMap.values()).slice(0, 12);
            setSeeds(merged);
            if (merged.length > 0) {
              setSelectedKey((prev) => (prev && merged.some((s) => s.key === prev) ? prev : merged[0].key));
            }
          }
        }
      } catch {}
    }
  }, [loadLocalSeeds, status]);

  useEffect(() => {
    refreshSeeds();
    const onUpdate = () => refreshSeeds();
    window.addEventListener("cinestream_watch_history_updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("cinestream_watch_history_updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [refreshSeeds]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  const selectedSeed = seeds.find((s) => s.key === selectedKey) || seeds[0] || null;

  // Fetch mixed Movies + TV recommendations whenever selectedSeed changes
  useEffect(() => {
    if (!selectedSeed) return;
    let cancelled = false;
    const cacheKey = `${BYW_CACHE_PREFIX}${selectedSeed.key}`;

    if (memoryRecsCache.has(cacheKey)) {
      setItems(memoryRecsCache.get(cacheKey)!);
      setIsLoading(false);
      return;
    }

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryRecsCache.set(cacheKey, parsed);
          setItems(parsed);
          setIsLoading(false);
          return;
        }
      }
    } catch {}

    setIsLoading(true);
    fetch(
      `/api/tmdb/recommendations?mediaId=${encodeURIComponent(
        selectedSeed.mediaId
      )}&mediaType=${encodeURIComponent(
        selectedSeed.mediaType
      )}&title=${encodeURIComponent(selectedSeed.title)}&mix=true`
    )
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data?.results) ? data.results : [];
        if (results.length > 0) {
          memoryRecsCache.set(cacheKey, results);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(results));
          } catch {}
        }
        setItems(results);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSeed]);

  // Horizontal scroll buttons state
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const target = scrollerRef.current;
      if (!target) return;
      const maxScrollLeft = target.scrollWidth - target.clientWidth;
      setCanScrollLeft(target.scrollLeft > 2);
      setCanScrollRight(target.scrollLeft < maxScrollLeft - 2);
    };
    const throttled = () => {
      if (rafId === null) rafId = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", throttled, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", throttled);
      window.removeEventListener("resize", update);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [items.length, isLoading]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = 220;
    const scrollCount = Math.max(1, Math.floor(el.clientWidth / step));
    const amount = step * scrollCount;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!selectedSeed) return null;
  if (!isLoading && items.length === 0) return null;

  return (
    <div
      className="py-3 md:py-4 space-y-3 animate-fade-in-up"
      style={{ animationDuration: "0.45s" }}
    >
      <div className="flex items-center justify-between px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-1 h-6 md:h-8 bg-gradient-to-b from-[#D3D1CE] to-[#6C6D74] rounded-full shrink-0" />

          <div ref={dropdownRef} className="relative flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-white/80 tracking-tight">
              Because you watched
            </span>

            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="group/byw inline-flex items-center gap-1.5 text-left cursor-pointer focus:outline-none"
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
              title="Switch watched title"
            >
              <span className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight border-b-2 border-white/60 group-hover/byw:border-white pb-0.5 transition-colors line-clamp-1 max-w-[260px] sm:max-w-[420px] md:max-w-[560px]">
                {selectedSeed.title}
              </span>
              <ChevronDown
                className={cn(
                  "w-5 h-5 text-white/75 group-hover/byw:text-white transition-transform duration-200 shrink-0",
                  dropdownOpen && "rotate-180 text-white"
                )}
              />
            </button>

            {dropdownOpen && (
              <div
                role="listbox"
                className="absolute left-0 top-full mt-2.5 z-50 w-72 sm:w-80 max-h-80 overflow-y-auto rounded-2xl border border-white/15 bg-[#0B0F19]/95 backdrop-blur-2xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40 border-b border-white/[0.06] mb-1">
                  Your Recently Watched Titles
                </div>
                {seeds.map((seed) => {
                  const isSelected = seed.key === selectedSeed.key;
                  const TypeIcon =
                    seed.mediaType === "movie"
                      ? Film
                      : seed.mediaType === "anime"
                      ? Sparkles
                      : Tv;
                  return (
                    <button
                      key={seed.key}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedKey(seed.key);
                        setDropdownOpen(false);
                        if (scrollerRef.current) {
                          scrollerRef.current.scrollTo({ left: 0, behavior: "smooth" });
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                        isSelected
                          ? "bg-white/15 text-white font-bold"
                          : "text-white/75 hover:bg-white/[0.08] hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TypeIcon className="w-3.5 h-3.5 text-white/50 shrink-0" />
                        <span className="truncate">{seed.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 font-bold">
                          {seed.mediaType}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              scrollByAmount("left");
            }}
            disabled={!canScrollLeft}
            className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${
              canScrollLeft
                ? "hover:bg-white/15 hover:border-white/30 cursor-pointer"
                : "opacity-30 cursor-not-allowed"
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 ml-[-1px]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              scrollByAmount("right");
            }}
            disabled={!canScrollRight}
            className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${
              canScrollRight
                ? "hover:bg-white/15 hover:border-white/30 cursor-pointer"
                : "opacity-30 cursor-not-allowed"
            }`}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 mr-[-1px]" />
          </button>
        </div>
      </div>

      <div className="relative group/row">
        <div
          ref={scrollerRef}
          className="w-full overflow-x-auto overflow-y-visible pt-6 pb-8 -mt-3 -mb-3 hide-scrollbar"
        >
          <div className="flex px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16 w-max gap-3.5 md:gap-5">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} index={i} />)
              : items.map((item, i) => (
                  <div
                    key={`${item.media_type || "media"}-${item.id}`}
                    className="w-[140px] sm:w-[168px] md:w-[195px] lg:w-[215px] shrink-0"
                  >
                    <MediaCard item={item} index={i} />
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
});
