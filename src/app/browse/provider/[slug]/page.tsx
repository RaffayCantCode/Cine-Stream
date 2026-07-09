"use client";
export const runtime = 'edge';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { MediaRow } from "@/components/MediaRow";
import { fetchJson, filterReleasedSafeContent, shuffleArray } from "@/lib/utils";
import { getProviderBySlug, PROVIDERS } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  Tv,
  Star,
  TrendingUp,
  Flame,
  LayoutGrid,
  Rows3,
  SlidersHorizontal,
  ChevronDown,
  Play,
  Info,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
}

type SortKey = "popularity.desc" | "vote_average.desc" | "release_date.desc" | "release_date.asc";
type FilterType = "all" | "movie" | "tv";
type ViewMode = "rows" | "grid";

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Most Popular", value: "popularity.desc" },
  { label: "Top Rated", value: "vote_average.desc" },
  { label: "Newest First", value: "release_date.desc" },
  { label: "Oldest First", value: "release_date.asc" },
];

// Provider-specific accent colours for the hero gradient
const PROVIDER_GRADIENTS: Record<string, string> = {
  "netflix": "from-red-900/60 via-red-900/20",
  "disney-plus": "from-blue-900/60 via-blue-900/20",
  "prime-video": "from-cyan-900/60 via-cyan-900/20",
  "apple-tv-plus": "from-zinc-900/60 via-zinc-900/20",
  "hulu": "from-emerald-900/60 via-emerald-900/20",
  "hbo-max": "from-purple-900/60 via-purple-900/20",
  "paramount-plus": "from-blue-900/60 via-blue-900/20",
  "peacock": "from-orange-900/60 via-orange-900/20",
};

async function fetchProviderItems(
  providerIdStr: string,
  region: string,
  type: "movie" | "tv",
  sortBy: SortKey,
  page: number,
  minVote?: string,
  monetizationTypes?: string
): Promise<{ results: MediaItem[]; total_pages: number }> {
  const endpoint = type === "movie" ? "movies" : "tv";
  const params = new URLSearchParams({
    withProviders: providerIdStr,
    watchRegion: region,
    sortBy,
    page: String(page),
  });
  if (minVote) params.set("minVote", minVote);
  // Pass per-provider monetization types; API defaults to "flatrate" if omitted
  if (monetizationTypes) params.set("monetizationTypes", monetizationTypes);
  const data = await fetchJson<{ results: MediaItem[]; total_pages?: number }>(
    `/api/tmdb/discover/${endpoint}?${params.toString()}`,
    { cacheTtlMs: 180000 }
  );
  return { results: data.results || [], total_pages: data.total_pages ?? 1 };
}

