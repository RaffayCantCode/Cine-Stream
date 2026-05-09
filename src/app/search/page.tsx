"use client";

import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { MediaCard } from "@/components/MediaCard";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { useDebounce } from "@/hooks/useDebounce";
import { Search as SearchIcon, MonitorPlay } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";
import { motion } from "framer-motion";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type: "movie" | "tv";
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  adult?: boolean;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [animeResults, setAnimeResults] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "movies" | "tv" | "anime">("all");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.length < 2) {
        setResults([]);
        setAnimeResults([]);
        setError(null);
        return;
      }

      // Search TMDB
      setIsLoading(true);
      setAnimeLoading(true);
      setError(null);

      // Run both searches in parallel
      const [tmdbResult, animeResult] = await Promise.allSettled([
        fetchJson<{ results: MediaItem[] }>(
          `/api/tmdb/search?query=${encodeURIComponent(debouncedQuery)}`
        ),
        fetchJson<{ success: boolean; data: { animes: AnimeItem[] } }>(
          `/api/anime/search?q=${encodeURIComponent(debouncedQuery)}`
        ),
      ]);

      // Handle TMDB results
      if (tmdbResult.status === "fulfilled") {
        const filtered = filterReleasedSafeContent(tmdbResult.value.results
          ?.filter((r) => (r.media_type === "movie" || r.media_type === "tv"))
          || []);
        setResults(filtered);
      } else {
        setResults([]);
        setError("Search failed");
      }
      setIsLoading(false);

      // Handle Anime results
      if (animeResult.status === "fulfilled" && animeResult.value.success) {
        setAnimeResults(animeResult.value.data?.animes || []);
      } else {
        setAnimeResults([]);
      }
      setAnimeLoading(false);
    };

    search();
  }, [debouncedQuery]);

  const filteredResults = activeTab === "movies"
    ? results.filter((r) => r.media_type === "movie")
    : activeTab === "tv"
    ? results.filter((r) => r.media_type === "tv")
    : results;

  const totalCount = filteredResults.length + (activeTab === "all" || activeTab === "anime" ? animeResults.length : 0);
  const hasAnime = animeResults.length > 0;
  const hasResults = filteredResults.length > 0 || hasAnime;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navigation />

      <div className="pt-32 px-6 md:px-12 max-w-screen-2xl mx-auto">
        <div className="relative max-w-3xl mx-auto mb-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <Input
            ref={inputRef}
            type="text"
            className="w-full h-16 pl-12 pr-4 bg-secondary/50 border-secondary/50 text-xl rounded-2xl focus-visible:ring-primary focus-visible:ring-offset-0 text-white placeholder:text-muted-foreground/70"
            placeholder="Search movies, TV shows & anime..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {debouncedQuery.length >= 2 && (
          <div className="flex items-center gap-2 mb-8 max-w-3xl mx-auto flex-wrap">
            {(["all", "movies", "tv", "anime"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${
                  activeTab === tab
                    ? tab === "anime"
                      ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                      : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-white/[0.05] text-white/50 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                {tab === "all" && "🎬 All"}
                {tab === "movies" && "🎥 Movies"}
                {tab === "tv" && "📺 TV Shows"}
                {tab === "anime" && "🇯🇵 Anime (JP)"}
              </button>
            ))}
            {!isLoading && !animeLoading && totalCount > 0 && (
              <span className="ml-auto text-xs text-white/30 font-medium">
                {totalCount} result{totalCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {debouncedQuery.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <MonitorPlay className="w-16 h-16 mb-4 opacity-20" />
            <h3 className="text-xl font-medium text-white mb-2">Find something to watch</h3>
            <p>Search movies, TV shows, and <span className="text-violet-400 font-semibold">anime (🇯🇵 Japanese dub)</span> all in one place.</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <h3 className="text-xl font-medium text-white mb-2">Search is unavailable</h3>
            <p className="max-w-xl break-words">{error}</p>
          </div>
        ) : isLoading || animeLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : hasResults ? (
          <div className="space-y-10">
            {/* Anime Results — shown first with special section header */}
            {(activeTab === "all" || activeTab === "anime") && animeResults.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-5 bg-violet-500 rounded-full" />
                  <h2 className="text-lg font-bold text-white">Anime Results</h2>
                  <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    🇯🇵 Japanese Dub · English Subs
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {animeResults.map((item, i) => (
                    <div key={item.id} className="w-full h-full flex justify-center">
                      <AnimeCard item={item} index={i} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TMDB Results */}
            {activeTab !== "anime" && filteredResults.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {activeTab === "all" && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-5 bg-primary rounded-full" />
                    <h2 className="text-lg font-bold text-white">Movies & TV Shows</h2>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {filteredResults.map((item) => (
                    <div key={`${item.media_type}-${item.id}`} className="w-full h-full flex justify-center">
                      <MediaCard item={item} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <h3 className="text-xl font-medium text-white mb-2">No results found</h3>
            <p>We couldn&apos;t find anything matching &quot;{debouncedQuery}&quot;. Try another search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}
