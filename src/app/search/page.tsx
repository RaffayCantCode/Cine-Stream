"use client";
export const runtime = 'edge';

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { PersonCard } from "@/components/PersonCard";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { useDebounce } from "@/hooks/useDebounce";
import { Search as SearchIcon, MonitorPlay, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";
import { motion } from "framer-motion";
import { useContentMode } from "@/context/ContentModeContext";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type: "movie" | "tv" | "person";
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  adult?: boolean;
  profile_path?: string;
  known_for_department?: string;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialMode = searchParams.get("mode") || "";

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [animeResults, setAnimeResults] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [animeLoading, setAnimeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const { mode, setMode } = useContentMode();

  useEffect(() => {
    if (initialMode && ["all", "movies", "tv", "anime", "people"].includes(initialMode)) {
      setMode(initialMode as any);
    }
  }, []);

  const activeTab = mode;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (mode !== "all") params.set("mode", mode);

      const searchString = params.toString() ? `?${params.toString()}` : '';
      router.replace(`/search${searchString}`, { scroll: false });
    }
  }, [query, mode, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const search = async () => {
      if (debouncedQuery.length < 2) {
        setResults([]);
        setAnimeResults([]);
        setError(null);
        setDidYouMean(null);
        return;
      }

      setIsLoading(true);
      setAnimeLoading(true);
      setError(null);
      setDidYouMean(null);

      const fetchTmdb = mode === "all" || mode === "movies" || mode === "tv" || mode === "people";
      const fetchAnime = mode === "all" || mode === "anime";

      try {
        const [tmdbResult, animeResult] = await Promise.allSettled([
          fetchTmdb
            ? fetchJson<{ results: MediaItem[]; did_you_mean?: string }>(`/api/tmdb/search?query=${encodeURIComponent(debouncedQuery)}`, { signal })
            : Promise.resolve({ results: [], did_you_mean: null }),
          fetchAnime
            ? fetchJson<{ success: boolean; data: { animes: AnimeItem[] }; did_you_mean?: string }>(`/api/anime/search?q=${encodeURIComponent(debouncedQuery)}`, { signal })
            : Promise.resolve({ success: true, data: { animes: [] }, did_you_mean: null }),
        ]);

        if (signal.aborted) return;

        let tmdbDidYouMean: string | null = null;

        if (tmdbResult.status === "fulfilled") {
          const value = tmdbResult.value as any;
          tmdbDidYouMean = value.did_you_mean || null;
          const filtered = filterReleasedSafeContent((value.results || [])
            .filter((r: any) => (r.media_type === "movie" || r.media_type === "tv" || r.media_type === "person"))
            , true) as MediaItem[];
          setResults(filtered);
        } else {
          setResults([]);
        }
        setIsLoading(false);

        let animeDidYouMean: string | null = null;
        if (animeResult.status === "fulfilled") {
          const value = animeResult.value as any;
          if (value.success) {
            animeDidYouMean = value.did_you_mean || null;
            setAnimeResults(value.data?.animes || []);
          } else {
            setAnimeResults([]);
          }
        } else {
          setAnimeResults([]);
        }
        setAnimeLoading(false);

        if (tmdbResult.status !== "fulfilled" && animeResult.status !== "fulfilled") {
          setError("Search failed");
        } else {
          setError(null);
        }

        const totalResults = results.length + animeResults.length;
        if (totalResults < 3) {
          setDidYouMean(tmdbDidYouMean || animeDidYouMean || null);
        } else {
          setDidYouMean(null);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    };

    search();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, mode]);

  const filteredResults = activeTab === "movies"
    ? results.filter((r) => r.media_type === "movie")
    : activeTab === "tv"
    ? results.filter((r) => r.media_type === "tv")
    : activeTab === "people"
    ? results.filter((r) => r.media_type === "person")
    : activeTab === "anime"
    ? []
    : results;

  const unifiedResults = activeTab === "all"
    ? [
        ...results.filter((r) => r.media_type === "movie").map((r, i) => ({ type: "media" as const, item: r, idx: i })),
        ...results.filter((r) => r.media_type === "tv").map((r, i) => ({ type: "media" as const, item: r, idx: results.filter((m) => m.media_type === "movie").length + i })),
        ...results.filter((r) => r.media_type === "person").map((r, i) => ({ type: "media" as const, item: r, idx: results.filter((m) => m.media_type === "movie" || m.media_type === "tv").length + i })),
        ...animeResults.map((a, i) => ({ type: "anime" as const, item: a, idx: results.length + i })),
      ]
    : [];

  const totalCount = filteredResults.length + (activeTab === "all" || activeTab === "anime" ? animeResults.length : 0);
  const hasAnime = animeResults.length > 0;
  const hasResults = filteredResults.length > 0 || hasAnime;

  const handleDidYouMeanClick = (suggestion: string) => {
    setQuery(suggestion);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-10 md:pt-10">
      <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
        <div className="relative max-w-3xl mx-auto mb-12">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <SearchIcon className="h-6 w-6 text-white/30" />
          </div>
          <Input
            ref={inputRef}
            type="text"
            className="w-full h-16 pl-14 pr-4 premium-glass text-xl rounded-2xl focus-visible:ring-[#7288AE] focus-visible:ring-offset-0 text-white placeholder:text-white/30"
            placeholder="Search movies, TV shows, anime, actors & directors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {debouncedQuery.length >= 2 && (
          <div className="flex items-center gap-2 mb-8 max-w-3xl mx-auto flex-wrap">
            {(["all", "movies", "tv", "anime", "people"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMode(tab as any)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize touch-manipulation ${
                  activeTab === tab
                    ? tab === "anime"
                      ? "bg-[#4B5694] text-white shadow-lg shadow-[#4B5694]/20"
                      : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-white/[0.05] text-white/50 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                {tab === "all" && "All"}
                {tab === "movies" && "Movies"}
                {tab === "tv" && "TV Shows"}
                {tab === "anime" && "Anime (JP Dub)"}
                {tab === "people" && "People"}
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
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="premium-glass w-20 h-20 rounded-2xl flex items-center justify-center mb-6">
              <MonitorPlay className="w-10 h-10 text-white/30" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Find something to watch</h3>
            <p className="text-white/40 max-w-md">Search movies, TV shows, <span className="text-[#7288AE] font-semibold">anime</span>, and people all in one place.</p>
          </div>
        ) : error ? (
          <div className="premium-glass max-w-lg mx-auto p-8 rounded-2xl text-center">
            <h3 className="text-lg font-bold text-white mb-2">Search unavailable</h3>
            <p className="text-sm text-white/50">{error}</p>
          </div>
        ) : isLoading || animeLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : hasResults ? (
          <div className="space-y-10">
            {didYouMean && (
              <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3 bg-[#7288AE]/10 border border-[#7288AE]/25 rounded-xl">
                <Sparkles className="w-4 h-4 text-[#9EB2D1] shrink-0" />
                <span className="text-sm text-white/60">Did you mean</span>
                <button
                  onClick={() => handleDidYouMeanClick(didYouMean)}
                  className="text-sm font-semibold text-[#9EB2D1] hover:text-white underline underline-offset-2 transition-colors"
                >
                  &ldquo;{didYouMean}&rdquo;
                </button>
                <span className="text-xs text-white/30 ml-auto">Showing broader results</span>
              </div>
            )}

            {activeTab === "all" ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {unifiedResults.map((r) => (
                    <div key={`${r.type}-${r.type === "media" ? (r.item as MediaItem).id : (r.item as AnimeItem).id}`} className="w-full h-full flex justify-center">
                      {r.type === "media" ? (
                        (r.item as MediaItem).media_type === "person" ? (
                          <PersonCard item={r.item as MediaItem} />
                        ) : (
                          <MediaCard item={r.item as MediaItem} index={r.idx} />
                        )
                      ) : (
                        <AnimeCard item={r.item as AnimeItem} index={r.idx} />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : activeTab === "anime" ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {animeResults.map((item, i) => (
                    <div key={item.id} className="w-full h-full flex justify-center">
                      <AnimeCard item={item} index={i} />
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {filteredResults.map((item) => (
                    <div key={`${item.media_type}-${item.id}`} className="w-full h-full flex justify-center">
                      {item.media_type === "person" ? (
                        <PersonCard item={item} />
                      ) : (
                        <MediaCard item={item} />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {didYouMean ? (
              <div className="max-w-md premium-glass p-8 rounded-2xl">
                <Sparkles className="w-10 h-10 text-[#9EB2D1] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No exact matches</h3>
                <p className="text-sm text-white/50 mb-4">
                  We couldn&apos;t find anything for &ldquo;{debouncedQuery}&rdquo;.
                </p>
                <p className="text-sm text-white/40 mb-3">Did you mean</p>
                <button
                  onClick={() => handleDidYouMeanClick(didYouMean)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7288AE]/20 hover:bg-[#7288AE]/30 border border-[#7288AE]/40 rounded-xl text-sm font-semibold text-[#9EB2D1] hover:text-white transition-all"
                >
                  <SearchIcon className="w-4 h-4" />
                  &ldquo;{didYouMean}&rdquo;
                </button>
              </div>
            ) : (
              <div className="max-w-md">
                <h3 className="text-xl font-medium text-white mb-2">No results found</h3>
                <p className="text-sm text-white/40">
                  We couldn&apos;t find anything matching &quot;{debouncedQuery}&quot;.
                </p>
                <p className="text-xs text-white/30 mt-3">
                  Try checking the spelling, using fewer words, or a different search term.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground pb-20">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64 pt-10 md:pt-10 flex justify-center items-center h-[50vh]">
          <div className="w-10 h-10 border-3 border-white/10 border-t-[#7288AE] rounded-full animate-spin" />
        </main>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
