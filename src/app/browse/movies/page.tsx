"use client";

import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/Navigation";
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [page, setPage] = useState(() => Math.floor(Math.random() * 5) + 1);
  const [hasMore, setHasMore] = useState(true);
  const initialLoad = useRef(true);

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
      if (mode === "append") {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedGenre) params.append("genreId", selectedGenre.toString());
        params.append("sortBy", sortBy);
        params.append("page", page.toString());

        const data = await fetchJson<{
          results: Movie[];
          page?: number;
          total_pages?: number;
        }>(`/api/tmdb/discover/movies?${params}`);

        const next = shuffleArray(filterReleasedSafeContent(data.results || []));
        setMovies((prev) => (mode === "append" ? [...prev, ...next] : next));

        const currentPage = data.page ?? page;
        const totalPages = data.total_pages ?? currentPage;
        setHasMore(currentPage < totalPages);
      } catch (error) {
        if (page === 1) setMovies([]);
        setError(error instanceof Error ? error.message : "Failed to fetch movies");
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    const mode = initialLoad.current ? "replace" : page === 1 ? "replace" : "append";
    fetchMovies(mode);
    initialLoad.current = false;
  }, [selectedGenre, sortBy, page]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navigation />

      <div className="pt-32 px-6 md:px-12 max-w-screen-2xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white">Movies</h1>
            <p className="text-sm text-white/40 mt-2">
              Browse by genre, sort, and keep loading until you find something worth watching.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold outline-none"
              aria-label="Sort by"
            >
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Top Rated</option>
              <option value="primary_release_date.desc">Newest</option>
              <option value="revenue.desc">Biggest Box Office</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setMovies((prev) => shuffleArray(prev));
              }}
              className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold hover:bg-white/[0.08] transition"
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
                ? "bg-primary text-white"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
                  ? "bg-primary text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {genre.name}
            </button>
          ))}
        </div>

        {isLoading && movies.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-lg bg-muted/50 animate-pulse" />
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
    </div>
  );
}
