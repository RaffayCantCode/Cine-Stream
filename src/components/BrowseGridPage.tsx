"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Film, Tv, Layers } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { fetchJson, filterReleasedSafeContent, cn } from "@/lib/utils";

interface BrowseGridPageProps {
  title: string;
  description?: string;
  endpoint: string;
  mediaType?: "movie" | "tv";
}

export function BrowseGridPage({ title, description, endpoint, mediaType }: BrowseGridPageProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | "movie" | "tv">("all");
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
          const pages = [page, page + 1, page + 2];
          const allResults = await Promise.all(
            pages.map((p) =>
              fetchJson<{ results: any[]; page?: number; total_pages?: number; availableTypes?: string[] }>(
                `${fullEndpoint}${sep}page=${p}`,
                { cacheTtlMs: 120000 }
              )
            )
          );
          merged = allResults.flatMap((data) => data.results || []);
          const last = allResults[allResults.length - 1];
          totalPages = last?.total_pages ?? 1;
        } else {
          // Initial load
          const data = await fetchJson<{ results: any[]; page?: number; total_pages?: number; availableTypes?: string[] }>(
            `${fullEndpoint}${sep}page=1`,
            { cacheTtlMs: 120000 }
          );
          if (data.availableTypes) {
            setAvailableTypes(data.availableTypes);
          }
          let results = data.results || [];
          totalPages = data.total_pages ?? 1;

          if (totalPages > 1) {
            const maxPage = Math.min(totalPages, 20);
            let seedPage = 1;
            try {
              let s = sessionStorage.getItem(`sv_browse_page_${title}_${typeFilter}`);
              if (!s) {
                s = String(Math.floor(Math.random() * maxPage) + 1);
                sessionStorage.setItem(`sv_browse_page_${title}_${typeFilter}`, s);
              }
              seedPage = parseInt(s, 10) || 1;
            } catch { seedPage = 1; }

            if (seedPage !== 1 && seedPage <= maxPage) {
              try {
                const randData = await fetchJson<{ results: any[] }>(
                  `${fullEndpoint}${sep}page=${seedPage}`,
                  { cacheTtlMs: 120000 }
                );
                results = [...results, ...randData.results];
              } catch (e) {
                console.error("Failed to fetch random page in BrowseGridPage", e);
              }
            }
          }
          merged = results;
        }

        const filtered = filterReleasedSafeContent(merged);
        const mapped = filtered.map((item) =>
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

        setHasMore(isAppend ? (page + 2) < totalPages : 1 < totalPages);
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
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingRef.current && hasMoreRef.current) {
          setPage((p) => p + 3);
        }
      },
      { rootMargin: "300px" }
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
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-white/40 mt-2">{description}</p> : null}
            <div className="h-0.5 w-16 bg-gradient-to-r from-[#7288AE] to-[#4B5694] rounded-full mt-3 mb-6" />

            {showFilter && (
              <div className="flex items-center gap-2 bg-white/[0.04] p-1.5 rounded-2xl w-fit border border-white/[0.08] backdrop-blur-md">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    typeFilter === "all"
                      ? "bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/25"
                      : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>All Media</span>
                </button>
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
              </div>
            )}
          </div>

          {error && (
            <div className="mb-8 premium-glass p-4 rounded-xl text-sm text-[#7288AE]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
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
