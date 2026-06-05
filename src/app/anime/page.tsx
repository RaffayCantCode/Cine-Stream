"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Shuffle } from "lucide-react";
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

export default function AnimeBrowsePage() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [sortBy, setSortBy] = useState<AnimeSort>("popular");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);

  const handleShuffleAnime = async () => {
    setIsLoading(true);
    const rng = Math.floor(Math.random() * 50) + 1;
    try {
      const category = getCategory();
      const genreParam = selectedGenre ? `&genre=${encodeURIComponent(selectedGenre)}` : "";
      const res = await fetchJson<{ success: boolean; data: { items: AnimeItem[] } }>(
        `/api/anime?category=${category}&page=${rng}${genreParam}`,
        { cacheTtlMs: 60000 }
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
    if (query.trim() || sortBy === "search") return `search&q=${encodeURIComponent(query)}`;
    return SORT_TO_CATEGORY[sortBy] || "popular";
  }, [sortBy, query]);

  const loadAnime = useCallback(async (loadPage: number, replace: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      const category = getCategory();
      const genreParam = selectedGenre ? `&genre=${encodeURIComponent(selectedGenre)}` : "";

      const res = await fetchJson<{ success: boolean; data: { items: AnimeItem[] }; hasMore?: boolean }>(
        `/api/anime?category=${category}&page=${loadPage}${genreParam}`,
        { cacheTtlMs: 60000 }
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

      setItems(prev => replace ? filtered : [...prev, ...filtered]);
      setHasMore(res.hasMore !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load anime");
      if (replace) setItems([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [getCategory, selectedGenre, sortBy]);

  // Initial load and reload on page change
  useEffect(() => {
    const mode = initialLoad.current;
    initialLoad.current = false;
    loadAnime(page, mode);
  }, [page, loadKey]);

  // Reset on sort/genre/query change
  useEffect(() => {
    setItems([]);
    setHasMore(true);
    setPage(1);
    setLoadKey(k => k + 1);
  }, [sortBy, selectedGenre]);

  // Scroll sentinel
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting || isLoading || !hasMore) return;
        setPage(p => p + 1);
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isLoading, hasMore]);

  const handleSearch = () => {
    if (query.trim()) {
      setSortBy("search");
      setSelectedGenre(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white">Anime</h1>
              <p className="text-sm text-white/40 mt-2">Japanese audio with English subtitles.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={query ? "search" : sortBy}
                onChange={(e) => { setSortBy(e.target.value as AnimeSort); setQuery(""); }}
                className="h-10 px-3 rounded-xl bg-[#1a1a2e] border border-white/20 text-white text-sm font-semibold appearance-none cursor-pointer hover:border-[#D552A3]/50 transition-colors outline-none"
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
                className="h-10 px-4 rounded-xl bg-[#1a1a2e] border border-white/20 text-white/80 text-sm font-semibold hover:border-[#D552A3]/50 hover:text-white transition flex items-center gap-2"
              >
                <Shuffle className="w-4 h-4" /> Shuffle
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedGenre(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!selectedGenre ? "bg-[#831C91] text-white" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09]"}`}
            >
              All
            </button>
            {ANIME_GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => { setSelectedGenre(genre === selectedGenre ? null : genre); setQuery(""); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${genre === selectedGenre ? "bg-[#831C91] text-white" : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09]"}`}
              >
                {genre}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-8">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Search anime..."
              className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm flex-1 max-w-xs"
            />
            <button onClick={handleSearch} className="h-10 px-4 rounded-xl bg-[#831C91] text-white text-sm font-semibold">Search</button>
          </div>

          {error && <div className="mb-6 text-sm text-[#D552A3]">{error}</div>}

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

          <div ref={sentinelRef} className="h-20 flex items-center justify-center text-white/40 text-sm">
            {isLoading && items.length > 0 ? "Loading more..." : hasMore ? "Scroll for more" : items.length > 0 ? "End of results" : ""}
          </div>
        </div>
      </main>
    </div>
  );
}
