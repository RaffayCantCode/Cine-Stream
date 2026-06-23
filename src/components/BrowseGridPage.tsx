"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { MediaCard } from "@/components/MediaCard";
import { fetchJson, shuffleArray, filterReleasedSafeContent } from "@/lib/utils";

interface BrowseGridPageProps {
  title: string;
  description?: string;
  endpoint: string;
  mediaType?: "movie" | "tv";
}

export function BrowseGridPage({ title, description, endpoint, mediaType }: BrowseGridPageProps) {
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
  }, [endpoint, mediaType]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const isAppend = page > 1;
        const sep = endpoint.includes("?") ? "&" : "?";
        let merged: any[] = [];
        let totalPages = 1;

        if (isAppend) {
          const pages = [page, page + 1, page + 2];
          const allResults = await Promise.all(
            pages.map((p) =>
              fetchJson<{ results: any[]; page?: number; total_pages?: number }>(
                `${endpoint}${sep}page=${p}`,
                { cacheTtlMs: 120000 }
              )
            )
          );
          merged = allResults.flatMap((data) => data.results || []);
          const last = allResults[allResults.length - 1];
          totalPages = last?.total_pages ?? 1;
        } else {
          // Initial load
          const data = await fetchJson<{ results: any[]; page?: number; total_pages?: number }>(
            `${endpoint}${sep}page=1`,
            { cacheTtlMs: 120000 }
          );
          let results = data.results || [];
          totalPages = data.total_pages ?? 1;

          if (totalPages > 1) {
            const maxPage = Math.min(totalPages, 20);
            const randomPage = Math.floor(Math.random() * maxPage) + 1;
            if (randomPage !== 1) {
              try {
                const randData = await fetchJson<{ results: any[] }>(
                  `${endpoint}${sep}page=${randomPage}`,
                  { cacheTtlMs: 120000 }
                );
                results = [...results, ...randData.results];
              } catch (e) {
                console.error("Failed to fetch random page in BrowseGridPage", e);
              }
            }
          }
          // Shuffle the initial results to randomize them on every refresh
          merged = shuffleArray(results);
        }

        const filtered = filterReleasedSafeContent(merged);
        const mapped = filtered.map((item) =>
          mediaType ? { ...item, media_type: mediaType } : item
        );

        setItems((prev) => {
          const combined = isAppend ? [...prev, ...mapped] : mapped;
          const seen = new Set();
          return combined.filter((item) => {
            if (!item || !item.id) return false;
            const key = `${item.media_type || mediaType || ""}-${item.id}`;
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
  }, [endpoint, page, mediaType]);

  // ── Scroll-to-load-more: window scroll listener (works on Netlify with overflow-x:hidden body) ──
  useEffect(() => {
    const check = () => {
      if (isLoadingRef.current || !hasMoreRef.current) return;
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 2) {
        setPage((p) => p + 3);
      }
    };
    triggerLoadRef.current = check;
    window.addEventListener('scroll', check, { passive: true });
    check(); // immediate check
    return () => window.removeEventListener('scroll', check);
  }, []);

  // Re-check after items change
  useEffect(() => {
    triggerLoadRef.current?.();
  }, [items.length]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-white/40 mt-2">{description}</p> : null}
            <div className="h-0.5 w-16 bg-gradient-to-r from-[#7288AE] to-[#4B5694] rounded-full mt-3" />
          </div>

          {error && (
            <div className="mb-8 premium-glass p-4 rounded-xl text-sm text-[#7288AE]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {items.map((item, idx) => (
              <div key={`${item.media_type ?? "item"}-${item.id}`} className="w-full h-full flex justify-center">
                <MediaCard item={item} index={idx} />
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
