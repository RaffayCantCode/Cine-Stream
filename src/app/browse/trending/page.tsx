"use client";
export const runtime = 'edge';

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { Loader2 } from "lucide-react";
import { fetchJson, isTmdbAnime, filterReleasedSafeContent } from "@/lib/utils";
import { fetchClientAnime } from "@/lib/anilist-client";

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

export default function TrendingPage() {
  const [activeTab, setActiveTab] = useState<TrendType>("movie");
  const [timeWindow, setTimeWindow] = useState<"day" | "week">("week");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadKey, setLoadKey] = useState(0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const nextBatchRef = useRef(1);
  const triggerLoadRef = useRef<(() => void) | null>(null);

  isLoadingRef.current = isLoading || isLoadingMore;
  hasMoreRef.current = hasMore;

  const title = useMemo(() => {
    if (activeTab === "movie") return "Trending Movies";
    if (activeTab === "tv") return "Trending TV Shows";
    return "Trending Anime Series";
  }, [activeTab]);

  // Reset when tab or timeWindow changes
  useEffect(() => {
    setItems([]);
    setHasMore(true);
    setIsLoading(true);
    setError(null);
    nextBatchRef.current = 1;
    setLoadKey((k) => k + 1);
  }, [activeTab, timeWindow]);

  // Fetch data (initial + load more)
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoadingMore(nextBatchRef.current > 1);
      setIsLoading(nextBatchRef.current === 1);
      setError(null);
      isLoadingRef.current = true;

      try {
        const pagesToFetch =
          nextBatchRef.current === 1
            ? [1, 2, 3]
            : [nextBatchRef.current, nextBatchRef.current + 1, nextBatchRef.current + 2];

        const rawResults = await Promise.all(
          pagesToFetch.map(async (p) => {
            if (activeTab === "anime") {
              const res = await fetchClientAnime("trending", p);
              return { data: { items: res?.items || [] }, hasMore: res?.hasMore };
            }
            return fetchJson<{ results: MediaItem[]; page: number; total_pages: number }>(
              `/api/tmdb/trending?type=${activeTab}&timeWindow=${timeWindow}&page=${p}`,
              { cacheTtlMs: 120000 }
            );
          })
        );

        if (cancelled) return;

        const results = rawResults.map((r) => r as any);
        const merged =
          activeTab === "anime"
            ? results.flatMap((r: any) => r.data?.items || r.results || [])
            : filterReleasedSafeContent(results.flatMap((r: any) => r.results || []));

        const last = results[results.length - 1] as any;
        const totalPages =
          activeTab === "anime" ? (last?.hasMore ? 999 : pagesToFetch[pagesToFetch.length - 1]) : last?.total_pages ?? 1;
        const apiHasMore = pagesToFetch[pagesToFetch.length - 1] < totalPages;
        const more = apiHasMore && (merged.length > 0 || nextBatchRef.current === 1);

        setItems((prev) => {
          const combined = nextBatchRef.current === 1 ? merged : [...prev, ...merged];
          const seenIds = new Set();
          const deduplicated = combined.filter((item) => {
            if (!item || !item.id) return false;
            const key = `${item.media_type || activeTab}-${item.id}`;
            if (seenIds.has(key)) return false;
            seenIds.add(key);
            return true;
          });
          return deduplicated;
        });

        setHasMore(more);
        if (merged.length > 0) nextBatchRef.current += 3;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load trending content");
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingMore(false);
          isLoadingRef.current = false;
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [loadKey]);

  // ── Scroll-to-load-more: Intersection Observer ──
  useEffect(() => {
    const check = () => {
      if (isLoadingRef.current || !hasMoreRef.current) return;
      setLoadKey((k) => k + 1);
    };
    triggerLoadRef.current = check;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          check();
        }
      },
      { rootMargin: "400px" } // Fixed dead zone: match threshold closely
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Re-check after items change
  useEffect(() => {
    if (!sentinelRef.current) return;
    const rect = sentinelRef.current.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 800) {
      triggerLoadRef.current?.();
    }
  }, [items.length]);

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

          {error && <div className="mb-6 text-sm text-red-300">{error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {items.map((item, idx) => (
              <div key={`${activeTab}-${item.id}`} className="w-full h-full flex justify-center">
                {activeTab === "anime" ? (
                  <AnimeCard item={item as any} index={idx} />
                ) : (
                  <MediaCard item={{ ...item, media_type: activeTab }} index={idx} />
                )}
              </div>
            ))}
            {isLoading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="aspect-[2/3] rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>

          <div
            ref={sentinelRef}
            style={{ overflowAnchor: "none" }}
            className="w-full py-16 flex flex-col items-center justify-center gap-3 text-white/40 min-h-[100px]"
          >
            {isLoadingMore || isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#7288AE]" />
                <span className="text-sm font-medium text-white/50">Loading more...</span>
              </div>
            ) : items.length > 0 && !hasMore ? (
              <span className="text-xs text-white/20">No more results</span>
            ) : (
               <div className="h-10 w-full" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
