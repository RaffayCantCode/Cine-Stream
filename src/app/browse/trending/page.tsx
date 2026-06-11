"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { Loader2 } from "lucide-react";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";

type TrendType = "movie" | "tv" | "anime";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

interface TrendState {
  items: MediaItem[];
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: TrendState = {
  items: [],
  page: 1,
  hasMore: true,
  isLoading: false,
  error: null,
};

export default function TrendingPage() {
  const [activeTab, setActiveTab] = useState<TrendType>("movie");
  const [timeWindow, setTimeWindow] = useState<"day" | "week">("week");
  const [state, setState] = useState<Record<TrendType, TrendState>>({ movie: initialState, tv: initialState, anime: initialState });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Refs per tab: next batch start page, loading flag, hasMore flag
  const nextBatchRef = useRef<Record<TrendType, number>>({ movie: 4, tv: 4, anime: 4 });
  const loadingRef = useRef<Record<TrendType, boolean>>({ movie: false, tv: false, anime: false });
  const hasMoreRef = useRef<Record<TrendType, boolean>>({ movie: true, tv: true, anime: true });

  const current = state[activeTab];
  loadingRef.current[activeTab] = current.isLoading;
  hasMoreRef.current[activeTab] = current.hasMore;

  const loadPage = async (tab: TrendType, startPage: number, append: boolean) => {
    setState((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], isLoading: true, error: null },
    }));

    try {
      const pages = append
        ? [nextBatchRef.current[tab], nextBatchRef.current[tab] + 1, nextBatchRef.current[tab] + 2]
        : [startPage, startPage + 1, startPage + 2];

      const allResults = await Promise.all(
        pages.map(async (p) => {
          if (tab === "anime") {
            const res = await fetchJson<{ success: boolean; data: { items: any[] }; hasMore?: boolean }>(
              `/api/anime?category=trending&page=${p}`,
              { cacheTtlMs: 120000 }
            );
            return {
              results: res.data?.items || [],
              page: p,
              total_pages: res.hasMore !== false ? p + 1 : p,
            };
          } else {
            return fetchJson<{ results: MediaItem[]; page: number; total_pages: number }>(
              `/api/tmdb/trending?type=${tab}&timeWindow=${timeWindow}&page=${p}`,
              { cacheTtlMs: 120000 }
            );
          }
        })
      );

      const merged = tab === "anime"
        ? allResults.flatMap((r) => r.results || [])
        : filterReleasedSafeContent(allResults.flatMap((r) => r.results || []));

      const last = allResults[allResults.length - 1];
      const more = last ? last.page < last.total_pages : false;

      setState((prev) => {
        const combined = append ? [...prev[tab].items, ...merged] : merged;
        const seenIds = new Set();
        const deduplicated = combined.filter((item) => {
          if (!item || !item.id) return false;
          const key = `${item.media_type || tab}-${item.id}`;
          if (seenIds.has(key)) return false;
          seenIds.add(key);
          return true;
        });
        return {
          ...prev,
          [tab]: {
            ...prev[tab],
            isLoading: false,
            items: deduplicated,
            page: startPage,
            hasMore: more,
          },
        };
      });

      if (append) {
        nextBatchRef.current[tab] += 3;
      } else {
        nextBatchRef.current[tab] = startPage + 3;
      }
    } catch (e) {
      setState((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          isLoading: false,
          error: e instanceof Error ? e.message : "Failed to load trending content",
          hasMore: false,
        },
      }));
    }
  };

  useEffect(() => {
    loadPage(activeTab, 1, false);
  }, [activeTab, timeWindow]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        const tab = activeTab;
        if (loadingRef.current[tab] || !hasMoreRef.current[tab]) return;
        loadPage(tab, 1, true);
      },
      { rootMargin: "0px 0px 3000px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, timeWindow, current.isLoading, current.hasMore, current.items.length]);

  const title = useMemo(() => {
    if (activeTab === "movie") return "Trending Movies";
    if (activeTab === "tv") return "Trending TV Shows";
    return "Trending Anime Series";
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="mb-8 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white">Trending</h1>
              <p className="text-sm text-white/40 mt-2">{title}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveTab("movie")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === "movie" ? "bg-[#4B5694] text-white" : "bg-white/[0.05] text-white/60"}`}>Movies</button>
              <button onClick={() => setActiveTab("tv")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === "tv" ? "bg-[#4B5694] text-white" : "bg-white/[0.05] text-white/60"}`}>TV Shows</button>
              <button onClick={() => setActiveTab("anime")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${activeTab === "anime" ? "bg-[#4B5694] text-white" : "bg-white/[0.05] text-white/60"}`}>Anime</button>
              {activeTab !== "anime" && (
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value as "day" | "week")}
                  className="h-10 px-3 rounded-xl bg-[#131945] border border-white/20 text-white text-sm font-semibold appearance-none cursor-pointer hover:border-[#7288AE]/50 transition-colors"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
                >
                  <option value="day" className="bg-[#131945] text-white">Today</option>
                  <option value="week" className="bg-[#131945] text-white">This Week</option>
                </select>
              )}
            </div>
          </div>

          {current.error && <div className="mb-6 text-sm text-red-300">{current.error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {current.items.map((item, idx) => (
              <div key={`${activeTab}-${item.id}-${idx}`} className="w-full h-full flex justify-center">
                {activeTab === "anime" ? (
                  <AnimeCard item={item as any} index={idx} />
                ) : (
                  <MediaCard item={{ ...item, media_type: activeTab }} index={idx} />
                )}
              </div>
            ))}
            {current.isLoading && current.items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="aspect-[2/3] rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>

          <div
            ref={sentinelRef}
            style={{ overflowAnchor: "none" }}
            className="w-full py-12 flex flex-col items-center justify-center gap-3 text-white/40"
          >
            {current.isLoading && current.items.length > 0 ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#7288AE]" />
                <span className="text-sm font-medium text-white/50">Loading more...</span>
              </div>
            ) : current.hasMore ? (
              <span className="text-xs">Scroll down for more</span>
            ) : (
              <span className="text-xs text-white/20">No more results</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
