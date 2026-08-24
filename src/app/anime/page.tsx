"use client";
export const runtime = 'edge';

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Shuffle, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
const ContinueWatching = dynamic(() => import("@/components/ContinueWatching").then(m => m.ContinueWatching), { ssr: false });
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { fetchJson, shuffleArray } from "@/lib/utils";
import { fetchClientAnime } from "@/lib/anilist-client";
import { usePageContentReady } from "@/lib/pageLoad";

type AnimeSort = "popular" | "ongoing" | "recent" | "subbed" | "movie" | "search";

const ANIME_GENRES = ["Action", "Adventure", "Fantasy", "Romance", "Sci-Fi", "Comedy", "Drama", "Sports", "Horror", "Slice of Life"];

const SORT_TO_CATEGORY: Record<string, string> = {
  popular: "popular",
  ongoing: "airing",
  recent: "trending",
  subbed: "popular",
  movie: "search&q=movie",
};

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AnimeBrowsePage() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [sortBy, setSortBy] = useState<AnimeSort>("popular");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number | null>(null);
  usePageContentReady(!isLoading);

  // Set session-stable starting page client-side on mount
  useEffect(() => {
    try {
      let s = sessionStorage.getItem("sv_anime_browse_page");
      if (!s) {
        s = String(Math.floor(Math.random() * 50) + 1);
        sessionStorage.setItem("sv_anime_browse_page", s);
      }
      setPage(parseInt(s, 10) || 1);
    } catch {
      setPage(1);
    }
  }, []);
  const [hasMore, setHasMore] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastFetchedUrlRef = useRef("");
  const triggerLoadRef = useRef<(() => void) | null>(null);

  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;

  const handleShuffleAnime = async () => {
    if (debouncedQuery.trim()) return;
    setIsLoading(true);
    const rng = Math.floor(Math.random() * 50) + 1;
    try {
      const category = getCategory();
      let parsedCategory = category;
      let q = "";
      if (category.startsWith("search&q=")) {
        parsedCategory = "search";
        q = decodeURIComponent(category.substring("search&q=".length));
      }
      
      const res = await fetchClientAnime(parsedCategory, rng, selectedGenre || "", q);
      const merged = res.items || [];
      const seen = new Set<string>();
      const filtered = merged.filter((x: AnimeItem) => {
        if (!x.id || seen.has(x.id)) return false;
        seen.add(x.id);
        if (selectedGenre && x.genres) {
          if (!x.genres.some(g => g.toLowerCase() === selectedGenre.toLowerCase())) return false;
        }
        if (sortBy === "movie") return x.type?.toLowerCase().includes("movie");
        return true;
      });
      setItems(shuffleArray(filtered));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to shuffle");
    } finally {
      setIsLoading(false);
    }
  };

  const getCategory = useCallback((): string => {
    if (debouncedQuery.trim() || sortBy === "search") return `search&q=${encodeURIComponent(debouncedQuery)}`;
    return SORT_TO_CATEGORY[sortBy] || "popular";
  }, [sortBy, debouncedQuery]);

  const loadAnime = useCallback(async (loadPage: number, replace: boolean) => {
    setIsLoading(true);
    setError(null);

    const category = getCategory();
    let parsedCategory = category;
    let q = "";
    if (category.startsWith("search&q=")) {
      parsedCategory = "search";
      q = decodeURIComponent(category.substring("search&q=".length));
    }
    const fetchUrl = `/api/anime?category=${category}&page=${loadPage}&genre=${selectedGenre || ""}`;
    lastFetchedUrlRef.current = fetchUrl;

    try {
      const res = await fetchClientAnime(parsedCategory, loadPage, selectedGenre || "", q);

      if (lastFetchedUrlRef.current !== fetchUrl) {
        return;
      }

      const merged = res.items || [];

      const seen = new Set<string>();
      const filtered = merged.filter((x: AnimeItem) => {
        if (!x.id || seen.has(x.id)) return false;
        seen.add(x.id);
        if (selectedGenre && x.genres) {
          if (!x.genres.some(g => g.toLowerCase() === selectedGenre.toLowerCase())) return false;
        }
        if (sortBy === "movie") return x.type?.toLowerCase().includes("movie");
        return true;
      });

      setItems(prev => {
        let combined = replace ? shuffleArray(filtered) : [...prev, ...filtered];
        const seenSet = new Set();
        return combined.filter(item => {
          if (!item || !item.id) return false;
          if (seenSet.has(item.id)) return false;
          seenSet.add(item.id);
          return true;
        });
      });
      setHasMore(res.hasMore !== false);
    } catch (e) {
      if (lastFetchedUrlRef.current !== fetchUrl) return;
      setError(e instanceof Error ? e.message : "Failed to load anime");
      if (replace) setItems([]);
      setHasMore(false);
    } finally {
      if (lastFetchedUrlRef.current === fetchUrl) {
        setIsLoading(false);
        initialLoad.current = false;
      }
    }
  }, [getCategory, selectedGenre, sortBy]);

  // Trigger loading state and clear items immediately on typing
  useEffect(() => {
    if (query.trim()) {
      setIsLoading(true);
      setItems([]);
    }
  }, [query]);

  // Auto-switch to search mode when user types, and restore popular when cleared
  useEffect(() => {
    if (initialLoad.current) return;
    if (debouncedQuery.trim()) {
      setSortBy("search");
      setSelectedGenre(null);
    } else if (sortBy === "search") {
      setSortBy("popular");
    }
  }, [debouncedQuery, sortBy]);

  // Initial load and reload on page change
  useEffect(() => {
    if (page === null) return;
    const mode = initialLoad.current;
    loadAnime(page, mode);
  }, [page, loadKey]);

  // Reset on sort/genre/query change
  useEffect(() => {
    if (initialLoad.current) return;
    setItems([]);
    setHasMore(true);
    setPage(1);
    setLoadKey(k => k + 1);
  }, [sortBy, selectedGenre, debouncedQuery]);

  // ── Scroll-to-load-more: Intersection Observer ──
  useEffect(() => {
    const check = () => {
      if (isLoadingRef.current || !hasMoreRef.current) return;
      setPage(p => (p !== null ? p + 1 : null));
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
        <ContinueWatching filterType="anime" />
        <div className="px-5 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">Anime</h1>
              <p className="text-sm text-purple-300/80 font-medium mt-2">Japanese audio with English subtitles.</p>
              <p className="text-xs text-amber-400/80 mt-1 max-w-lg">Warning: Not all anime will stream or display properly.</p>
            </div>
            {!debouncedQuery.trim() && (
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as AnimeSort); setQuery(""); }}
                  className="h-10 px-3 rounded-xl bg-[#1b152b] border border-purple-500/30 text-white text-sm font-bold appearance-none cursor-pointer hover:border-purple-500/60 transition-colors outline-none shadow-md shadow-purple-950/20"
                  aria-label="Sort by"
                  style={{ colorScheme: "dark", backgroundColor: "#1b152b", backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a855f7' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
                >
                  <option value="popular" className="bg-[#1b152b] text-white">Popular</option>
                  <option value="ongoing" className="bg-[#1b152b] text-white">Ongoing</option>
                  <option value="recent" className="bg-[#1b152b] text-white">Trending</option>
                  <option value="subbed" className="bg-[#1b152b] text-white">Subbed</option>
                  <option value="movie" className="bg-[#1b152b] text-white">Movies</option>
                </select>
                <button
                  type="button"
                  onClick={handleShuffleAnime}
                  className="h-10 px-4 rounded-xl bg-[#1b152b] border border-purple-500/30 text-purple-200 text-sm font-bold hover:border-purple-500/60 hover:text-white transition flex items-center gap-2 shadow-md shadow-purple-950/20"
                >
                  <Shuffle className="w-4 h-4 text-purple-400" /> Shuffle
                </button>
              </div>
            )}
          </div>

          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.05] border border-purple-500/20 text-white text-sm outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {!debouncedQuery.trim() && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedGenre(null)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${!selectedGenre ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/30" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"}`}
              >
                All
              </button>
              {ANIME_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => { setSelectedGenre(genre === selectedGenre ? null : genre); setQuery(""); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${genre === selectedGenre ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/30" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"}`}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}

          {debouncedQuery.trim() && !isLoading && items.length === 0 && (
            <div className="p-10 text-center text-white/30 text-sm">
              No anime found for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}

          {error && <div className="mb-6 text-sm text-[#7288AE]">{error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
            {isLoading && items.length === 0 && Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
            {items.map((item, i) => (
              <div key={`${item.id}-${i}`} className="w-full h-full flex justify-center">
                <AnimeCard item={item} index={i} />
              </div>
            ))}
          </div>

          <div
            ref={sentinelRef}
            className="w-full py-12 flex flex-col items-center justify-center gap-3 text-white/40"
          >
            {isLoading && items.length > 0 ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#7288AE]" />
                <span className="text-sm font-medium text-white/50">Loading more...</span>
              </div>
            ) : items.length > 0 && hasMore ? (
              <button onClick={() => triggerLoadRef.current?.()} className="text-sm font-semibold hover:text-white transition-colors py-2 px-6 bg-white/5 hover:bg-white/10 rounded-full cursor-pointer">Load More</button>
            ) : items.length > 0 && !hasMore ? (
              <span className="text-xs text-white/20">No more results</span>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
