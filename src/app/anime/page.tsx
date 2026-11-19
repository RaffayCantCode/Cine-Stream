"use client";
export const runtime = 'edge';

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { BrowseFilterBar, ScrollToTopButton, type FilterDropdownConfig } from "@/components/BrowseFilterBar";
import { shuffleArray } from "@/lib/utils";
import { fetchClientAnime } from "@/lib/anilist-client";
import { usePageContentReady } from "@/lib/pageLoad";

const ContinueWatching = dynamic(
  () => import("@/components/ContinueWatching").then((m) => m.ContinueWatching),
  { ssr: false }
);

type AnimeBrowseType = "popular" | "trending" | "top_rated" | "airing" | "newest" | "upcoming";

const ANIME_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mecha",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Music",
];

const ANIME_TYPE_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "trending", label: "Trending" },
  { value: "top_rated", label: "Top Rated" },
  { value: "airing", label: "Airing Now" },
  { value: "newest", label: "Newest" },
  { value: "upcoming", label: "Upcoming" },
];

const ANIME_FORMAT_OPTIONS = [
  { value: "", label: "All Formats" },
  { value: "TV", label: "TV Series" },
  { value: "MOVIE", label: "Movies" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
  { value: "SPECIAL", label: "Specials" },
];

const ANIME_STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "RELEASING", label: "Airing" },
  { value: "FINISHED", label: "Completed" },
  { value: "NOT_YET_RELEASED", label: "Upcoming" },
];

const CURRENT_YEAR = new Date().getFullYear();
const ANIME_YEAR_OPTIONS = [
  { value: "", label: "All Years" },
  ...Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => {
    const y = String(CURRENT_YEAR - i);
    return { value: y, label: y };
  }),
];

function getInitialAnimePage(): number {
  if (typeof window === "undefined") return 1;
  try {
    let s = sessionStorage.getItem("sv_anime_browse_page");
    if (!s) {
      s = String(Math.floor(Math.random() * 40) + 1);
      sessionStorage.setItem("sv_anime_browse_page", s);
    }
    return parseInt(s, 10) || 1;
  } catch {
    return 1;
  }
}

