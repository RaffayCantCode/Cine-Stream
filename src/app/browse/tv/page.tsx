"use client";
export const runtime = 'edge';

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { MediaCard } from "@/components/MediaCard";
import { BrowseFilterBar, ScrollToTopButton, type FilterDropdownConfig } from "@/components/BrowseFilterBar";
import { Loader2 } from "lucide-react";
import { fetchJson, shuffleArray, filterReleasedSafeContent, filterExcludeAnime, filterExcludeNews } from "@/lib/utils";
import { getBrowseStartPage } from "@/lib/browse-prefetch";

const ContinueWatching = dynamic(
  () => import("@/components/ContinueWatching").then((m) => m.ContinueWatching),
  { ssr: false }
);

interface Genre {
  id: number;
  name: string;
}

interface TvShow {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string | null;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  original_language?: string;
  genre_ids?: number[];
}

type TvBrowseType = "popular" | "top_rated" | "newest" | "most_voted" | "upcoming";

const TV_TYPE_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "top_rated", label: "Top Rated" },
  { value: "newest", label: "Newest" },
  { value: "most_voted", label: "Most Voted" },
  { value: "upcoming", label: "Upcoming" },
];

const PROVIDER_OPTIONS = [
  { value: "", label: "All Providers" },
  { value: "8", label: "Netflix" },
  { value: "337", label: "Disney+" },
  { value: "9", label: "Prime Video" },
  { value: "350", label: "Apple TV+" },
  { value: "15", label: "Hulu" },
  { value: "1899", label: "Max" },
  { value: "531", label: "Paramount+" },
  { value: "386", label: "Peacock" },
];

const COUNTRY_OPTIONS = [
  { value: "", label: "All Countries" },
  { value: "US", label: "United States", badge: "US" },
  { value: "GB", label: "United Kingdom", badge: "UK" },
  { value: "KR", label: "South Korea", badge: "KR" },
  { value: "IN", label: "India", badge: "IN" },
  { value: "FR", label: "France", badge: "FR" },
  { value: "ES", label: "Spain", badge: "ES" },
  { value: "DE", label: "Germany", badge: "DE" },
  { value: "CA", label: "Canada", badge: "CA" },
  { value: "IT", label: "Italy", badge: "IT" },
  { value: "AU", label: "Australia", badge: "AU" },
  { value: "MX", label: "Mexico", badge: "MX" },
  { value: "BR", label: "Brazil", badge: "BR" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: "", label: "All Years" },
  ...Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => {
    const y = String(CURRENT_YEAR - i);
    return { value: y, label: y };
  }),
];

function buildTvDiscoverParams(
  browseType: TvBrowseType,
  genreId: string,
  year: string,
  provider: string,
  country: string,
  pageNum: number
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(pageNum));

  const today = new Date().toISOString().split("T")[0];

  if (browseType === "top_rated") {
    params.set("sortBy", "vote_average.desc");
  } else if (browseType === "newest") {
    params.set("sortBy", "first_air_date.desc");
    params.set("airDateLte", today);
  } else if (browseType === "most_voted") {
    params.set("sortBy", "vote_count.desc");
  } else if (browseType === "upcoming") {
    params.set("sortBy", "popularity.desc");
    params.set("airDateGte", today);
  } else {
    params.set("sortBy", "popularity.desc");
  }

  if (genreId) params.set("genreId", genreId);
  if (year) params.set("year", year);
  if (provider) {
    params.set("withProviders", provider);
    params.set("watchRegion", "US");
  }
  if (country) params.set("country", country);

  return params;
}

