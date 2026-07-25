"use client";
export const runtime = 'edge';

import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { PersonCard } from "@/components/PersonCard";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { useDebounce } from "@/hooks/useDebounce";
import { Search as SearchIcon, MonitorPlay, Sparkles, HelpCircle, Flame, Film, Tv, User } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";
import { fetchClientAnime } from "@/lib/anilist-client";
import { motion } from "framer-motion";
import { useContentMode } from "@/context/ContentModeContext";
import { generateSearchCandidates, editDistance, computeWordOverlap } from "@/lib/fuzzy-search";

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
  const debouncedQuery = useDebounce(query, 350);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [results, setResults] = useState<MediaItem[]>([]);
  const [animeResults, setAnimeResults] = useState<AnimeItem[]>([]);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  
  // Related / Similar title word suggestions (clickable pills, zero media cards, zero gibberish)
  const [relatedSuggestions, setRelatedSuggestions] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mode, setMode } = useContentMode();

  useEffect(() => {
    if (initialMode && ["all", "movies", "tv", "anime", "people"].includes(initialMode)) {
      setMode(initialMode as any);
    }
  }, []);

  const activeTab = mode;

  // Sync URL search params
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

  // Main search effect: ONLY depends on debouncedQuery (decoupled from tab mode changes)
  useEffect(() => {
    let cancelled = false;

    const executeSearch = async () => {
      if (debouncedQuery.length < 2) {
        setResults([]);
        setAnimeResults([]);
        setRelatedSuggestions([]);
        setCorrectedQuery(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch main anime search with fallbacks
        const fetchAnimeWithFallback = async (qTerm: string) => {
          try {
            const res = await fetchJson<{ success: boolean; data?: { animes: AnimeItem[] } }>(
              `/api/anime/search?q=${encodeURIComponent(qTerm)}`
            );
            if (res?.success && res.data?.animes && res.data.animes.length > 0) {
              return res.data.animes;
            }
          } catch {}

          try {
            const clientRes = await fetchClientAnime("search", 1, "", qTerm);
            if (clientRes?.items && clientRes.items.length > 0) {
              return clientRes.items;
            }
          } catch {}

          const cleaned = qTerm.replace(/[-_:'"]/g, " ").replace(/\s+/g, " ").trim();
          if (cleaned && cleaned !== qTerm) {
            try {
              const res2 = await fetchJson<{ success: boolean; data?: { animes: AnimeItem[] } }>(
                `/api/anime/search?q=${encodeURIComponent(cleaned)}`
              );
              if (res2?.success && res2.data?.animes && res2.data.animes.length > 0) {
                return res2.data.animes;
              }
            } catch {}
          }
          return [];
        };

        // 2. Main query search (TMDB + Anime simultaneously)
        const [tmdbRes, animeRes] = await Promise.allSettled([
          fetchJson<{ results: MediaItem[] }>(`/api/tmdb/search?query=${encodeURIComponent(debouncedQuery)}`),
          fetchAnimeWithFallback(debouncedQuery),
        ]);

        if (cancelled) return;

        let mainTmdb: MediaItem[] = [];
        let mainAnime: AnimeItem[] = [];

        if (tmdbRes.status === "fulfilled" && tmdbRes.value?.results) {
          mainTmdb = filterReleasedSafeContent(
            tmdbRes.value.results.filter((r) => r.media_type === "movie" || r.media_type === "tv" || r.media_type === "person"),
            true
          ) as MediaItem[];
        }

        if (animeRes.status === "fulfilled" && Array.isArray(animeRes.value)) {
          mainAnime = animeRes.value;
        }

        // AUTO-CORRECT TYPO FALLBACK: If 0 results found for debouncedQuery (e.g. "naurto" or "hamtlet" or "spidrman")
        let correctedTitle: string | null = null;
        if (mainTmdb.length === 0 && mainAnime.length === 0) {
          const candidates = generateSearchCandidates(debouncedQuery);
          for (const cand of candidates) {
            const [candTmdbRes, candAnimeRes] = await Promise.allSettled([
              fetchJson<{ results: MediaItem[] }>(`/api/tmdb/search?query=${encodeURIComponent(cand)}`),
              fetchAnimeWithFallback(cand),
            ]);

            let cTmdb: MediaItem[] = [];
            let cAnime: AnimeItem[] = [];

            if (candTmdbRes.status === "fulfilled" && candTmdbRes.value?.results) {
              cTmdb = filterReleasedSafeContent(
                candTmdbRes.value.results.filter((r) => r.media_type === "movie" || r.media_type === "tv" || r.media_type === "person"),
                true
              ) as MediaItem[];
            }
            if (candAnimeRes.status === "fulfilled" && Array.isArray(candAnimeRes.value)) {
              cAnime = candAnimeRes.value;
            }

            if (cTmdb.length > 0 || cAnime.length > 0) {
              mainTmdb = cTmdb;
              mainAnime = cAnime;
              correctedTitle = cand.charAt(0).toUpperCase() + cand.slice(1);
              break;
            }
          }
        }

        setResults(mainTmdb);
        setAnimeResults(mainAnime);
        setCorrectedQuery(correctedTitle);

        // 3. Smart Related Word / Title Suggestions (ONLY Real Media Titles, Zero Gibberish)
        const suggestionsSet = new Set<string>();
        const qLower = debouncedQuery.toLowerCase().trim();
        const corrLower = correctedTitle ? correctedTitle.toLowerCase().trim() : "";

        // Top main media items for recommendation fetching
        const topMediaItem = mainTmdb.find((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path);
        const topAnimeItem = mainAnime.find((a: any) => a.poster || a.image);

        const searchPromises: Promise<any>[] = [];

        if (topMediaItem) {
          searchPromises.push(
            fetchJson<{ results: MediaItem[] }>(
              `/api/tmdb/recommendations?mediaId=${topMediaItem.id}&mediaType=${topMediaItem.media_type}`
            ).catch(() => ({ results: [] }))
          );
        }

        if (topAnimeItem) {
          searchPromises.push(
            fetchJson<{ data?: { recommendations: AnimeItem[] } }>(
              `/api/anime/recommendations/${topAnimeItem.id}`
            ).catch(() => ({ data: { recommendations: [] } }))
          );
        }

        // Search candidate queries to get real media titles from API
        const candidates = generateSearchCandidates(debouncedQuery);
        candidates.slice(0, 3).forEach((cand) => {
          if (cand.toLowerCase() !== qLower && cand.toLowerCase() !== corrLower) {
            searchPromises.push(
              fetchJson<{ results: MediaItem[] }>(`/api/tmdb/search?query=${encodeURIComponent(cand)}`).catch(() => ({ results: [] }))
            );
            searchPromises.push(
              fetchAnimeWithFallback(cand).catch(() => [])
            );
          }
        });

        const promiseResults = await Promise.allSettled(searchPromises);

        if (!cancelled) {
          promiseResults.forEach((res) => {
            if (res.status === "fulfilled" && res.value) {
              const val = res.value;
              const extractName = (item: any) => item?.title || item?.name || item?.original_title || item?.original_name;

              if (Array.isArray(val)) {
                val.forEach((item: any) => {
                  const name = extractName(item);
                  if (name && name.toLowerCase() !== qLower && name.toLowerCase() !== corrLower) {
                    suggestionsSet.add(name);
                  }
                });
              } else if (val.results && Array.isArray(val.results)) {
                val.results.forEach((item: any) => {
                  if (item && item.media_type !== "person") {
                    const name = extractName(item);
                    if (name && name.toLowerCase() !== qLower && name.toLowerCase() !== corrLower) {
                      suggestionsSet.add(name);
                    }
                  }
                });
              } else if (val.data?.recommendations && Array.isArray(val.data.recommendations)) {
                val.data.recommendations.forEach((item: any) => {
                  const name = extractName(item);
                  if (name && name.toLowerCase() !== qLower && name.toLowerCase() !== corrLower) {
                    suggestionsSet.add(name);
                  }
                });
              }
            }
          });

          // Filter out any gibberish words and pick top 6-8 real distinct media titles
          const finalSuggestions = Array.from(suggestionsSet)
            .filter((term) => term.trim().length >= 2)
            .slice(0, 8);

          setRelatedSuggestions(finalSuggestions);
        }

      } catch (err) {
        if (!cancelled) setError("Search failed");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    executeSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Purely in-memory tab filtering (instantaneous, 0 latency, 0 aborts)
  const filteredResults = useMemo(() => {
    if (activeTab === "movies") return results.filter((r) => r.media_type === "movie");
    if (activeTab === "tv") return results.filter((r) => r.media_type === "tv");
    if (activeTab === "people") return results.filter((r) => r.media_type === "person");
    if (activeTab === "anime") return [];
    return results;
  }, [results, activeTab]);



  const showAnime = activeTab === "all" || activeTab === "anime";
  const showMedia = activeTab !== "anime";

  const totalMainCount = (showMedia ? filteredResults.length : 0) + (showAnime ? animeResults.length : 0);
  const hasMainResults = totalMainCount > 0;
  const hasRelatedSuggestions = relatedSuggestions.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-10 md:pt-10">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          
          {/* Search Bar Input */}
          <div className="relative max-w-3xl mx-auto mb-10">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <SearchIcon className="h-6 w-6 text-white/30" />
            </div>
            <Input
              ref={inputRef}
              type="text"
              className="w-full h-16 pl-14 pr-4 premium-glass text-xl rounded-2xl focus-visible:ring-[#7288AE] focus-visible:ring-offset-0 text-white placeholder:text-white/30 shadow-xl"
              placeholder="Search movies, TV shows, anime, actors & directors..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Filter Tabs */}
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
              {!isLoading && totalMainCount > 0 && (
                <span className="ml-auto text-xs text-white/30 font-medium">
                  {totalMainCount} result{totalMainCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Initial Clean State */}
          {debouncedQuery.length < 2 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto py-16 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-[#9EB2D1]">
                <SearchIcon className="w-8 h-8 opacity-60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-tight">Explore CineStream</h3>
                <p className="text-xs text-white/40 leading-relaxed">
                  Type a title, actor, or director above to search across Movies, TV Shows, and Anime.
                </p>
              </div>
            </motion.div>
          ) : error ? (
            <div className="premium-glass max-w-lg mx-auto p-8 rounded-2xl text-center">
              <h3 className="text-lg font-bold text-white mb-2">Search unavailable</h3>
              <p className="text-sm text-white/50">{error}</p>
            </div>
          ) : isLoading ? (
            /* Loading Skeletons */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full rounded-2xl bg-muted/40 skeleton-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-12">
              
              {/* Typo Auto-Correct Notification Banner */}
              {correctedQuery && (
                <div className="p-4 rounded-2xl bg-[#4B5694]/15 border border-[#7288AE]/30 flex items-center justify-between backdrop-blur-md mb-6">
                  <p className="text-xs sm:text-sm text-white/80 font-medium">
                    Showing results for <span className="font-bold text-white text-sm sm:text-base underline underline-offset-4 decoration-[#7288AE]">{correctedQuery}</span> (searched for &quot;{debouncedQuery}&quot;)
                  </p>
                </div>
              )}

              {/* Main Search Results */}
              {hasMainResults && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {showMedia && filteredResults.map((item, i) => (
                      <div key={`main-media-${item.id}`} className="w-full h-full flex justify-center">
                        {item.media_type === "person" ? (
                          <PersonCard item={item} />
                        ) : (
                          <MediaCard item={item} index={i} />
                        )}
                      </div>
                    ))}
                    {showAnime && animeResults.map((item, i) => (
                      <div key={`main-anime-${item.id}`} className="w-full h-full flex justify-center">
                        <AnimeCard item={item} index={filteredResults.length + i} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Related & Similar Titles (Clickable Word/Title Pills, Zero Media Cards) */}
              {hasRelatedSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12 pt-8 border-t border-white/10 space-y-5"
                >
                  {/* Section Header */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#4B5694]/20 border border-[#7288AE]/30 text-[#9EB2D1]">
                      <Sparkles className="w-5 h-5 text-[#9EB2D1]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">
                        {!hasMainResults ? "No exact match found — Did you mean?" : "Related & Similar Titles"}
                      </h3>
                      <p className="text-xs text-white/50 mt-0.5">
                        Click any title to search for related media
                      </p>
                    </div>
                  </div>

                  {/* Suggestion Pills / Tag Buttons */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {relatedSuggestions.map((term) => (
                      <button
                        key={term}
                        onClick={() => setQuery(term)}
                        className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-[#7288AE]/30 border border-white/10 hover:border-[#7288AE]/50 text-xs sm:text-sm font-bold text-white/90 hover:text-white transition-all transform active:scale-95 flex items-center gap-2 group shadow-sm backdrop-blur-md touch-manipulation"
                      >
                        <SearchIcon className="w-3.5 h-3.5 text-[#9EB2D1] group-hover:text-white transition-colors" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* No results at all */}
              {!hasMainResults && !hasRelatedSuggestions && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="max-w-md premium-glass p-8 rounded-2xl">
                    <HelpCircle className="w-12 h-12 text-[#9EB2D1] mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-bold text-white mb-2">No results found</h3>
                    <p className="text-sm text-white/40 mb-4">
                      We couldn&apos;t find anything matching &quot;{debouncedQuery}&quot;.
                    </p>
                    <p className="text-xs text-white/30">
                      Try checking the spelling, using fewer keywords, or searching by actor name.
                    </p>
                  </div>
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