export default function AnimeBrowsePage() {
  const [browseType, setBrowseType] = useState<AnimeBrowseType>("popular");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [items, setItems] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadTrigger, setLoadTrigger] = useState(0);
  const [initialContentReady, setInitialContentReady] = useState(false);
  usePageContentReady(initialContentReady);

  const initialStartPageRef = useRef<number | null>(null);
  const nextPageRef = useRef<number>(1);
  const isInitialDefaultRef = useRef<boolean>(true);
  const requestIdRef = useRef<number>(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const triggerLoadRef = useRef<(() => void) | null>(null);

  isLoadingRef.current = isLoading;
  hasMoreRef.current = hasMore;

  const hasActiveFilters = Boolean(
    selectedGenre || selectedYear || selectedFormat || selectedStatus || browseType !== "popular"
  );

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const loadAnimeBatch = useCallback(
    async (replace: boolean, customPage?: number) => {
      const reqId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      const loadPage = customPage ?? nextPageRef.current;
      const isSearch = Boolean(debouncedQuery.trim());

      try {
        const category = isSearch ? "search" : browseType;
        const sortMap: Record<AnimeBrowseType, string | null> = {
          popular: "POPULARITY_DESC",
          trending: "TRENDING_DESC",
          top_rated: "SCORE_DESC",
          airing: "POPULARITY_DESC",
          newest: "START_DATE_DESC",
          upcoming: "POPULARITY_DESC",
        };

        const effectiveStatus =
          selectedStatus ||
          (browseType === "airing" ? "RELEASING" : browseType === "upcoming" ? "NOT_YET_RELEASED" : null);

        const useAdvancedFilters = Boolean(
          selectedYear || selectedFormat || effectiveStatus || browseType === "top_rated" || browseType === "newest" || browseType === "upcoming"
        );

        const res = await fetchClientAnime(
          category,
          loadPage,
          selectedGenre || "",
          debouncedQuery.trim(),
          useAdvancedFilters
            ? {
                year: selectedYear ? parseInt(selectedYear, 10) : null,
                format: selectedFormat || null,
                status: effectiveStatus,
                sort: isSearch ? null : sortMap[browseType],
              }
            : undefined
        );

        if (reqId !== requestIdRef.current) return;

        const merged = res.items || [];
        const seen = new Set<string>();
        const filtered = merged.filter((x: AnimeItem) => {
          if (!x.id || seen.has(x.id)) return false;
          seen.add(x.id);
          if (selectedGenre && x.genres && x.genres.length > 0) {
            if (!x.genres.some((g) => g.toLowerCase() === selectedGenre.toLowerCase())) return false;
          }
          if (selectedFormat && x.format) {
            if (x.format.toUpperCase() !== selectedFormat.toUpperCase()) return false;
          }
          return true;
        });

        const shouldShuffleInitial =
          replace && isInitialDefaultRef.current && !hasActiveFilters && !isSearch && !customPage;

        setItems((prev) => {
          const combined = replace
            ? shouldShuffleInitial
              ? shuffleArray(filtered)
              : filtered
            : [...prev, ...filtered];
          const seenSet = new Set<string>();
          return combined.filter((item) => {
            if (!item || !item.id) return false;
            if (seenSet.has(item.id)) return false;
            seenSet.add(item.id);
            return true;
          });
        });

        setHasMore(res.hasMore !== false && filtered.length > 0);
        nextPageRef.current = loadPage + 1;
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load anime");
        if (replace) setItems([]);
        setHasMore(false);
      } finally {
        if (reqId === requestIdRef.current) {
          setIsLoading(false);
          setIsShuffling(false);
          isInitialDefaultRef.current = false;
          setInitialContentReady(true);
        }
      }
    },
    [browseType, selectedGenre, selectedYear, selectedFormat, selectedStatus, debouncedQuery, hasActiveFilters]
  );

  // Reset and fetch whenever any filter/type/search changes
  useEffect(() => {
    if (initialStartPageRef.current === null) {
      initialStartPageRef.current = getInitialAnimePage();
    }
    const startP =
      isInitialDefaultRef.current && !hasActiveFilters && !debouncedQuery.trim()
        ? initialStartPageRef.current
        : 1;
    nextPageRef.current = startP;
    setItems([]);
    setHasMore(true);
    void loadAnimeBatch(true, startP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseType, selectedGenre, selectedYear, selectedFormat, selectedStatus, debouncedQuery]);

  // Infinite scroll trigger
  useEffect(() => {
    if (loadTrigger === 0) return;
    void loadAnimeBatch(false);
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
    if (rect.top <= window.innerHeight + 1400 && items.length > 0) {
      triggerLoadRef.current?.();
    }
  }, [items.length]);

  const handleShuffle = useCallback(async () => {
    if (debouncedQuery.trim()) {
      setQuery("");
      setDebouncedQuery("");
    }
    setIsShuffling(true);
    const maxPage = hasActiveFilters ? 10 : 45;
    const rng = Math.floor(Math.random() * maxPage) + 1;
    nextPageRef.current = rng;
    setItems([]);
    setHasMore(true);
    await loadAnimeBatch(true, rng);
  }, [debouncedQuery, hasActiveFilters, loadAnimeBatch]);

  const handleResetFilters = useCallback(() => {
    setBrowseType("popular");
    setSelectedGenre("");
    setSelectedYear("");
    setSelectedFormat("");
    setSelectedStatus("");
    setQuery("");
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
          ...ANIME_GENRES.map((g) => ({ value: g, label: g })),
        ],
        onChange: (val) => {
          setQuery("");
          setSelectedGenre(val);
        },
      },
      {
        id: "year",
        label: "Year",
        value: selectedYear,
        defaultValue: "",
        options: ANIME_YEAR_OPTIONS,
        onChange: (val) => {
          setQuery("");
          setSelectedYear(val);
        },
      },
      {
        id: "type",
        label: "Popular",
        value: browseType,
        defaultValue: "popular",
        showActiveDot: true,
        options: ANIME_TYPE_OPTIONS,
        onChange: (val) => {
          setQuery("");
          setBrowseType(val as AnimeBrowseType);
        },
      },
      {
        id: "format",
        label: "Format",
        value: selectedFormat,
        defaultValue: "",
        options: ANIME_FORMAT_OPTIONS,
        onChange: (val) => {
          setQuery("");
          setSelectedFormat(val);
        },
      },
      {
        id: "status",
        label: "Status",
        value: selectedStatus,
        defaultValue: "",
        options: ANIME_STATUS_OPTIONS,
        onChange: (val) => {
          setQuery("");
          setSelectedStatus(val);
        },
      },
    ],
    [selectedGenre, selectedYear, browseType, selectedFormat, selectedStatus]
  );

  const activeSubtitle = useMemo(() => {
    if (debouncedQuery.trim()) return `Search results for "${debouncedQuery.trim()}"`;
    const parts: string[] = [];
    const typeLabel = ANIME_TYPE_OPTIONS.find((t) => t.value === browseType)?.label;
    if (typeLabel) parts.push(typeLabel);
    if (selectedGenre) parts.push(selectedGenre);
    if (selectedYear) parts.push(selectedYear);
    const fmtLabel = ANIME_FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.label;
    if (selectedFormat && fmtLabel) parts.push(fmtLabel);
    const stLabel = ANIME_STATUS_OPTIONS.find((s) => s.value === selectedStatus)?.label;
    if (selectedStatus && stLabel) parts.push(stLabel);
    return parts.join(" · ");
  }, [debouncedQuery, browseType, selectedGenre, selectedYear, selectedFormat, selectedStatus]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="w-full pt-8 md:pt-24 lg:pt-28">
        <ContinueWatching filterType="anime" />

        <div className="px-5 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto">
          {/* Header + Sleek Filter Bar */}
          <div className="relative z-30 flex flex-col gap-5 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Anime</h1>
                <p className="text-xs sm:text-sm text-white/50 font-medium mt-1">
                  {activeSubtitle}
                </p>
              </div>
              <p className="text-[11px] text-amber-400/75 font-medium">
                Japanese audio with English subtitles · Not all titles stream on every source.
              </p>
            </div>

            <BrowseFilterBar
              filters={filterConfigs}
              onShuffle={handleShuffle}
              isShuffling={isShuffling}
              searchQuery={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search anime..."
              isSearching={Boolean(query.trim()) && (query !== debouncedQuery || isLoading)}
              hasActiveFilters={hasActiveFilters || Boolean(query.trim())}
              onResetFilters={handleResetFilters}
              accentColor="purple"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/80 mb-8">
              <div className="text-sm font-semibold text-white mb-1">Couldn&apos;t load anime</div>
              <div className="text-xs text-white/50 break-words">{error}</div>
            </div>
          )}

          {!isLoading && items.length === 0 && !error && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-12 text-center space-y-3 my-6">
              <p className="text-white/60 text-sm font-semibold">
                {debouncedQuery.trim()
                  ? `No anime found for "${debouncedQuery.trim()}"`
                  : "No anime matches these filters."}
              </p>
              {(hasActiveFilters || query.trim()) && (
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

          <div className="relative z-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6 pt-3 -mt-3">
            {isLoading && items.length === 0 && Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.04] animate-pulse" />
            ))}
            {items.map((item, i) => (
              <div key={`${item.id}-${i}`} className="w-full">
                <AnimeCard item={item} index={i} />
              </div>
            ))}
          </div>

          <div
            ref={sentinelRef}
            style={{ overflowAnchor: "none" }}
            className="w-full py-12 flex flex-col items-center justify-center gap-3 text-white/40 min-h-[100px]"
          >
            {isLoading && items.length > 0 ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span className="text-sm font-medium text-white/50">Loading more...</span>
              </div>
            ) : items.length > 0 && hasMore ? (
              <button
                onClick={() => triggerLoadRef.current?.()}
                className="text-sm font-semibold hover:text-white transition-colors py-2 px-6 bg-white/5 hover:bg-white/10 rounded-full cursor-pointer"
              >
                Load More
              </button>
            ) : items.length > 0 && !hasMore ? (
              <span className="text-xs text-white/25">End of results</span>
            ) : null}
          </div>
        </div>
      </main>

      <ScrollToTopButton />
    </div>
  );
}