export default function BrowseTvPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [browseType, setBrowseType] = useState<TvBrowseType>("popular");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [shows, setShows] = useState<TvShow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadTrigger, setLoadTrigger] = useState(0);

  const initialStartPageRef = useRef<number>(getBrowseStartPage("tv"));
  const nextPageRef = useRef<number>(initialStartPageRef.current);
  const isInitialDefaultRef = useRef<boolean>(true);
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const triggerLoadRef = useRef<(() => void) | null>(null);

  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;

  const hasActiveFilters = Boolean(
    selectedGenre || selectedYear || selectedProvider || selectedCountry || browseType !== "popular"
  );

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch TV genres once
  useEffect(() => {
    let active = true;
    fetchJson<{ genres: Genre[] }>("/api/tmdb/genres/tv")
      .then((data) => {
        if (active) setGenres((data.genres || []).filter((g) => g.id !== 10763));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const fetchBatch = useCallback(
    async (replace: boolean, customStartPage?: number) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const reqId = ++requestIdRef.current;

      setIsLoading(true);
      setError(null);

      try {
        const isSearch = Boolean(debouncedSearch.trim());
        const startP = customStartPage ?? nextPageRef.current;
        const pagesToFetch = replace && isInitialDefaultRef.current && !hasActiveFilters && !isSearch
          ? [startP]
          : [startP, startP + 1];

        const results = await Promise.all(
          pagesToFetch.map(async (p) => {
            if (isSearch) {
              const params = new URLSearchParams();
              params.set("type", "tv");
              params.set("query", debouncedSearch.trim());
              params.set("page", String(p));
              return await fetchJson<{
                results: TvShow[];
                page?: number;
                total_pages?: number;
              }>(`/api/tmdb/search?${params}`, { signal: controller.signal });
            }

            const params = buildTvDiscoverParams(
              browseType,
              selectedGenre,
              selectedYear,
              selectedProvider,
              selectedCountry,
              p
            );
            return await fetchJson<{
              results: TvShow[];
              page?: number;
              total_pages?: number;
            }>(`/api/tmdb/discover/tv?${params}`, { signal: controller.signal });
          })
        );

        if (reqId !== requestIdRef.current || controller.signal.aborted) return;

        const allowUnreleased = isSearch || browseType === "upcoming";
        const allItems = results.flatMap((r) => {
          const raw = (r.results || []).filter((s) => (isSearch ? true : Boolean(s.poster_path)));
          return filterExcludeNews(filterExcludeAnime(filterReleasedSafeContent(raw, allowUnreleased)));
        });

        const shouldShuffleInitial =
          replace && isInitialDefaultRef.current && !hasActiveFilters && !isSearch && !customStartPage;

        setShows((prev) => {
          const base = replace ? (shouldShuffleInitial ? shuffleArray(allItems) : allItems) : [...prev, ...allItems];
          const seen = new Set<string>();
          return base.filter((item) => {
            if (!item || !item.id) return false;
            const key = `${item.media_type || "tv"}-${item.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });

        const last = results[results.length - 1];
        const totalPages = last?.total_pages ?? 1;
        const lastFetchedPage = pagesToFetch[pagesToFetch.length - 1];
        setHasMore(lastFetchedPage < totalPages && allItems.length > 0);
        nextPageRef.current = lastFetchedPage + 1;
      } catch (err) {
        if (reqId !== requestIdRef.current || controller.signal.aborted) return;
        if (replace) setShows([]);
        setError(err instanceof Error ? err.message : "Failed to load TV shows");
        setHasMore(false);
      } finally {
        if (reqId === requestIdRef.current) {
          setIsLoading(false);
          setIsShuffling(false);
          isInitialDefaultRef.current = false;
        }
      }
    },
    [browseType, selectedGenre, selectedYear, selectedProvider, selectedCountry, debouncedSearch, hasActiveFilters]
  );

  // Reset and fetch whenever any filter/sort/search changes
  useEffect(() => {
    const startP =
      isInitialDefaultRef.current && !hasActiveFilters && !debouncedSearch.trim()
        ? initialStartPageRef.current
        : 1;
    nextPageRef.current = startP;
    setShows([]);
    setHasMore(true);
    void fetchBatch(true, startP);

    return () => {
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseType, selectedGenre, selectedYear, selectedProvider, selectedCountry, debouncedSearch]);

  // Infinite scroll trigger
  useEffect(() => {
    if (loadTrigger === 0) return;
    void fetchBatch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTrigger]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const check = () => {
      if (isLoadingRef.current || !hasMoreRef.current) return;
      setLoadTrigger((k) => k + 1);
    };
    triggerLoadRef.current = check;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          check();
        }
      },
      { rootMargin: "1400px" }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const rect = sentinelRef.current.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 1400 && shows.length > 0) {
      triggerLoadRef.current?.();
    }
  }, [shows.length]);

  const handleShuffle = useCallback(async () => {
    if (debouncedSearch.trim()) {
      setSearchQuery("");
      setDebouncedSearch("");
    }
    setIsShuffling(true);
    const maxPage = hasActiveFilters ? 15 : 80;
    const rng = Math.floor(Math.random() * maxPage) + 1;
    nextPageRef.current = rng;
    setShows([]);
    setHasMore(true);
    await fetchBatch(true, rng);
  }, [debouncedSearch, hasActiveFilters, fetchBatch]);

  const handleResetFilters = useCallback(() => {
    setSelectedGenre("");
    setSelectedYear("");
    setBrowseType("popular");
    setSelectedProvider("");
    setSelectedCountry("");
    setSearchQuery("");
  }, []);

  const filterConfigs = useMemo<FilterDropdownConfig[]>(
    () => [
      {
        id: "genre",
        label: "Genre",
        value: selectedGenre,
        defaultValue: "",
        options: [
          { value: "", label: "All Genres" },
          ...genres.map((g) => ({ value: String(g.id), label: g.name })),
        ],
        onChange: (val) => {
          setSearchQuery("");
          setSelectedGenre(val);
        },
      },
      {
        id: "year",
        label: "Year",
        value: selectedYear,
        defaultValue: "",
        options: YEAR_OPTIONS,
        onChange: (val) => {
          setSearchQuery("");
          setSelectedYear(val);
        },
      },
      {
        id: "type",
        label: "Popular",
        value: browseType,
        defaultValue: "popular",
        showActiveDot: true,
        options: TV_TYPE_OPTIONS,
        onChange: (val) => {
          setSearchQuery("");
          setBrowseType(val as TvBrowseType);
        },
      },
      {
        id: "provider",
        label: "Provider",
        value: selectedProvider,
        defaultValue: "",
        options: PROVIDER_OPTIONS,
        onChange: (val) => {
          setSearchQuery("");
          setSelectedProvider(val);
        },
      },
      {
        id: "country",
        label: "Country",
        value: selectedCountry,
        defaultValue: "",
        options: COUNTRY_OPTIONS,
        onChange: (val) => {
          setSearchQuery("");
          setSelectedCountry(val);
        },
      },
    ],
    [genres, selectedGenre, selectedYear, browseType, selectedProvider, selectedCountry]
  );

  const activeSubtitle = useMemo(() => {
    if (debouncedSearch.trim()) return `Search results for "${debouncedSearch.trim()}"`;
    const parts: string[] = [];
    const typeLabel = TV_TYPE_OPTIONS.find((t) => t.value === browseType)?.label;
    if (typeLabel) parts.push(typeLabel);
    const genreLabel = genres.find((g) => String(g.id) === selectedGenre)?.name;
    if (genreLabel) parts.push(genreLabel);
    if (selectedYear) parts.push(selectedYear);
    const provLabel = PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)?.label;
    if (selectedProvider && provLabel) parts.push(`on ${provLabel}`);
    const countryLabel = COUNTRY_OPTIONS.find((c) => c.value === selectedCountry)?.label;
    if (selectedCountry && countryLabel) parts.push(countryLabel);
    return parts.join(" · ");
  }, [debouncedSearch, browseType, genres, selectedGenre, selectedYear, selectedProvider, selectedCountry]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="w-full pt-8 md:pt-24 lg:pt-28">
        <ContinueWatching filterType="tv" />

        <div className="px-5 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto">
          {/* Header + Sleek Filter Bar */}
          <div className="flex flex-col gap-5 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">TV Shows</h1>
                <p className="text-xs sm:text-sm text-white/50 font-medium mt-1">
                  {activeSubtitle}
                </p>
              </div>
            </div>

            <BrowseFilterBar
              filters={filterConfigs}
              onShuffle={handleShuffle}
              isShuffling={isShuffling}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search TV shows..."
              isSearching={Boolean(searchQuery.trim()) && (searchQuery !== debouncedSearch || isLoading)}
              hasActiveFilters={hasActiveFilters || Boolean(searchQuery.trim())}
              onResetFilters={handleResetFilters}
              accentColor="emerald"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/80 mb-8">
              <div className="text-sm font-semibold text-white mb-1">Couldn&apos;t load TV shows</div>
              <div className="text-xs text-white/50 break-words">{error}</div>
            </div>
          )}

          {!isLoading && shows.length === 0 && !error && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-12 text-center space-y-3 my-6">
              <p className="text-white/60 text-sm font-semibold">
                {debouncedSearch.trim()
                  ? `No TV shows found for "${debouncedSearch.trim()}"`
                  : "No TV shows match these filters."}
              </p>
              {(hasActiveFilters || searchQuery.trim()) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}

          {isLoading && shows.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
              {shows.map((item, i) => (
                <div key={item.id} className="w-full h-full flex justify-center">
                  <MediaCard item={{ ...item, media_type: "tv" }} index={i} priority={i < 10} />
                </div>
              ))}
            </div>
          )}

          <div
            ref={sentinelRef}
            style={{ overflowAnchor: "none" }}
            className="w-full py-16 flex flex-col items-center justify-center gap-3 text-white/40 min-h-[100px]"
          >
            {isLoading && shows.length > 0 ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span className="text-sm font-medium text-white/50">Loading more...</span>
              </div>
            ) : shows.length > 0 && hasMore ? (
              <button
                onClick={() => triggerLoadRef.current?.()}
                className="text-sm font-semibold hover:text-white transition-colors py-2 px-6 bg-white/5 hover:bg-white/10 rounded-full cursor-pointer"
              >
                Load More
              </button>
            ) : shows.length > 0 && !hasMore ? (
              <span className="text-xs text-white/25">End of results</span>
            ) : null}
          </div>
        </div>
      </main>

      <ScrollToTopButton />
    </div>
  );
}