export default function ProviderPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";
  const provider = getProviderBySlug(slug);

  // ── state ──────────────────────────────────────────────────────────────────
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTvShows] = useState<MediaItem[]>([]);
  const [trendingMoviesRow, setTrendingMoviesRow] = useState<MediaItem[]>([]);
  const [topRatedMoviesRow, setTopRatedMoviesRow] = useState<MediaItem[]>([]);
  const [trendingTvRow, setTrendingTvRow] = useState<MediaItem[]>([]);
  const [topRatedTvRow, setTopRatedTvRow] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadMorePage, setLoadMorePage] = useState(1);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);
  const [hasMoreTv, setHasMoreTv] = useState(true);
  const [heroIndex, setHeroIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortKey>("popularity.desc");
  const [viewMode, setViewMode] = useState<ViewMode>("rows");
  const [sortOpen, setSortOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const sortRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  isLoadingRef.current = isLoading || isSearching;

  // ── close sort dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Build provider ID string — combine primary + additionalIds with pipe (OR logic)
  const providerIdStr = provider
    ? [provider.id, ...(provider.additionalIds || [])].join("|")
    : "";

  // ── search data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || !provider) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchJson<{ success: boolean; results: MediaItem[] }>(
          `/api/tmdb/provider-search?query=${encodeURIComponent(searchQuery)}&providerIds=${providerIdStr}&region=${provider.region}`
        );
        if (res.success && res.results) {
          setSearchResults(filterReleasedSafeContent(res.results));
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        console.error("Search failed:", e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery, providerIdStr, provider]);

  // ── fetch data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async (page: number, reset: boolean) => {
    if (!provider) return;
    if (reset) {
      setMovies([]);
      setTvShows([]);
      setHasMoreMovies(true);
      setHasMoreTv(true);
    }
    setIsLoading(true);
    setError(null);
    try {
      const minVote = sortBy === "vote_average.desc" ? "6" : undefined;
      const monetizationTypes = provider.monetizationTypes; // undefined → API defaults to "flatrate"
      
      const promises: Promise<any>[] = [
        fetchProviderItems(providerIdStr, provider.region, "movie", sortBy, page, minVote, monetizationTypes),
        fetchProviderItems(providerIdStr, provider.region, "tv", sortBy, page, minVote, monetizationTypes),
      ];

      if (reset) {
        promises.push(
          fetchProviderItems(providerIdStr, provider.region, "movie", "popularity.desc", 1, undefined, monetizationTypes),
          fetchProviderItems(providerIdStr, provider.region, "movie", "vote_average.desc", 1, "6", monetizationTypes),
          fetchProviderItems(providerIdStr, provider.region, "tv", "popularity.desc", 1, undefined, monetizationTypes),
          fetchProviderItems(providerIdStr, provider.region, "tv", "vote_average.desc", 1, "6", monetizationTypes)
        );
      }

      const results = await Promise.all(promises);
      const movieData = results[0];
      const tvData = results[1];

      if (reset) {
        setTrendingMoviesRow(filterReleasedSafeContent(results[2].results.map((i: any) => ({ ...i, media_type: "movie" as const }))));
        setTopRatedMoviesRow(filterReleasedSafeContent(results[3].results.map((i: any) => ({ ...i, media_type: "movie" as const }))));
        setTrendingTvRow(filterReleasedSafeContent(results[4].results.map((i: any) => ({ ...i, media_type: "tv" as const }))));
        setTopRatedTvRow(filterReleasedSafeContent(results[5].results.map((i: any) => ({ ...i, media_type: "tv" as const }))));
      }

      let finalMovies = movieData.results;
      let finalTv = tvData.results;

      const cleanMovies = filterReleasedSafeContent(
        finalMovies.map((i: any) => ({ ...i, media_type: "movie" as const }))
      ) as MediaItem[];
      const cleanTv = filterReleasedSafeContent(
        finalTv.map((i: any) => ({ ...i, media_type: "tv" as const }))
      ) as MediaItem[];

      setMovies((prev) => {
        const base = reset ? cleanMovies : [...prev, ...cleanMovies];
        const seen = new Set<string>();
        return base.filter((item) => {
          const key = `movie-${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return !!item.poster_path;
        });
      });
      setTvShows((prev) => {
        const base = reset ? cleanTv : [...prev, ...cleanTv];
        const seen = new Set<string>();
        return base.filter((item) => {
          const key = `tv-${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return !!item.poster_path;
        });
      });
      setHasMoreMovies(page < movieData.total_pages);
      setHasMoreTv(page < tvData.total_pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [provider, sortBy, providerIdStr]);

  // Initial load + re-load on filter/sort change
  useEffect(() => {
    setHeroIndex(-1);
    setLoadMorePage(1);
    loadData(1, true);
  }, [slug, sortBy]);

  // Infinite scroll sentinel - only active in grid view
  useEffect(() => {
    if (viewMode !== "grid") return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (isLoadingRef.current) return;
        const canMore =
          (filterType !== "tv" && hasMoreMovies) ||
          (filterType !== "movie" && hasMoreTv);
        if (!canMore) return;
        setLoadMorePage((p) => {
          const next = p + 1;
          loadData(next, false);
          return next;
        });
      },
      { rootMargin: "0px 0px 600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [viewMode, filterType, hasMoreMovies, hasMoreTv, loadData]);

  // ── hero item (best backdrop from all content) ────────────────────────────
  const pool = useMemo(() => {
    const firstMovies = movies.slice(0, 20);
    const firstTv = tvShows.slice(0, 20);
    return [...firstMovies, ...firstTv].filter((i) => i.backdrop_path && i.vote_average && i.vote_average >= 7);
  }, [movies, tvShows]);

  useEffect(() => {
    if (pool.length > 0 && heroIndex === -1) {
      setHeroIndex(Math.floor(Math.random() * pool.length));
    }
  }, [pool, heroIndex]);

  const heroItem = useMemo(() => {
    if (pool.length === 0) return null;
    if (heroIndex >= 0 && heroIndex < pool.length) {
      return pool[heroIndex];
    }
    return pool[0];
  }, [pool, heroIndex]);

  // ── derived display items ─────────────────────────────────────────────────
  const displayMovies = filterType === "tv" ? [] : movies;
  const displayTv = filterType === "movie" ? [] : tvShows;

  // Row-mode categories (fetched explicitly now)
  const trendingMovies = trendingMoviesRow;
  const topRatedMovies = topRatedMoviesRow;
  const trendingTv = trendingTvRow;
  const topRatedTv = topRatedTvRow;
  const allMovies = displayMovies.slice(0, 40);
  const allTv = displayTv.slice(0, 40);

  // ── unknown provider fallback ─────────────────────────────────────────────
  if (!provider) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64 pt-10">
          <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 mb-8 group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back
            </Link>
            <h1 className="text-3xl font-black text-white mb-6">Choose a service</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {PROVIDERS.map((p) => (
                <Link
                  key={p.slug}
                  href={`/browse/provider/${p.slug}`}
                  className="rounded-2xl border border-white/10 p-5 transition-all hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg, ${p.color}30, ${p.color}10)` }}
                >
                  <span className="text-sm font-bold text-white">{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const heroUrl = heroItem?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${heroItem.backdrop_path}`
    : null;
  const heroTitle = heroItem?.title || heroItem?.name || "";
  const heroIsMovie = heroItem?.media_type === "movie";
  const heroLink = heroItem ? (heroIsMovie ? `/movie/${heroItem.id}` : `/tv/${heroItem.id}`) : null;
  const gradientClass = PROVIDER_GRADIENTS[slug] || "from-[#111844]/60 via-[#111844]/20";

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 relative overflow-hidden">
      {/* Dynamic ambient brand glows */}
      <div 
        className="absolute top-[30vh] left-[-20%] w-[60%] aspect-square rounded-full blur-[150px] opacity-[0.06] pointer-events-none transition-all duration-1000"
        style={{ backgroundColor: provider.color }}
      />
      <div 
        className="absolute bottom-[20vh] right-[-20%] w-[50%] aspect-square rounded-full blur-[130px] opacity-[0.04] pointer-events-none transition-all duration-1000"
        style={{ backgroundColor: provider.color }}
      />

      <Sidebar />
      <main className="md:pl-56 lg:pl-64">

        {/* ══════════════════════════════════════════════════════════════════
            HERO SECTION — full-bleed cinematic banner
        ════════════════════════════════════════════════════════════════════ */}
        <div className="relative w-full h-[55vh] md:h-[70vh] overflow-hidden">
          {/* Backdrop */}
          {heroUrl ? (
            <motion.img
              key={heroUrl}
              src={heroUrl}
              alt={heroTitle}
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="eager"
              fetchPriority="high"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${provider.color}40 0%, #0a0d1f 100%)` }}
            />
          )}

          {/* Gradient overlays */}
          <div className={`absolute inset-0 bg-gradient-to-r ${gradientClass} to-transparent`} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent" />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-12 pb-12 md:pb-16 max-w-screen-2xl mx-auto">
            {/* Top bar: back + provider badge (absolute, doesn't consume flex space) */}
            <div className="absolute top-6 left-6 md:left-12 right-6 md:right-12 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back
              </Link>

              {/* Provider identity pill */}
              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/15 backdrop-blur-xl"
                style={{
                  background: `linear-gradient(135deg, ${provider.color}25, ${provider.color}10)`,
                  boxShadow: `0 4px 24px ${provider.color}30`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10"
                  style={{ background: provider.color, color: provider.textColor }}
                >
                  <ProviderIcon slug={provider.slug} className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/40">Streaming on</p>
                  <p className="text-sm font-black text-white leading-none">{provider.name}</p>
                </div>
              </div>
            </div>

            {/* Hero item info */}
            {heroItem && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="max-w-xl"
              >
                <p
                  className="text-xs font-bold tracking-[0.2em] uppercase mb-2 px-3 py-1 rounded-full inline-block"
                  style={{
                    background: `${provider.color}25`,
                    border: `1px solid ${provider.color}50`,
                    color: provider.color === "#111111" ? "#fff" : provider.color,
                  }}
                >
                  {heroIsMovie ? "Featured Film" : "Featured Series"}
                </p>
                <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 tracking-tight drop-shadow-2xl">
                  {heroTitle}
                </h1>
                {heroItem.overview && (
                  <p className="text-sm text-white/70 line-clamp-2 mb-5 leading-relaxed max-w-lg">
                    {heroItem.overview}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  {heroLink && (
                    <Link
                      href={`${heroLink}?autoplay=1`}
                      className="flex items-center gap-2 text-sm font-bold text-white px-5 py-3 rounded-xl transition-all duration-300 hover:scale-[1.03] active:scale-95"
                      style={{
                        background: `linear-gradient(135deg, ${provider.color}, ${provider.color}cc)`,
                        boxShadow: `0 4px 20px ${provider.color}50`,
                      }}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Watch Now
                    </Link>
                  )}
                  {heroLink && (
                    <Link
                      href={heroLink}
                      className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/10 transition-all"
                    >
                      <Info className="w-4 h-4" />
                      More Info
                    </Link>
                  )}
                  {heroItem.vote_average && (
                    <span className="flex items-center gap-1 text-amber-400 text-sm font-bold bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-amber-400/20">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {heroItem.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CONTROLS BAR — filter, sort, view toggle
        ════════════════════════════════════════════════════════════════════ */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/[0.06] px-6 md:px-12">
          <div className="max-w-screen-2xl mx-auto py-3 flex items-center justify-between gap-4 flex-wrap">

            {/* Search Input */}
            <div className="flex-1 max-w-sm">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder={`Search ${provider.name}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.06] focus:bg-white/[0.06] border border-white/[0.06] focus:border-white/20 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-white/40 transition-all outline-none"
                />
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2">
              {(["all", "movie", "tv"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterType(f)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all duration-200 ${
                    filterType === f
                      ? "text-white border-white/20"
                      : "text-white/50 border-white/[0.06] hover:text-white/70 hover:border-white/10"
                  }`}
                  style={
                    filterType === f
                      ? {
                          background: `linear-gradient(135deg, ${provider.color}30, ${provider.color}15)`,
                          borderColor: `${provider.color}50`,
                          boxShadow: `0 0 16px ${provider.color}20`,
                        }
                      : {}
                  }
                >
                  {f === "all" && <LayoutGrid className="w-3.5 h-3.5" />}
                  {f === "movie" && <Film className="w-3.5 h-3.5" />}
                  {f === "tv" && <Tv className="w-3.5 h-3.5" />}
                  {f === "all" ? "All" : f === "movie" ? "Movies" : "TV Shows"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <div ref={sortRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen((o) => !o)}
                  className="flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white px-3 py-2 rounded-xl border border-white/[0.06] hover:border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {SORT_OPTIONS.find((s) => s.value === sortBy)?.label}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {sortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-white/10 bg-[#0e1230]/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${
                            sortBy === opt.value
                              ? "text-white bg-white/[0.08]"
                              : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center border border-white/[0.06] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("rows")}
                  className={`p-2 transition-all ${viewMode === "rows" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                  title="Row view"
                >
                  <Rows3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-all ${viewMode === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CONTENT
        ════════════════════════════════════════════════════════════════════ */}
        {error && (
          <div className="px-6 md:px-12 pt-6 max-w-screen-2xl mx-auto">
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
          </div>
        )}

        {searchQuery.trim() ? (
          /* ─── SEARCH MODE ─── */
          <div className="px-6 md:px-12 max-w-screen-2xl mx-auto py-8">
            <div className="flex items-center gap-3 mb-8">
              <Search className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-black text-white tracking-tight">
                Search Results for "{searchQuery}"
              </h2>
              <span className="text-sm text-white/40 font-medium ml-2">
                {isSearching ? "Searching..." : `${searchResults.length} found on ${provider.name}`}
              </span>
            </div>
            
            {isSearching ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-2xl shimmer" style={{ animationDelay: `${i * 40}ms` }} />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {searchResults.map((item, idx) => (
                  <motion.div
                    key={`search-${item.id}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.2 }}
                  >
                    <MediaCard item={item} index={idx} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-white/5 border border-white/10">
                  <Search className="w-6 h-6 text-white/40" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">No matches found</h3>
                <p className="text-sm text-white/40 max-w-xs">
                  We couldn't find "{searchQuery}" on {provider.name}.
                </p>
              </div>
            )}
          </div>
        ) : viewMode === "rows" ? (
          /* ─── ROW MODE: Netflix-style sections ─── */
          <div className="py-6 space-y-2">
            {/* Movies section */}
            {filterType !== "tv" && (
              <>
                {trendingMovies.length > 0 && (
                  <MediaRow
                    title={`Top 10 Movies on ${provider.name} Today`}
                    items={trendingMovies}
                    isLoading={isLoading && movies.length === 0}
                    isTop10={true}
                    accentIcon={<TrendingUp className="w-4 h-4 text-[#7288AE]" />}
                  />
                )}
                {topRatedMovies.length > 0 && (
                  <MediaRow
                    title={`Top Rated Films`}
                    items={topRatedMovies}
                    isLoading={false}
                    accentIcon={<Star className="w-4 h-4 text-amber-400" />}
                  />
                )}
                {allMovies.length > 0 && (
                  <MediaRow
                    title="All Movies"
                    items={allMovies}
                    isLoading={isLoading && movies.length === 0}
                    accentIcon={<Film className="w-4 h-4 text-[#7288AE]" />}
                  />
                )}
              </>
            )}

            {/* TV section */}
            {filterType !== "movie" && (
              <>
                {trendingTv.length > 0 && (
                  <MediaRow
                    title={filterType === "tv" ? `Top 10 Shows on ${provider.name} Today` : `Top 10 Shows on ${provider.name} Today`}
                    items={trendingTv}
                    isLoading={isLoading && tvShows.length === 0}
                    isTop10={true}
                    accentIcon={<Flame className="w-4 h-4 text-orange-400" />}
                  />
                )}
                {topRatedTv.length > 0 && (
                  <MediaRow
                    title="Top Rated Series"
                    items={topRatedTv}
                    isLoading={false}
                    accentIcon={<Star className="w-4 h-4 text-amber-400" />}
                  />
                )}
                {allTv.length > 0 && (
                  <MediaRow
                    title="All TV Shows"
                    items={allTv}
                    isLoading={isLoading && tvShows.length === 0}
                    accentIcon={<Tv className="w-4 h-4 text-[#7288AE]" />}
                  />
                )}
              </>
            )}

            {/* Loading state for rows */}
            {isLoading && movies.length === 0 && tvShows.length === 0 && (
              <div className="space-y-8 px-6 md:px-12 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-6 w-48 rounded-lg shimmer mb-4" />
                    <div className="flex gap-4">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <div key={j} className="aspect-[2/3] w-[160px] shrink-0 rounded-2xl shimmer" style={{ animationDelay: `${j * 60}ms` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state — loaded but no content returned */}
            {!isLoading && !error && movies.length === 0 && tvShows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border border-white/10"
                  style={{ background: `linear-gradient(135deg, ${provider.color}30, ${provider.color}10)` }}
                >
                  <LayoutGrid className="w-7 h-7" style={{ color: provider.color }} />
                </div>
                <h3 className="text-lg font-black text-white mb-2">No content found</h3>
                <p className="text-sm text-white/40 mb-6 max-w-xs">
                  We couldn&apos;t find any titles for {provider.name} right now. This may be a temporary issue.
                </p>
                <button
                  type="button"
                  onClick={() => loadData(1, true)}
                  className="text-xs font-bold px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.08] transition-all"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ─── GRID MODE: sorted flat grid ─── */
          <div className="px-6 md:px-12 max-w-screen-2xl mx-auto py-8">
            {/* Section label */}
            {filterType !== "tv" && displayMovies.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-5">
                  <Film className="w-4 h-4 text-[#7288AE]" />
                  <h2 className="text-lg font-black text-white tracking-tight">
                    Movies on {provider.name}
                  </h2>
                  <span className="text-xs text-white/30 font-medium">{displayMovies.length} titles</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5 mb-12">
                  {displayMovies.map((item, idx) => (
                    <motion.div
                      key={`movie-${item.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.3 }}
                      className="flex justify-center"
                    >
                      <MediaCard item={item} index={idx} />
                    </motion.div>
                  ))}
                  {isLoading && displayMovies.length === 0 && Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] rounded-2xl shimmer" style={{ animationDelay: `${i * 40}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {filterType !== "movie" && displayTv.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-5">
                  <Tv className="w-4 h-4 text-[#7288AE]" />
                  <h2 className="text-lg font-black text-white tracking-tight">
                    TV Shows on {provider.name}
                  </h2>
                  <span className="text-xs text-white/30 font-medium">{displayTv.length} titles</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                  {displayTv.map((item, idx) => (
                    <motion.div
                      key={`tv-${item.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.3 }}
                      className="flex justify-center"
                    >
                      <MediaCard item={item} index={idx} />
                    </motion.div>
                  ))}
                  {isLoading && displayTv.length === 0 && Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] rounded-2xl shimmer" style={{ animationDelay: `${i * 40}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {!searchQuery.trim() && viewMode === "grid" && (
          <div
            ref={sentinelRef}
            style={{ overflowAnchor: "none" }}
            className="h-16 flex items-center justify-center"
          >
            {isLoading && (movies.length > 0 || tvShows.length > 0) && (
              <span className="text-xs text-white/30 font-medium">Loading more...</span>
            )}
            {!isLoading && !hasMoreMovies && !hasMoreTv && (movies.length > 0 || tvShows.length > 0) && (
              <span className="text-xs text-white/20">You&apos;ve reached the end</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
