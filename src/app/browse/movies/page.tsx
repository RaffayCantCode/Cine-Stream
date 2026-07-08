"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { MediaCard } from "@/components/MediaCard";
import { Search, Shuffle, Loader2 } from "lucide-react";
import { cn, fetchJson, shuffleArray, filterReleasedSafeContent } from "@/lib/utils";
const ContinueWatching = dynamic(() => import("@/components/ContinueWatching").then(m => m.ContinueWatching), { ssr: false });

interface Genre {
  id: number;
  name: string;
}

interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

export default function BrowseMoviesPage() {
  const [selectedGenre, setSelectedGenre] = useState<number | undefined>(undefined);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [page, setPage] = useState<number | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const initialLoad = useRef(true);
  const nextBatchRef = useRef<number>(2);

  // Set random starting page client-side on mount
  useEffect(() => {
    const randomPage = Math.floor(Math.random() * 100) + 1;
    setPage(randomPage);
    nextBatchRef.current = randomPage + 1;
  }, []);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const triggerLoadRef = useRef<(() => void) | null>(null);

  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleShuffleMovies = async () => {
    if (debouncedSearch.trim()) return;
    setIsLoading(true);
    const rng = Math.floor(Math.random() * 100) + 1;
    try {
      const params = new URLSearchParams();
      if (selectedGenre) params.append("genreId", selectedGenre.toString());
      params.append("sortBy", sortBy);
      params.append("page", rng.toString());
      const data = await fetchJson<{ results: Movie[] }>(`/api/tmdb/discover/movies?${params}`);
      setMovies(shuffleArray(filterReleasedSafeContent(data.results || [])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to shuffle");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchGenres = async () => {
      setError(null);
      try {
        const data = await fetchJson<{ genres: Genre[] }>("/api/tmdb/genres/movies");
        setGenres(data.genres || []);
      } catch (error) {
        setGenres([]);
        setError(error instanceof Error ? error.message : "Failed to fetch genres");
      }
    };

    fetchGenres();
  }, []);

  useEffect(() => {
    if (initialLoad.current) return;
    setMovies([]);
    setHasMore(true);
    nextBatchRef.current = 1;
    setPage(1);
    setLoadKey(k => k + 1);
  }, [selectedGenre, sortBy, debouncedSearch]);

  useEffect(() => {
    if (page === null) return;
    const fetchMovies = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const pagesToFetch = initialLoad.current
          ? [page]
          : [nextBatchRef.current, nextBatchRef.current + 1, nextBatchRef.current + 2];

        const results = await Promise.all(
          pagesToFetch.map(async (p) => {
            if (debouncedSearch.trim()) {
              const params = new URLSearchParams();
              params.append("type", "movie");
              params.append("query", debouncedSearch.trim());
              params.append("page", p.toString());
              return await fetchJson<{
                results: Movie[];
                page?: number;
                total_pages?: number;
              }>(`/api/tmdb/search?${params}`);
            } else {
              const params = new URLSearchParams();
              if (selectedGenre) params.append("genreId", selectedGenre.toString());
              params.append("sortBy", sortBy);
              params.append("page", p.toString());
              return await fetchJson<{
                results: Movie[];
                page?: number;
                total_pages?: number;
              }>(`/api/tmdb/discover/movies?${params}`);
            }
          })
        );

        const allItems = results.flatMap((r) => filterReleasedSafeContent(r.results || [], !!debouncedSearch.trim()));
        setMovies((prev) => {
          const combined = initialLoad.current ? shuffleArray(allItems) : [...prev, ...allItems];
          const seenIds = new Set();
          return combined.filter((item) => {
            if (!item || !item.id) return false;
            const key = `${item.media_type || "movie"}-${item.id}`;
            if (seenIds.has(key)) return false;
            seenIds.add(key);
            return true;
          });
        });

        const last = results[results.length - 1];
        const totalPages = last?.total_pages ?? 1;
        setHasMore(results[0]?.page ? results[0].page < totalPages : true);

        if (!initialLoad.current) {
          nextBatchRef.current += 3;
        } else {
          nextBatchRef.current = page + 1;
        }
      } catch (error) {
        if (page <= 3) setMovies([]);
        setError(error instanceof Error ? error.message : "Failed to fetch movies");
        setHasMore(false);
      } finally {
        setIsLoading(false);
        initialLoad.current = false;
      }
    };

    fetchMovies();
  }, [page, loadKey]);

  // ── Scroll-to-load-more: Intersection Observer ──
  useEffect(() => {
    const check = () => {
      if (isLoadingRef.current || !hasMoreRef.current) return;
      setLoadKey((k) => k + 1);
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
  }, [movies.length]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <ContinueWatching filterType="movie" />
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
            <h1 className="text-4xl font-bold text-white">Movies</h1>
            <p className="text-sm text-white/40 mt-2">
              Browse by genre, sort, and keep scrolling until you find something worth watching.
            </p>
          </div>
          {!debouncedSearch.trim() && (
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 px-3 rounded-xl bg-[#131945] border border-white/20 text-white text-sm font-semibold appearance-none cursor-pointer hover:border-[#7288AE]/50 transition-colors outline-none"
                aria-label="Sort by"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
              >
                <option value="popularity.desc" className="bg-[#131945] text-white">Most Popular</option>
                <option value="vote_average.desc" className="bg-[#131945] text-white">Top Rated</option>
                <option value="primary_release_date.desc" className="bg-[#131945] text-white">Newest</option>
                <option value="revenue.desc" className="bg-[#131945] text-white">Biggest Box Office</option>
              </select>
              <button
                type="button"
                onClick={handleShuffleMovies}
                className="h-10 px-4 rounded-xl bg-[#131945] border border-white/20 text-white/80 text-sm font-semibold hover:border-[#7288AE]/50 hover:text-white transition flex items-center gap-2"
              >
                <Shuffle className="w-4 h-4" /> Shuffle
              </button>
            </div>
          )}
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movies..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm outline-none focus:border-[#7288AE]/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/80 mb-10">
            <div className="text-sm font-semibold text-white mb-1">Couldn&apos;t load movies</div>
            <div className="text-xs text-white/50 break-words">{error}</div>
          </div>
        )}

        {!debouncedSearch.trim() && (
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              onClick={() => setSelectedGenre(undefined)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                selectedGenre === undefined
                  ? "bg-[#4B5694] text-white shadow-lg shadow-[#4B5694]/30"
                  : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
              )}
            >
              All Movies
            </button>
            {genres.map((genre) => (
              <button
                key={genre.id}
                onClick={() => setSelectedGenre(genre.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  selectedGenre === genre.id
                    ? "bg-[#4B5694] text-white shadow-lg shadow-[#4B5694]/30"
                    : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
                )}
              >
                {genre.name}
              </button>
            ))}
          </div>
        )}

        {debouncedSearch.trim() && !isLoading && movies.length === 0 && (
          <div className="p-10 text-center text-white/30 text-sm">
            No movies found for &ldquo;{debouncedSearch}&rdquo;
          </div>
        )}

        {isLoading && movies.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {movies.map((item) => (
              <div key={item.id} className="w-full h-full flex justify-center">
                <MediaCard item={{ ...item, media_type: "movie" }} />
              </div>
            ))}
          </div>
        )}

        <div
          ref={sentinelRef}
          style={{ overflowAnchor: "none" }}
          className="w-full py-16 flex flex-col items-center justify-center gap-3 text-white/40 min-h-[100px]"
        >
          {isLoading && movies.length > 0 ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#7288AE]" />
              <span className="text-sm font-medium text-white/50">Loading more...</span>
            </div>
          ) : movies.length > 0 && !hasMore ? (
            <span className="text-xs text-white/20">No more results</span>
          ) : (
             <div className="h-10 w-full" />
          )}
        </div>
      </div>
      </main>
    </div>
  );
}
