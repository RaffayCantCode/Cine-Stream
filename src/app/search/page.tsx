"use client";
export const runtime = 'edge';

import { useState, useRef, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { PersonCard } from "@/components/PersonCard";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { useDebounce } from "@/hooks/useDebounce";
import { Search as SearchIcon, Sparkles, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { fetchJson, filterReleasedSafeContent, filterExcludeAnime } from "@/lib/utils";
import { motion } from "framer-motion";
import { useContentMode } from "@/context/ContentModeContext";
import { generateSearchCandidates } from "@/lib/fuzzy-search";

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
  original_language?: string;
  genre_ids?: number[];
}

function transformClientAniListMedia(media: any): AnimeItem {
  let status = media.status || null;
  if (media.nextAiringEpisode && (status === "NOT_YET_RELEASED" || status === "NOT_YET_AIRED")) {
    status = "RELEASING";
  }
  return {
    id: String(media.id),
    idMal: media.idMal ? String(media.idMal) : null,
    name: media.title?.english || media.title?.romaji || media.title?.native || "Unknown",
    jname: media.title?.native || null,
    poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
    type: media.type || "TV",
    episodes: { sub: media.episodes || null, dub: null },
    rating: media.averageScore ? String((media.averageScore / 10).toFixed(1)) : null,
    description: media.description?.replace(/<[^>]*>/g, "") || "",
    genres: media.genres || [],
    status,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    format: media.format || null,
  };
}

async function directClientAniListSearch(queryTerm: string): Promise<AnimeItem[]> {
  try {
    const query = `query ($q: String) {
      Page(page: 1, perPage: 40) {
        media(type: ANIME, isAdult: false, search: $q) {
          id idMal isAdult title { romaji english native } coverImage { large extraLarge }
          episodes genres averageScore description status type format season seasonYear nextAiringEpisode { episode }
        }
      }
    }`;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { q: queryTerm } }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const list = data?.data?.Page?.media || [];
      return list.map(transformClientAniListMedia).filter(Boolean);
    }
  } catch {}
  return [];
}

