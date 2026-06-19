"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Shuffle, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { fetchJson, shuffleArray } from "@/lib/utils";

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

  // Set random starting page client-side on mount
  useEffect(() => {
    const randomPage = Math.floor(Math.random() * 50) + 1;
    setPage(randomPage);
  }, []);
  const [hasMore, setHasMore] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastFetchedUrlRef = useRef("");

  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;

  const handleShuffleAnime = async () => {
    if (debouncedQuery.trim()) return;
    setIsLoading(true);
    const rng = Math.floor(Math.random() * 50) + 1;
    try {
      const category = getCategory();
      const genreParam = selectedGenre ? `&genre=${encodeURIComponent(selectedGenre)}` : "";
      const res = await fetchJson<{ success: boolean; data: { items: AnimeItem[] } }>(
        `/api/anime?category=${category}&page=${rng}${genreParam}`,
        { cacheTtlMs: 300000 }
      );
      const merged = res.data?.items || [];
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
    const genreParam = selectedGenre ? `&genre=${encodeURIComponent(selectedGenre)}` : "";
    const fetchUrl = `/api/anime?category=${category}&page=${loadPage}${genreParam}`;
    lastFetchedUrlRef.current = fetchUrl;

    try {
      const res = await fetchJson<{ success: boolean; data: { items: AnimeItem[] }; hasMore?: boolean }>(
        fetchUrl,
        { cacheTtlMs: 300000 }
      );

      if (lastFetchedUrlRef.current !== fetchUrl) {
        return;
      }

      const merged = res.data?.items || [];

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
        const seen = new Set();
        return combined.filter(item => {
          if (!item || !item.id) return false;
          if (seen.has(item.id)) return false;
          seen.add(item.id);
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

  // Scroll sentinel
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting || isLoadingRef.current || !hasMoreRef.current) return;
        setPage(p => (p !== null ? p + 1 : null));
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
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white">Anime</h1>
              <p className="text-sm text-white/40 mt-2">Japanese audio with English subtitles.</p>
              <p className="text-xs text-amber-400/70 mt-2 max-w-lg">This section is a work in progress — not all anime stream or display properly, but many do! Give it a try.</p>
            </div>
            {!debouncedQuery.trim() && (
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as AnimeSort); setQuery(""); }}
                  className="h-10 px-3 rounded-xl bg-[#1a1a2e] border border-white/20 text-white text-sm font-semibold appearance-none cursor-pointer hover:border-[#7288AE]/50 transition-colors outline-none"
                  aria-label="Sort by"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
                >
                  <option value="popular" className="bg-[#1a1a2e] text-white">Popular</option>
                  <option value="ongoing" className="bg-[#1a1a2e] text-white">Ongoing</option>
                  <option value="recent" className="bg-[#1a1a2e] text-white">Trending</option>
                  <option value="subbed" className="bg-[#1a1a2e] text-white">Subbed</option>
                  <option value="movie" className="bg-[#1a1a2e] text-white">Movies</option>
                </select>
                <button
                  type="button"
                  onClick={handleShuffleAnime}
                  className="h-10 px-4 rounded-xl bg-[#1a1a2e] border border-white/20 text-white/80 text-sm font-semibold hover:border-[#7288AE]/50 hover:text-white transition flex items-center gap-2"
                >
                  <Shuffle className="w-4 h-4" /> Shuffle
                </button>
              </div>
            )}
          </div>

          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm outline-none focus:border-[#7288AE]/50 transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {!debouncedQuery.trim() && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedGenre(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!selectedGenre ? "bg-[#4B5694] text-white" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09]"}`}
              >
                All
              </button>
              {ANIME_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => { setSelectedGenre(genre === selectedGenre ? null : genre); setQuery(""); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${genre === selectedGenre ? "bg-[#4B5694] text-white" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09]"}`}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {isLoading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => (
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
            style={{ overflowAnchor: "none" }}
            className="w-full py-12 flex flex-col items-center justify-center gap-3 text-white/40"
          >
            {isLoading && items.length > 0 ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#7288AE]" />
                <span className="text-sm font-medium text-white/50">Loading more...</span>
              </div>
            ) : items.length > 0 && hasMore ? (
              <span className="text-xs">Scroll down for more</span>
            ) : items.length > 0 && !hasMore ? (
              <span className="text-xs text-white/20">No more results</span>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
