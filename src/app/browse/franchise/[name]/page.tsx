"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { fetchJson } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

export default function FranchisePage() {
  const params = useParams();
  const name = (params?.name as string) || "";
  const decodedName = decodeURIComponent(name);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  }, [name]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const pages = page === 1 ? [1, 2, 3] : [page, page + 1, page + 2];
        const allResults = await Promise.all(
          pages.map((p) =>
            fetchJson<{ results: MediaItem[]; total_pages?: number }>(
              `/api/tmdb/search?query=${encodeURIComponent(decodedName)}&type=multi&page=${p}`,
              { cacheTtlMs: 60000 }
            )
          )
        );
        const merged = allResults.flatMap((r) => r.results || []);
        const seen = new Set<number>();
        const unique = merged.filter((item) => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return item.poster_path && (item.media_type === "movie" || item.media_type === "tv");
        });
        setItems((prev) => (page === 1 ? unique : [...prev, ...unique]));
        const last = allResults[allResults.length - 1];
        setHasMore(last ? (last.total_pages ?? 1) > pages[pages.length - 1] : false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [name, page, decodedName]);

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
          <div className="mb-8 flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-white">{decodedName}</h1>
              <p className="text-sm text-white/40 mt-2">Movies &amp; TV shows from this franchise</p>
            </div>
          </div>

          {error && <div className="mb-6 text-sm text-red-300">{error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {items.map((item, idx) => (
              <div key={`${item.media_type}-${item.id}-${idx}`} className="w-full h-full flex justify-center">
                <MediaCard item={{ ...item, media_type: item.media_type || "movie" }} index={idx} />
              </div>
            ))}
            {isLoading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>

          <div ref={sentinelRef} className="h-20 flex items-center justify-center text-white/40 text-sm">
            {isLoading && items.length > 0 ? "Loading more..." : hasMore ? "Scroll for more" : "End of results"}
          </div>
        </div>
      </main>
    </div>
  );
}