async function directClientJikanSearch(queryTerm: string): Promise<AnimeItem[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(queryTerm)}&limit=25`, {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const list = data?.data || [];
      return list.map((a: any) => ({
        id: String(a.mal_id),
        idMal: String(a.mal_id),
        name: a.title_english || a.title,
        jname: a.title_japanese || null,
        poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
        type: a.type || "TV",
        episodes: { sub: a.episodes || null, dub: null },
        rating: a.score ? String(a.score) : null,
        description: a.synopsis || "",
        genres: a.genres?.map((g: any) => g.name) || [],
        status: a.status || null,
        season: a.season || null,
        seasonYear: a.year || null,
        format: a.type || null,
      }));
    }
  } catch {}
  return [];
}

async function directClientKitsuSearch(queryTerm: string): Promise<AnimeItem[]> {
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(queryTerm)}&page[limit]=25&include=categories`, {
      headers: { "Accept": "application/vnd.api+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const list = data?.data || [];
      const categoriesMap = new Map<string, string>();
      for (const inc of data.included || []) {
        if (inc.type === "categories" && inc.attributes?.title) {
          categoriesMap.set(inc.id, inc.attributes.title);
        }
      }
      return list.map((k: any) => {
        const attr = k.attributes || {};
        const catIds = k.relationships?.categories?.data?.map((c: any) => c.id) || [];
        const genres = catIds.map((cid: string) => categoriesMap.get(cid)).filter(Boolean);
        const subtype = (attr.subtype || "TV").toUpperCase();
        const titleEnglish = attr.titles?.en || null;
        const titleRomaji = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
        let rating: string | null = null;
        if (attr.averageRating) {
          const r = parseFloat(attr.averageRating);
          if (!isNaN(r)) rating = (r / 10).toFixed(1);
        }
        return {
          id: `kitsu-${k.id}`,
          name: titleEnglish || titleRomaji,
          jname: attr.titles?.ja_jp || null,
          poster: attr.posterImage?.large || attr.posterImage?.original || "",
          bannerImage: attr.coverImage?.large || null,
          type: subtype,
          episodes: { sub: attr.episodeCount || null, dub: null },
          rating,
          description: attr.synopsis || attr.description || "",
          genres,
          status: attr.status === "current" ? "RELEASING" : (attr.status === "upcoming" ? "NOT_YET_RELEASED" : "FINISHED"),
          season: null,
          seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : null,
          format: subtype,
          duration: attr.episodeLength || null,
        } as AnimeItem;
      });
    }
  } catch {}
  return [];
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
        // 1. Fetch main anime search with multi-tier fallbacks (Server API -> Direct Browser Client AniList -> Direct Browser Client Jikan)
        const fetchAnimeWithFallback = async (qTerm: string) => {
          // Tier 1: Try server API route first
          try {
            const res = await fetchJson<{ success: boolean; data?: any }>(
              `/api/anime/search?q=${encodeURIComponent(qTerm)}&v=anime-v18-force-cloud-flush`,
              { cacheTtlMs: 0 }
            );
            const list = Array.isArray(res?.data) ? res.data : res?.data?.animes;
            if (res?.success && Array.isArray(list) && list.length > 0) {
              return list;
            }
          } catch {}

          // Tier 2: Direct browser client AniList GraphQL search
          const clientAniListResults = await directClientAniListSearch(qTerm);
          if (clientAniListResults.length > 0) {
            return clientAniListResults;
          }

          // Tier 3: Cleaned punctuation query on direct browser AniList client
          const cleaned = qTerm.replace(/[-_:'"]/g, " ").replace(/\s+/g, " ").trim();
          if (cleaned && cleaned !== qTerm) {
            const cleanedAniListResults = await directClientAniListSearch(cleaned);
            if (cleanedAniListResults.length > 0) {
              return cleanedAniListResults;
            }
          }

          // Tier 4: Direct browser client Jikan search
          const clientJikanResults = await directClientJikanSearch(qTerm);
          if (clientJikanResults.length > 0) {
            return clientJikanResults;
          }

          // Tier 5: Direct browser client Kitsu search (when AniList and Jikan are down)
          const clientKitsuResults = await directClientKitsuSearch(qTerm);
          if (clientKitsuResults.length > 0) {
            return clientKitsuResults;
          }

          return [];
        };

        // 2. Phase 1 — Main query search (TMDB + Anime simultaneously)
        const [tmdbRes, animeRes] = await Promise.allSettled([
          fetchJson<{ results: MediaItem[] }>(`/api/tmdb/search?query=${encodeURIComponent(debouncedQuery)}`, { cacheTtlMs: 0 }),
          fetchAnimeWithFallback(debouncedQuery),
        ]);

        if (cancelled) return;

        let mainTmdb: MediaItem[] = [];
        let mainAnime: AnimeItem[] = [];

        if (tmdbRes.status === "fulfilled" && tmdbRes.value?.results) {
          // Apply filterExcludeAnime as a client-side safety net: ensures that
          // any anime title that slipped through the server filter (e.g. TMDB
          // entries lacking the anime keyword) never appears under Movies or TV.
          // Person results are preserved by filterExcludeAnime's type guard.
          mainTmdb = filterExcludeAnime(
            filterReleasedSafeContent(
              tmdbRes.value.results.filter((r) => r.media_type === "movie" || r.media_type === "tv" || r.media_type === "person"),
              true
            ) as MediaItem[]
          ) as MediaItem[];
        }

        if (animeRes.status === "fulfilled" && Array.isArray(animeRes.value)) {
          mainAnime = animeRes.value;
        }

        // AUTO-CORRECT TYPO FALLBACK: If 0 results found, try all candidates in parallel
        let correctedTitle: string | null = null;
        if (mainTmdb.length === 0 && mainAnime.length === 0) {
          const candidates = generateSearchCandidates(debouncedQuery);
          // Fire all candidates in parallel and pick the first one that returns results
          const candidateResults = await Promise.allSettled(
            candidates.map(async (cand) => {
              const [ct, ca] = await Promise.allSettled([
                fetchJson<{ results: MediaItem[] }>(`/api/tmdb/search?query=${encodeURIComponent(cand)}`),
                fetchAnimeWithFallback(cand),
              ]);
              let cTmdb: MediaItem[] = [];
              let cAnime: AnimeItem[] = [];
              if (ct.status === "fulfilled" && ct.value?.results) {
                cTmdb = filterExcludeAnime(
                  filterReleasedSafeContent(
                    ct.value.results.filter((r) => r.media_type === "movie" || r.media_type === "tv" || r.media_type === "person"),
                    true
                  ) as MediaItem[]
                ) as MediaItem[];
              }
              if (ca.status === "fulfilled" && Array.isArray(ca.value)) {
                cAnime = ca.value;
              }
              if (cTmdb.length > 0 || cAnime.length > 0) {
                return { tmdb: cTmdb, anime: cAnime, title: cand.charAt(0).toUpperCase() + cand.slice(1) };
              }
              return null;
            })
          );
          for (const r of candidateResults) {
            if (r.status === "fulfilled" && r.value) {
              mainTmdb = r.value.tmdb;
              mainAnime = r.value.anime;
              correctedTitle = r.value.title;
              break;
            }
          }
        }

        // Show main results immediately — stop loading NOW
        setResults(mainTmdb);
        setAnimeResults(mainAnime);
        setCorrectedQuery(correctedTitle);
        if (!cancelled) setIsLoading(false);

        // 3. Phase 2 — Deferred: fetch related suggestions in background (non-blocking)
        if (!cancelled) {
          fetchRelatedSuggestions(mainTmdb, mainAnime, correctedTitle, debouncedQuery).then(suggestions => {
            if (!cancelled) setRelatedSuggestions(suggestions);
          });
        }

      } catch (err) {
        if (!cancelled) setError("Search failed");
        if (!cancelled) setIsLoading(false);
      }
    };

    executeSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ── Phase 2: Background fetch for related suggestions (non-blocking) ──────────
  async function fetchRelatedSuggestions(
    mainTmdb: MediaItem[],
    mainAnime: AnimeItem[],
    correctedTitle: string | null,
    originalQuery: string
  ): Promise<string[]> {
    const suggestionsSet = new Set<string>();
    const qLower = originalQuery.toLowerCase().trim();
    const corrLower = correctedTitle ? correctedTitle.toLowerCase().trim() : "";

    const topMediaItem = mainTmdb.find((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path);
    const topAnimeItem = mainAnime.find((a: any) => a.poster || a.image);

    const promises: Promise<any>[] = [];

    if (topMediaItem) {
      promises.push(
        fetchJson<{ results: MediaItem[] }>(
          `/api/tmdb/recommendations?mediaId=${topMediaItem.id}&mediaType=${topMediaItem.media_type}`
        ).catch(() => ({ results: [] }))
      );
    }

    if (topAnimeItem) {
      promises.push(
        fetchJson<{ data?: { recommendations: AnimeItem[] } }>(
          `/api/anime/recommendations/${topAnimeItem.id}`
        ).catch(() => ({ data: { recommendations: [] } }))
      );
    }

    if (promises.length === 0) return [];

    const results = await Promise.allSettled(promises);

    const extractName = (item: any) => item?.title || item?.name || item?.original_title || item?.original_name;

    results.forEach((res) => {
      if (res.status !== "fulfilled" || !res.value) return;
      const val = res.value;

      if (val.results && Array.isArray(val.results)) {
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
    });

    return Array.from(suggestionsSet)
      .filter((term) => term.trim().length >= 2)
      .slice(0, 8);
  }

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
                        ? "bg-[#4B5694] text-white shadow-lg shadow-black/30"
                        : "bg-primary text-primary-foreground shadow-lg shadow-black/30"
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5 md:gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5 md:gap-6">
                    {showMedia && filteredResults.map((item, i) => (
                      <div key={`main-media-${item.id}`} className="w-full h-full flex justify-center">
                        {item.media_type === "person" ? (
                          <PersonCard item={item} />
                        ) : (
                          <MediaCard item={item} index={i} showMediaBadge={true} />
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
