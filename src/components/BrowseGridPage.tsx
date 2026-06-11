"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { fetchJson } from "@/lib/utils";

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
        const pages = isAppend ? [page, page + 1, page + 2] : [1];

        const allResults = await Promise.all(
          pages.map((p) =>
            fetchJson<{ results: any[]; page?: number; total_pages?: number }>(`${endpoint}?page=${p}`, {
              cacheTtlMs: 120000,
            })
          )
        );

        const merged = allResults.flatMap((data) =>
          (data.results || []).map((item) => (mediaType ? { ...item, media_type: mediaType } : item))
        );

        setItems((prev) => {
          const combined = isAppend ? [...prev, ...merged] : merged;
          const seen = new Set();
          return combined.filter((item) => {
            if (!item || !item.id) return false;
            const key = `${item.media_type || mediaType || ""}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });

        const last = allResults[allResults.length - 1];
        const totalPages = last?.total_pages ?? 1;
        setHasMore(last?.page ? last.page < totalPages : false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load content");
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [endpoint, page, mediaType]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (isLoading || !hasMore) return;
        setPage((p) => p + 3);
      },
      { rootMargin: "0px 0px 3000px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoading, hasMore, items.length]);

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
              <div key={`${item.media_type ?? "item"}-${item.id}-${idx}`} className="w-full h-full flex justify-center">
                <MediaCard item={item} index={idx} />
              </div>
            ))}
            {isLoading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-xl premium-glass skeleton-pulse" />
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
