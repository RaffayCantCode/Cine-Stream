"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { fetchJson } from "@/lib/utils";

type AnimeSort = "popular" | "ongoing" | "recent" | "subbed" | "movie" | "search";

const ANIME_GENRES = ["Action", "Adventure", "Fantasy", "Romance", "Sci-Fi", "Comedy", "Drama", "Sports", "Horror", "Slice of Life"];

export default function AnimeBrowsePage() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [sortBy, setSortBy] = useState<AnimeSort>("popular");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(() => Math.floor(Math.random() * 15) + 1);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const initialLoad = useRef(true);

  const loadAnime = async (loadPage: number, mode: "replace" | "append") => {
    if (mode === "replace") setIsLoading(true);
    setError(null);

    try {
      const pages = mode === "append" ? [loadPage, loadPage + 1, loadPage + 2] : [loadPage];

      const results = await Promise.all(
        pages.map(async (p) => {
          const category = query
            ? `search&q=${encodeURIComponent(query)}${selectedGenre ? `&genre=${encodeURIComponent(selectedGenre)}` : ""}`
            : sortBy === "recent"
              ? "latest"
              : sortBy === "subbed" || sortBy === "movie"
                ? `search&q=${encodeURIComponent(sortBy)}`
                : sortBy === "search"
                  ? `search&q=${encodeURIComponent(query)}`
                  : "popular";

          const data = await fetchJson<{
            success: boolean;
            data: {
              latestEpisodeAnimes?: AnimeItem[];
              newReleases?: AnimeItem[];
              spotlightAnimes?: AnimeItem[];
            };
            hasMore?: boolean;
          }>(`/api/anime?category=${category}&page=${p}`, { cacheTtlMs: 120000 });

          return data;
        })
      );

      const merged = results.flatMap((r) => [
        ...(r.data?.spotlightAnimes || []),
        ...(r.data?.latestEpisodeAnimes || []),
        ...(r.data?.newReleases || []),
      ]);

      const seen = new Set<string>();
      const filtered = merged.filter((x: AnimeItem) => {
        const key = x.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        if (sortBy === "subbed") return true;
        if (sortBy === "movie") return x.type?.toLowerCase().includes("movie");
        if (sortBy === "ongoing") return /episode|ep/i.test(x.type || "");
        return true;
      });

      if (selectedGenre) {}

      setItems((prev) => (mode === "replace" ? filtered : [...prev, ...filtered]));

      const last = results[results.length - 1];
      setHasMore(last?.hasMore !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load anime");
      if (mode === "replace") setItems([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialLoad.current) return;
    setItems([]);
    setHasMore(true);
    setPage(1);
  }, [sortBy, selectedGenre]);

  useEffect(() => {
    const mode = initialLoad.current ? "replace" : page <= 3 ? "replace" : "append";
    loadAnime(page, mode);
    initialLoad.current = false;
  }, [sortBy, selectedGenre, page]);

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

  const handleSearch = () => {
    if (query.trim()) {
      setSortBy("search");
      setSelectedGenre(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6">
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
                <option value="recent" className="bg-[#1a1a2e] text-white">Recently Aired</option>
                <option value="subbed" className="bg-[#1a1a2e] text-white">Subbed</option>
                <option value="movie" className="bg-[#1a1a2e] text-white">Movies</option>
              </select>
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
            {isLoading && items.length > 0 ? "Loading more..." : hasMore ? "Scroll for more" : "End of results"}
          </div>
        </div>
      </main>
    </div>
  );
}
