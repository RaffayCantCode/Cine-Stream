"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Film, Tv, Layers, Flame } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { fetchJson, filterReleasedSafeContent, filterExcludeAnime, isTmdbAnime, cn } from "@/lib/utils";

interface BrowseGridPageProps {
  title: string;
  description?: string;
  endpoint: string;
  mediaType?: "movie" | "tv";
}

export function BrowseGridPage({ title, description, endpoint, mediaType }: BrowseGridPageProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv" | "anime">("all");
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(true);
  const hasMoreRef = useRef(true);
  const triggerLoadRef = useRef<(() => void) | null>(null);
  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  }, [endpoint, mediaType, typeFilter]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const isAppend = page > 1;
        const activeType = mediaType || (typeFilter !== "all" ? typeFilter : undefined);
        const typeQuery = activeType ? `&type=${activeType}` : "";
        const sep = endpoint.includes("?") ? "&" : "?";
        const fullEndpoint = `${endpoint}${typeQuery}`;
        let merged: any[] = [];
        let totalPages = 1;

        if (isAppend) {
          const data = await fetchJson<{ results: any[]; page?: number; total_pages?: number; availableTypes?: string[] }>(
            `${fullEndpoint}${sep}page=${page}`,
            { cacheTtlMs: 300000 }
          );
          merged = data?.results || [];
          totalPages = data?.total_pages ?? 1;
        } else {
          // Initial load: 1 fast call
          const data = await fetchJson<{ results: any[]; page?: number; total_pages?: number; availableTypes?: string[] }>(
            `${fullEndpoint}${sep}page=1`,
            { cacheTtlMs: 300000 }
          );
          if (data?.availableTypes) {
            setAvailableTypes(data.availableTypes);
          }
          merged = data?.results || [];
          totalPages = data?.total_pages ?? 1;
        }

        const filtered = merged.filter((item) => {
          if (item.media_type === "anime") return true;
          return filterReleasedSafeContent([item]).length > 0;
        });

        const withoutAnime = (mediaType === "movie" || mediaType === "tv" || typeFilter === "movie" || typeFilter === "tv")
          ? filterExcludeAnime(filtered)
          : filtered.filter((item) => item.media_type === "anime" || !isTmdbAnime(item));
        const mapped = withoutAnime.map((item) =>
          activeType ? { ...item, media_type: item.media_type || activeType } : item
        );

        setItems((prev) => {
          const combined = isAppend ? [...prev, ...mapped] : mapped;
          const seen = new Set();
          return combined.filter((item) => {
            if (!item || !item.id) return false;
            const itemType = item.media_type || (item.title ? "movie" : "tv");
            if (typeFilter !== "all" && itemType !== typeFilter) return false;
            const key = `${itemType}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });

        setHasMore(page < totalPages);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load content");
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [endpoint, page, mediaType, typeFilter]);

  // ── Scroll-to-load-more: Smooth IntersectionObserver ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isLoadingRef.current && hasMoreRef.current) {
          setPage((p) => p + 3);
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Re-check after items change
  useEffect(() => {
    triggerLoadRef.current?.();
  }, [items.length]);

  const showFilter = !mediaType && (availableTypes.length === 0 || availableTypes.length > 1);
  const shouldShowCardBadges = !mediaType && typeFilter === "all" && (availableTypes.length === 0 || availableTypes.length > 1);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-5 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-white/40 mt-2">{description}</p> : null}
            <div className="h-0.5 w-16 bg-gradient-to-r from-[#D3D1CE] to-[#6C6D74] rounded-full mt-3 mb-6" />

            {showFilter && (
              <div className="flex items-center gap-2 bg-white/[0.04] p-1.5 rounded-2xl w-fit border border-white/[0.08] backdrop-blur-md">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
                    typeFilter === "all"
                      ? "bg-[#262E36] text-[#D3D1CE] border-white/20 shadow-md"
                      : "text-white/60 border-transparent hover:text-white hover:bg-white/[0.06]"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Media</span>
                </button>
                {(availableTypes.length === 0 || availableTypes.includes("movie")) && (
                  <button
                    onClick={() => setTypeFilter("movie")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                      typeFilter === "movie"
                        ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25"
                        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Movies</span>
                  </button>
                )}
                {(availableTypes.length === 0 || availableTypes.includes("tv")) && (
                  <button
                    onClick={() => setTypeFilter("tv")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                      typeFilter === "tv"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>TV Shows</span>
                  </button>
                )}
                {availableTypes.includes("anime") && (
                  <button
                    onClick={() => setTypeFilter("anime")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                      typeFilter === "anime"
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
                        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Anime</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-8 premium-glass p-4 rounded-xl text-sm text-[#7288AE]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
            {items.map((item, idx) => (
              <div key={`${item.media_type ?? "item"}-${item.id}`} className="w-full h-full flex justify-center">
                <MediaCard item={item} index={idx} showMediaBadge={shouldShowCardBadges} />
              </div>
            ))}
            {isLoading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-xl bg-muted/50 skeleton-pulse" />
            ))}
          </div>

          <div ref={sentinelRef} style={{ overflowAnchor: "none" }} className="h-20 flex items-center justify-center text-white/40 text-sm font-medium">
            {isLoading && items.length > 0 ? (
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7288AE] animate-pulse" />
                Loading more...
              </span>
            ) : hasMore ? (
              <span className="text-white/20">Scroll to load more</span>
            ) : (
              <span className="text-white/10">End of results</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
