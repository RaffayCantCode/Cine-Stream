"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { fetchJson, shuffleArray } from "@/lib/utils";

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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (mode: "replace" | "append") => {
      if (mode === "append") setIsLoadingMore(true);
      else setIsLoading(true);

      setError(null);
      try {
        const data = await fetchJson<{
          results: any[];
          page?: number;
          total_pages?: number;
        }>(`${endpoint}?page=${page}`);

        const next = shuffleArray(data.results || []).map((item) =>
          mediaType ? { ...item, media_type: mediaType } : item
        );

        setItems((prev) => (mode === "append" ? [...prev, ...next] : next));

        const currentPage = data.page ?? page;
        const totalPages = data.total_pages ?? currentPage;
        setHasMore(currentPage < totalPages);
      } catch (e) {
        if (page === 1) setItems([]);
        setHasMore(false);
        setError(e instanceof Error ? e.message : "Failed to load content");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    load(page === 1 ? "replace" : "append");
  }, [endpoint, page, mediaType]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-6">
      <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white">{title}</h1>
          {description ? <p className="text-sm text-white/40 mt-2">{description}</p> : null}
        </div>

        {error && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/80 mb-10">
            <div className="text-sm font-semibold text-white mb-1">Couldn&apos;t load content</div>
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

