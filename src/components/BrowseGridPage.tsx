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

        setItems((prev) => (isAppend ? [...prev, ...merged] : merged));

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
      { rootMargin: "300px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoading, hasMore]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-white">{title}</h1>
            {description ? <p className="text-sm text-white/40 mt-2">{description}</p> : null}
          </div>

          {error && <div className="mb-6 text-sm text-[#D552A3]">{error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {items.map((item, idx) => (
              <div key={`${item.media_type ?? "item"}-${item.id}-${idx}`} className="w-full h-full flex justify-center">
                <MediaCard item={item} index={idx} />
              </div>
            ))}
            {isLoading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>

          <div ref={sentinelRef} className="h-20 flex items-center justify-center text-white/50 text-sm">
            {isLoading && items.length > 0 ? "Loading more..." : hasMore ? "Scroll for more" : "End of results"}
          </div>
        </div>
      </main>
    </div>
  );
}
