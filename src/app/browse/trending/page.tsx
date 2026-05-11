"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { fetchJson, shuffleArray } from "@/lib/utils";

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
  const [type, setType] = useState<"all" | "movie" | "tv">("all");
  const [timeWindow, setTimeWindow] = useState<"day" | "week">("week");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (initialLoad.current) return;
    setItems([]);
    setHasMore(true);
    setPage(1);
  }, [type, timeWindow]);

  useEffect(() => {
    const load = async (mode: "replace" | "append") => {
      if (mode === "append") setIsLoadingMore(true);
      else setIsLoading(true);

      setError(null);
      try {
        const data = await fetchJson<{
          results: MediaItem[];
          page?: number;
          total_pages?: number;
        }>(`/api/tmdb/trending?type=${type}&timeWindow=${timeWindow}&page=${page}`);

        const next = shuffleArray(data.results || []);
        setItems((prev) => (mode === "append" ? [...prev, ...next] : next));

        const currentPage = data.page ?? page;
        const totalPages = data.total_pages ?? currentPage;
        setHasMore(currentPage < totalPages);
      } catch (e) {
        if (page === 1) setItems([]);
        setHasMore(false);
        setError(e instanceof Error ? e.message : "Failed to load trending content");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    const mode = initialLoad.current ? "replace" : page === 1 ? "replace" : "append";
    load(mode);
    initialLoad.current = false;
  }, [page, type, timeWindow]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-6">
      <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-white">Trending</h1>
            <p className="text-sm text-white/40 mt-2">Fresh picks — reshuffled each time you visit.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "all" | "movie" | "tv")}
              className="h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold outline-none"
              aria-label="Type"
            >
              <option value="all">All</option>
              <option value="movie">Movies</option>
              <option value="tv">TV</option>
            </select>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as "day" | "week")}
              className="h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold outline-none"
              aria-label="Time window"
            >
              <option value="day">Today</option>
              <option value="week">This week</option>
            </select>
            <button
              type="button"
              onClick={() => setItems((prev) => shuffleArray(prev))}
              className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold hover:bg-white/[0.08] transition"
            >
              Shuffle
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/80 mb-10">
            <div className="text-sm font-semibold text-white mb-1">Couldn&apos;t load trending</div>
            <div className="text-xs text-white/50 break-words">{error}</div>
          </div>
        )}

        {isLoading && items.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {items.map((item) => (
              <div key={`${item.media_type ?? "item"}-${item.id}`} className="w-full h-full flex justify-center">
                <MediaCard item={item} />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-12">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={isLoadingMore || isLoading || !hasMore}
            className="h-11 px-6 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-bold hover:bg-white/[0.08] disabled:opacity-50 transition"
          >
            {hasMore ? (isLoadingMore ? "Loading..." : "Load more") : "No more results"}
          </button>
        </div>
      </div>
      </main>
    </div>
  );
}

