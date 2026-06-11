"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { fetchJson } from "@/lib/utils";
import { getProviderBySlug, PROVIDERS } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";
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

export default function ProviderPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";
  const provider = getProviderBySlug(slug);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  }, [slug]);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const pages = [page];
        const [movieResults, tvResults] = await Promise.all([
          Promise.all(
            pages.map((p) =>
              fetchJson<{ results: MediaItem[]; page?: number; total_pages?: number }>(
                `/api/tmdb/discover/movies?withProviders=${provider.id}&watchRegion=${provider.region}&sortBy=popularity.desc&page=${p}`,
                { cacheTtlMs: 120000 }
              )
            )
          ),
          Promise.all(
            pages.map((p) =>
              fetchJson<{ results: MediaItem[]; page?: number; total_pages?: number }>(
                `/api/tmdb/discover/tv?withProviders=${provider.id}&watchRegion=${provider.region}&sortBy=popularity.desc&page=${p}`,
                { cacheTtlMs: 120000 }
              )
            )
          ),
        ]);

        if (cancelled) return;

        const movies = movieResults
          .flatMap((r) => r.results || [])
          .map((item) => ({ ...item, media_type: "movie" as const }));
        const tvs = tvResults
          .flatMap((r) => r.results || [])
          .map((item) => ({ ...item, media_type: "tv" as const }));

        const seen = new Set<string>();
        const unique = [...movies, ...tvs].filter((item) => {
          if (!item.id || !item.poster_path) return false;
          const key = `${item.media_type}-${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setItems((prev) => (page === 1 ? unique : [...prev, ...unique]));

        const movieLast = movieResults[movieResults.length - 1];
        const tvLast = tvResults[tvResults.length - 1];
        const movieTotal = movieLast?.total_pages ?? 1;
        const tvTotal = tvLast?.total_pages ?? 1;
        const lastPage = pages[pages.length - 1];
        setHasMore(lastPage < Math.max(movieTotal, tvTotal));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [slug, page, provider]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (isLoadingRef.current || !hasMoreRef.current) return;
        setPage((p) => p + 1);
      },
      { rootMargin: "0px 0px 1500px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoading, hasMore, items.length]);

  if (!provider) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
          <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
            <div className="mb-8 flex items-center gap-4">
              <Link href="/" className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white transition-all">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-4xl font-bold text-white">Unknown Service</h1>
                <p className="text-sm text-white/40 mt-2">We don&apos;t recognize that streaming service.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {PROVIDERS.map((p) => (
                <Link
                  key={p.slug}
                  href={`/browse/provider/${p.slug}`}
                  className="group relative overflow-hidden rounded-xl border border-white/10 p-4 transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, ${p.color}25 0%, ${p.color}10 100%)`,
                  }}
                >
                  <span className="text-sm font-bold text-white">{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="mb-10 flex items-center gap-4">
            <Link href="/" className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg"
              style={{ background: provider.color, color: provider.textColor, boxShadow: `0 8px 24px ${provider.color}40` }}
            >
              <ProviderIcon slug={provider.slug} className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] text-[#7288AE]/50 font-semibold tracking-[0.15em] uppercase mb-1">Streaming on</p>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">{provider.name}</h1>
              <p className="text-sm text-white/40 mt-2">Movies &amp; TV shows streaming on {provider.name}.</p>
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

          {items.length > 0 && (
            <div ref={sentinelRef} style={{ overflowAnchor: "none" }} className="w-full py-12 flex flex-col items-center justify-center text-white/40">
              {isLoading ? (
                <span className="text-sm font-medium text-white/50">Loading more...</span>
              ) : hasMore ? (
                <span className="text-xs">Scroll for more</span>
              ) : (
                <span className="text-xs text-white/20">No more results</span>
              )}
            </div>
          )}

          {!isLoading && items.length === 0 && !error && (
            <div className="p-10 text-center text-white/30 text-sm">
              No titles found streaming on {provider.name} right now.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
