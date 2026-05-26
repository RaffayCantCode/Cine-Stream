"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { cn, fetchJson, shuffleArray, filterReleasedSafeContent } from "@/lib/utils";

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
  const [page, setPage] = useState(() => Math.floor(Math.random() * 10) * 3 + 1);
  const [hasMore, setHasMore] = useState(true);
  const initialLoad = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
    setPage(1);
  }, [selectedGenre, sortBy]);

  useEffect(() => {
    const fetchMovies = async (mode: "replace" | "append") => {
      if (mode === "replace") setIsLoading(true);
      setError(null);
      try {
        const pagesToFetch = mode === "append" ? [page, page + 1, page + 2] : [page];

        const results = await Promise.all(
          pagesToFetch.map(async (p) => {
            const params = new URLSearchParams();
            if (selectedGenre) params.append("genreId", selectedGenre.toString());
            params.append("sortBy", sortBy);
            params.append("page", p.toString());

            const data = await fetchJson<{
              results: Movie[];
              page?: number;
              total_pages?: number;
            }>(`/api/tmdb/discover/movies?${params}`);

            return data;
          })
        );

        const allItems = results.flatMap((r) => filterReleasedSafeContent(r.results || []));
        const next = shuffleArray(allItems);
        setMovies((prev) => (mode === "append" ? [...prev, ...next] : next));

        const last = results[results.length - 1];
        const totalPages = last?.total_pages ?? 1;
        setHasMore(results[0]?.page ? results[0].page < totalPages : true);
      } catch (error) {
        if (page <= 3) setMovies([]);
        setError(error instanceof Error ? error.message : "Failed to fetch movies");
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };

    const mode = initialLoad.current ? "replace" : page <= 3 ? "replace" : "append";
    fetchMovies(mode);
    initialLoad.current = false;
  }, [selectedGenre, sortBy, page]);

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
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white">Movies</h1>
            <p className="text-sm text-white/40 mt-2">
              Browse by genre, sort, and keep scrolling until you find something worth watching.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[#1a1a2e] border border-white/20 text-white text-sm font-semibold appearance-none cursor-pointer hover:border-[#D552A3]/50 transition-colors outline-none"
              aria-label="Sort by"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
            >
              <option value="popularity.desc" className="bg-[#1a1a2e] text-white">Most Popular</option>
              <option value="vote_average.desc" className="bg-[#1a1a2e] text-white">Top Rated</option>
              <option value="primary_release_date.desc" className="bg-[#1a1a2e] text-white">Newest</option>
              <option value="revenue.desc" className="bg-[#1a1a2e] text-white">Biggest Box Office</option>
            </select>
            <button
              type="button"
              onClick={() => setMovies((prev) => shuffleArray(prev))}
              className="h-10 px-4 rounded-xl bg-[#1a1a2e] border border-white/20 text-white/80 text-sm font-semibold hover:border-[#D552A3]/50 hover:text-white transition"
            >
              Shuffle
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/80 mb-10">
            <div className="text-sm font-semibold text-white mb-1">Couldn&apos;t load movies</div>
            <div className="text-xs text-white/50 break-words">{error}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-10">
          <button
            onClick={() => setSelectedGenre(undefined)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              selectedGenre === undefined
                ? "bg-[#831C91] text-white shadow-lg shadow-[#831C91]/30"
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
                  ? "bg-[#831C91] text-white shadow-lg shadow-[#831C91]/30"
                  : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
              )}
            >
              {genre.name}
            </button>
          ))}
        </div>

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

        <div ref={sentinelRef} className="h-20 flex items-center justify-center text-white/40 text-sm">
          {isLoading && movies.length > 0 ? "Loading more..." : hasMore ? "Scroll for more" : "End of results"}
        </div>
      </div>
      </main>
    </div>
  );
}
