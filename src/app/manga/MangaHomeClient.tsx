"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MangaCard } from "@/components/manga/MangaCard";
import { MangaItem } from "@/lib/manga-fetch";
import { 
  getLocalMangaHistory, 
  removeLocalMangaProgress, 
  fetchServerMangaHistory, 
  saveServerMangaProgress,
  removeServerMangaProgress, 
  MangaReadingProgress 
} from "@/lib/manga-history";
import { fetchJson, shuffleArray } from "@/lib/utils";
import { 
  BookOpen, 
  Search, 
  TrendingUp, 
  Flame, 
  Sparkles, 
  Play, 
  Bookmark, 
  Loader2, 
  X,
  ChevronRight
} from "lucide-react";
import { usePageContentReady } from "@/lib/pageLoad";
import { useSession } from "next-auth/react";

const GENRES = [
  { label: "All", id: "", name: "" },
  { label: "Action", id: "Action", name: "Action" },
  { label: "Romance", id: "Romance", name: "Romance" },
  { label: "Fantasy", id: "Fantasy", name: "Fantasy" },
  { label: "Isekai", id: "Isekai", name: "Isekai" },
  { label: "Supernatural", id: "Supernatural", name: "Supernatural" },
  { label: "Sci-Fi", id: "Sci-Fi", name: "Sci-Fi" },
  { label: "Comedy", id: "Comedy", name: "Comedy" },
  { label: "Mystery", id: "Mystery", name: "Mystery" },
  { label: "Drama", id: "Drama", name: "Drama" },
  { label: "Slice of Life", id: "Slice of Life", name: "Slice of Life" },
  { label: "Adventure", id: "Adventure", name: "Adventure" },
  { label: "Psychological", id: "Psychological", name: "Psychological" },
  { label: "Horror", id: "Horror", name: "Horror" },
  { label: "Martial Arts", id: "Martial Arts", name: "Martial Arts" },
];

const ITEMS_PER_PAGE = 24;

let globalMangaHomeCache: {
  trendingNow: MangaItem[];
  trendingManhwas: MangaItem[];
  trendingMangas: MangaItem[];
} | null = null;

const SESSION_MANGA_HOME_KEY = "sv_manga_home_cache_v4";

function saveMangaHomeToSession(data: { trendingNow: MangaItem[]; trendingManhwas: MangaItem[]; trendingMangas: MangaItem[] }): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SESSION_MANGA_HOME_KEY, JSON.stringify(data)); } catch {}
}

function loadMangaHomeFromSession(): { trendingNow: MangaItem[]; trendingManhwas: MangaItem[]; trendingMangas: MangaItem[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_MANGA_HOME_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export interface MangaHomeClientProps {
  initialTrending?: MangaItem[];
  initialManhwas?: MangaItem[];
  initialMangas?: MangaItem[];
  initialType?: string;
  initialGenre?: string;
}

export default function MangaHomeClient({
  initialTrending = [],
  initialManhwas = [],
  initialMangas = [],
  initialType = "all",
  initialGenre = "",
}: MangaHomeClientProps = {}) {
  const { status } = useSession();
  const router = useRouter();

  const [trendingNow, setTrendingNow] = useState<MangaItem[]>(() => {
    if (initialTrending.length > 0) return shuffleArray<MangaItem>(initialTrending).slice(0, 15);
    if (globalMangaHomeCache?.trendingNow && globalMangaHomeCache.trendingNow.length > 0) return globalMangaHomeCache.trendingNow;
    const sessionData = loadMangaHomeFromSession();
    return sessionData?.trendingNow || [];
  });
  const [isTrendingNowLoading, setIsTrendingNowLoading] = useState(() => {
    if (initialTrending.length > 0) return false;
    if (globalMangaHomeCache?.trendingNow && globalMangaHomeCache.trendingNow.length > 0) return false;
    const sessionData = loadMangaHomeFromSession();
    return (sessionData?.trendingNow && sessionData.trendingNow.length > 0) ? false : true;
  });

  const [trendingManhwas, setTrendingManhwas] = useState<MangaItem[]>(() => {
    if (initialManhwas.length > 0) return shuffleArray<MangaItem>(initialManhwas).slice(0, 15);
    if (globalMangaHomeCache?.trendingManhwas && globalMangaHomeCache.trendingManhwas.length > 0) return globalMangaHomeCache.trendingManhwas;
    const sessionData = loadMangaHomeFromSession();
    return sessionData?.trendingManhwas || [];
  });
  const [isTrendingManhwasLoading, setIsTrendingManhwasLoading] = useState(() => {
    if (initialManhwas.length > 0) return false;
    if (globalMangaHomeCache?.trendingManhwas && globalMangaHomeCache.trendingManhwas.length > 0) return false;
    const sessionData = loadMangaHomeFromSession();
    return (sessionData?.trendingManhwas && sessionData.trendingManhwas.length > 0) ? false : true;
  });

  const [trendingMangas, setTrendingMangas] = useState<MangaItem[]>(() => {
    if (initialMangas.length > 0) return shuffleArray<MangaItem>(initialMangas).slice(0, 15);
    if (globalMangaHomeCache?.trendingMangas && globalMangaHomeCache.trendingMangas.length > 0) return globalMangaHomeCache.trendingMangas;
    const sessionData = loadMangaHomeFromSession();
    return sessionData?.trendingMangas || [];
  });
  const [isTrendingMangasLoading, setIsTrendingMangasLoading] = useState(() => {
    if (initialMangas.length > 0) return false;
    if (globalMangaHomeCache?.trendingMangas && globalMangaHomeCache.trendingMangas.length > 0) return false;
    const sessionData = loadMangaHomeFromSession();
    return (sessionData?.trendingMangas && sessionData.trendingMangas.length > 0) ? false : true;
  });

  const [history, setHistory] = useState<MangaReadingProgress[]>(() =>
    typeof window !== "undefined" ? getLocalMangaHistory() : []
  );
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MangaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Simplified type filter: All, Manhwa, Manga — persisted via URL search params
  const [selectedType, setSelectedType] = useState<"all" | "manhwa" | "manga">(
    () => (initialType as "all" | "manhwa" | "manga") || "all"
  );
  const [selectedGenre, setSelectedGenre] = useState<string>(() => initialGenre || "");

  // Update URL search params when filters change so state persists across navigation
  const updateFilterParams = useCallback(
    (type: string, genre: string) => {
      const params = new URLSearchParams();
      if (type && type !== "all") params.set("type", type);
      if (genre) params.set("genre", genre);
      const qs = params.toString();
      router.replace(`/manga${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router]
  );

  const handleSetSelectedType = useCallback(
    (t: "all" | "manhwa" | "manga") => {
      setSelectedType(t);
      updateFilterParams(t, selectedGenre);
    },
    [selectedGenre, updateFilterParams]
  );

  const handleSetSelectedGenre = useCallback(
    (genreId: string) => {
      const newGenre = selectedGenre === genreId ? "" : genreId;
      setSelectedGenre(newGenre);
      updateFilterParams(selectedType, newGenre);
    },
    [selectedType, selectedGenre, updateFilterParams]
  );
  const [genreResults, setGenreResults] = useState<MangaItem[]>([]);
  const [isGenreLoading, setIsGenreLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageOffset, setPageOffset] = useState(0);

  // Page shell signals ready after mount so NavigationLoader hides properly
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  usePageContentReady(isMounted);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const clientCache = useRef<Map<string, MangaItem[]>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSearchIdRef = useRef<number>(0);
  const discardedIdsRef = useRef<Set<string>>(new Set());
  const lastHistoryFetchRef = useRef<number>(0);

  // Instant clear handler for search input
  const handleClearSearch = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    activeSearchIdRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSearchQuery("");
    setDebouncedSearch("");
    setSearchResults([]);
    setIsSearching(false);
    setPageOffset(0);
    setHasMore(true);
  }, []);

  // Fetch Reading History strictly according to active authentication status
  const refreshHistory = useCallback(async (isBackground = false) => {
    const isDiscarded = (id: string) => {
      const clean = id.replace(/^(wc|asura)-/, "");
      return discardedIdsRef.current.has(id) || discardedIdsRef.current.has(clean);
    };

    if (isBackground && Date.now() - lastHistoryFetchRef.current < 60_000) {
      return;
    }

    if (status === "loading") {
      const local = getLocalMangaHistory().filter((item) => !isDiscarded(item.mangaId));
      if (local.length > 0) setHistory(local);
      return;
    }

    if (status === "authenticated") {
      try {
        lastHistoryFetchRef.current = Date.now();
        const serverHistory = await fetchServerMangaHistory();
        const filteredServer = serverHistory.filter((item) => !isDiscarded(item.mangaId));
        if (filteredServer.length > 0) {
          setHistory(filteredServer);
        } else {
          // If server history is empty, sync any non-discarded local items to server
          const local = getLocalMangaHistory().filter((item) => !isDiscarded(item.mangaId));
          if (local.length > 0) {
            setHistory(local);
            Promise.all(local.map((item) => saveServerMangaProgress(item))).catch(() => {});
          } else {
            setHistory([]);
          }
        }
      } catch (err) {
        console.warn("[MangaHomeClient] Failed to fetch server history:", err);
      }
    } else {
      const local = getLocalMangaHistory().filter((item) => !isDiscarded(item.mangaId));
      setHistory(local);
    }
  }, [status]);

  useEffect(() => {
    refreshHistory(false);

    const handleImmediateUpdate = () => {
      refreshHistory(false);
    };

    const handleBackgroundUpdate = () => {
      refreshHistory(true);
    };

    window.addEventListener("cinestream:manga-history-updated", handleImmediateUpdate);
    window.addEventListener("pageshow", handleBackgroundUpdate);
    window.addEventListener("focus", handleBackgroundUpdate);
    window.addEventListener("visibilitychange", handleBackgroundUpdate);
    window.addEventListener("storage", handleImmediateUpdate);

    return () => {
      window.removeEventListener("cinestream:manga-history-updated", handleImmediateUpdate);
      window.removeEventListener("pageshow", handleBackgroundUpdate);
      window.removeEventListener("focus", handleBackgroundUpdate);
      window.removeEventListener("visibilitychange", handleBackgroundUpdate);
      window.removeEventListener("storage", handleImmediateUpdate);
    };
  }, [refreshHistory]);

  // Handle Discard item from Continue Reading
  const handleDiscardHistory = async (e: React.MouseEvent, mangaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const cleanTarget = mangaId.replace(/^(wc|asura)-/, "");
    
    // Register in discarded set immediately so no background refresh can resurrect it
    discardedIdsRef.current.add(mangaId);
    discardedIdsRef.current.add(cleanTarget);
    discardedIdsRef.current.add(`wc-${cleanTarget}`);
    discardedIdsRef.current.add(`asura-${cleanTarget}`);

    setHistory((prev) =>
      prev.filter(
        (item) =>
          item.mangaId !== mangaId &&
          item.mangaId.replace(/^(wc|asura)-/, "") !== cleanTarget
      )
    );
    removeLocalMangaProgress(mangaId);
    if (status === "authenticated") {
      await removeServerMangaProgress(mangaId);
    }
  };

  // Snappy 150ms debounce for live search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modular & Incremental Progressive Load for top speed
  useEffect(() => {
    let isMounted = true;

    // Helper to persist current state to global & session cache
    const syncCache = (tNow?: MangaItem[], tMan?: MangaItem[], tManG?: MangaItem[]) => {
      const currentNow = tNow || trendingNow;
      const currentMan = tMan || trendingManhwas;
      const currentManG = tManG || trendingMangas;
      if (currentNow.length > 0 || currentMan.length > 0 || currentManG.length > 0) {
        globalMangaHomeCache = {
          trendingNow: currentNow,
          trendingManhwas: currentMan,
          trendingMangas: currentManG,
        };
        saveMangaHomeToSession(globalMangaHomeCache);
      }
    };

    // 1. Load Trending Now if not provided by server
    if (initialTrending.length === 0 && (!globalMangaHomeCache?.trendingNow || globalMangaHomeCache.trendingNow.length === 0)) {
      fetchJson<{ success: boolean; items: MangaItem[] }>("/api/manga/trending?limit=16")
        .then((data) => {
          if (!isMounted) return;
          const items = data.items || [];
          if (items.length > 0) {
            const shuffled = shuffleArray<MangaItem>(items).slice(0, 15);
            setTrendingNow(shuffled);
            syncCache(shuffled);
          }
        })
        .catch((err) => console.warn("Failed to load trending now:", err))
        .finally(() => {
          if (isMounted) setIsTrendingNowLoading(false);
        });
    } else {
      setIsTrendingNowLoading(false);
    }

    // 2. Load Trending Manhwas if not provided by server
    if (initialManhwas.length === 0 && (!globalMangaHomeCache?.trendingManhwas || globalMangaHomeCache.trendingManhwas.length === 0)) {
      fetchJson<{ success: boolean; items: MangaItem[] }>("/api/manga/manhwa?limit=16")
        .then((data) => {
          if (!isMounted) return;
          const items = data.items || [];
          if (items.length > 0) {
            const shuffled = shuffleArray<MangaItem>(items).slice(0, 15);
            setTrendingManhwas(shuffled);
            syncCache(undefined, shuffled);
          }
        })
        .catch((err) => console.warn("Failed to load trending manhwas:", err))
        .finally(() => {
          if (isMounted) setIsTrendingManhwasLoading(false);
        });
    } else {
      setIsTrendingManhwasLoading(false);
    }

    // 3. Load Trending Mangas if not provided by server
    if (initialMangas.length === 0 && (!globalMangaHomeCache?.trendingMangas || globalMangaHomeCache.trendingMangas.length === 0)) {
      fetchJson<{ success: boolean; items: MangaItem[] }>("/api/manga/latest?limit=16")
        .then((data) => {
          if (!isMounted) return;
          const items = data.items || [];
          if (items.length > 0) {
            const shuffled = shuffleArray<MangaItem>(items).slice(0, 15);
            setTrendingMangas(shuffled);
            syncCache(undefined, undefined, shuffled);
          }
        })
        .catch((err) => console.warn("Failed to load trending mangas:", err))
        .finally(() => {
          if (isMounted) setIsTrendingMangasLoading(false);
        });
    } else {
      setIsTrendingMangasLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [initialTrending.length, initialManhwas.length, initialMangas.length]);

  // Optimized Search Query Handler (with client cache & request aborting)
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const trimmed = debouncedSearch.trim();
    const searchId = ++activeSearchIdRef.current;
    const cacheKey = `search_${trimmed}_${selectedType}_0`;

    // 1. Check in-memory client cache for instant 0ms response (only non-empty)
    if (clientCache.current.has(cacheKey) && (clientCache.current.get(cacheKey)?.length || 0) > 0) {
      setSearchResults(clientCache.current.get(cacheKey)!);
      setIsSearching(false);
      setHasMore(true);
      setPageOffset(0);
      return;
    }

    // 2. Abort previous in-flight search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const performSearch = async () => {
      setIsSearching(true);
      setPageOffset(0);
      setHasMore(true);
      try {
        const typeParam = selectedType !== "all" ? `&type=${selectedType}` : "";
        const res = await fetch(
          `/api/manga/search?q=${encodeURIComponent(trimmed)}${typeParam}&limit=${ITEMS_PER_PAGE}&offset=0`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          if (activeSearchIdRef.current === searchId) {
            setSearchResults(items);
            if (items.length > 0) {
              clientCache.current.set(cacheKey, items);
            }
            if (items.length < ITEMS_PER_PAGE) setHasMore(false);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError" && activeSearchIdRef.current === searchId) {
          console.error("Search failed:", err);
          setSearchResults([]);
        }
      } finally {
        if (activeSearchIdRef.current === searchId) {
          setIsSearching(false);
        }
      }
    };

    performSearch();
  }, [debouncedSearch, selectedType]);

  // Optimized Genre / Type filter Handler (Instant cached switching)
  useEffect(() => {
    if (!selectedGenre && selectedType === "all") {
      setGenreResults([]);
      setPageOffset(0);
      return;
    }
    if (debouncedSearch.trim()) return;

    // selectedGenre IS the genreName now (e.g. "Action", "Romance", ...)
    const genreName = selectedGenre;
    const cacheKey = `genre_${genreName}_${selectedType}_0`;

    // 1. Check in-memory client cache for instant 0ms response
    if (clientCache.current.has(cacheKey)) {
      setGenreResults(clientCache.current.get(cacheKey)!);
      setIsGenreLoading(false);
      setHasMore(true);
      setPageOffset(0);
      return;
    }

    const performFilter = async () => {
      setIsGenreLoading(true);
      setPageOffset(0);
      setHasMore(true);
      try {
        const typeParam = selectedType !== "all" ? `&type=${selectedType}` : "";
        const genreNameParam = genreName ? `&genreName=${encodeURIComponent(genreName)}` : "";

        const data = await fetchJson<{ success: boolean; items: MangaItem[] }>(
          `/api/manga/search?limit=${ITEMS_PER_PAGE}&offset=0${typeParam}${genreNameParam}&sortBy=followedCount`
        );
        if (data.success) {
          const items = data.items || [];
          setGenreResults(items);
          clientCache.current.set(cacheKey, items);
          if (items.length < ITEMS_PER_PAGE) setHasMore(false);
        }
      } catch (err) {
        console.error("Filter failed:", err);
        setGenreResults([]);
      } finally {
        setIsGenreLoading(false);
      }
    };

    performFilter();
  }, [selectedGenre, selectedType, debouncedSearch]);

  // Infinite Scroll Loader: Fetches more items as user reaches bottom
  const loadMoreItems = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const nextOffset = pageOffset + ITEMS_PER_PAGE;
    try {
      if (debouncedSearch.trim()) {
        const typeParam = selectedType !== "all" ? `&type=${selectedType}` : "";
        const data = await fetchJson<{ success: boolean; items: MangaItem[] }>(
          `/api/manga/search?q=${encodeURIComponent(debouncedSearch.trim())}${typeParam}&limit=${ITEMS_PER_PAGE}&offset=${nextOffset}`
        );
        if (data.success && data.items && data.items.length > 0) {
          setSearchResults((prev) => {
            const seen = new Set(prev.map((i) => i.id));
            const fresh = data.items.filter((i) => !seen.has(i.id));
            return [...prev, ...fresh];
          });
          setPageOffset(nextOffset);
          if (data.items.length < ITEMS_PER_PAGE) setHasMore(false);
        } else {
          setHasMore(false);
        }
      } else if (selectedGenre || selectedType !== "all") {
        const typeParam = selectedType !== "all" ? `&type=${selectedType}` : "";
        // selectedGenre IS the genreName
        const genreNameParam = selectedGenre ? `&genreName=${encodeURIComponent(selectedGenre)}` : "";

        const data = await fetchJson<{ success: boolean; items: MangaItem[] }>(
          `/api/manga/search?limit=${ITEMS_PER_PAGE}&offset=${nextOffset}${typeParam}${genreNameParam}&sortBy=followedCount`
        );
        if (data.success && data.items && data.items.length > 0) {
          setGenreResults((prev) => {
            const seen = new Set(prev.map((i) => i.id));
            const fresh = data.items.filter((i) => !seen.has(i.id));
            return [...prev, ...fresh];
          });
          setPageOffset(nextOffset);
          if (data.items.length < ITEMS_PER_PAGE) setHasMore(false);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.warn("Failed to load more items:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, pageOffset, debouncedSearch, selectedType, selectedGenre]);

  // IntersectionObserver for Infinite Scroll Sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isGenreLoading && !isSearching && !isLoadingMore) {
          loadMoreItems();
        }
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isGenreLoading, isSearching, isLoadingMore, loadMoreItems]);

  const activeGenreObj = useMemo(() => GENRES.find((g) => g.id === selectedGenre), [selectedGenre]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-5 sm:px-8 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto space-y-12">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-black uppercase tracking-wider mb-3 shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Dedicated Manga & Manhwa Reader</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                Manga & Manhwa
              </h1>
              <p className="text-sm md:text-base text-zinc-300 font-medium mt-1.5 max-w-xl">
                Read thousands of full manga, manhwa, and webtoons with high-res chapters and zero ads.
              </p>
            </div>

            {/* Type Selector Tabs (All Series, Manhwa, Manga) */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md self-start md:self-end">
              {(["all", "manhwa", "manga"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleSetSelectedType(t)}
                  className={`px-4 py-2 rounded-xl text-xs font-black capitalize transition-all cursor-pointer ${
                    selectedType === t
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-102"
                      : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {t === "all" ? "All Series" : t === "manhwa" ? "Manhwa" : "Manga"}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Genre Filter Bar */}
          <div className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    handleClearSearch();
                  }
                }}
                placeholder="Search manga, manhwa, or authors (e.g. Solo Leveling, One Piece)..."
                className="w-full h-12 pl-11 pr-12 rounded-2xl bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.06] border border-white/[0.08] focus:border-primary/60 text-white text-sm outline-none transition-all placeholder:text-white/35 shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Genre Pills with High-Contrast Active State */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 pt-1">
              {GENRES.map((g) => {
                const isActive = selectedGenre === g.id;
                return (
                  <button
                    key={g.label}
                    onClick={() => handleSetSelectedGenre(g.id)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground border border-primary shadow-lg shadow-primary/30 font-black scale-105"
                        : "bg-white/[0.04] text-white/70 border border-white/[0.08] hover:bg-white/[0.08] hover:text-white font-bold"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTINUE READING SECTION (Box Card Grid with 2-row View All button) */}
          {!debouncedSearch.trim() && history.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bookmark className="w-5 h-5 text-primary" />
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    Continue Reading
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {isMounted && history.length > 6 && (
                    <Link
                      href="/manga/continue-reading"
                      className="text-xs font-black text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                    >
                      View All ({history.length})
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {isMounted && (
                    <span className="text-xs text-primary font-black bg-primary/10 px-3 py-1 rounded-full border border-primary/30">
                      {history.length} In Progress
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
                {history.slice(0, 6).map((item) => {
                  const progressPct = item.totalPages > 0 ? Math.min(100, Math.max(5, Math.round((item.pageNumber / item.totalPages) * 100))) : 0;
                  return (
                    <div
                      key={item.mangaId}
                      className="group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl bg-zinc-950/90 border border-white/[0.08] hover:border-primary/60 hover:shadow-[0_12px_32px_hsl(var(--primary)/0.25)] transition-all duration-300 overflow-hidden"
                    >
                      {/* Poster Cover Box (Compact Aspect on Mobile) */}
                      <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] overflow-hidden bg-zinc-900">
                        <img
                          src={item.mangaCover}
                          alt={item.mangaTitle}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        {/* Gradient Scrim */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />

                        {/* Top Floating Badges: Type on left, Discard X on right */}
                        <div className="absolute top-1.5 sm:top-2 inset-x-1.5 sm:inset-x-2 flex items-center justify-between z-20">
                          {isMounted && (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-black/90 text-primary border border-white/20 text-[8px] sm:text-[9px] font-black uppercase tracking-wider backdrop-blur-md">
                              {item.mangaType}
                            </span>
                          )}
                          {isMounted && (
                            <button
                              type="button"
                              onClick={(e) => handleDiscardHistory(e, item.mangaId)}
                              className="p-1 rounded-full bg-black/80 hover:bg-rose-600 text-white/70 hover:text-white border border-white/20 backdrop-blur-md transition-all shadow-md active:scale-90 cursor-pointer"
                              title="Remove from Continue Reading"
                              aria-label="Remove"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Center Hover Resume Action */}
                        <Link
                          href={`/manga/${item.mangaId}/read/${item.chapterId}`}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                          title={`Resume Ch. ${item.chapterNumber}`}
                        >
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/40 scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
                          </div>
                        </Link>

                        {/* Bottom Chapter & Progress Overlay on Poster */}
                        <div className="absolute bottom-1 sm:bottom-1.5 inset-x-1.5 sm:inset-x-2 z-10 space-y-0.5 sm:space-y-1">
                          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black text-white drop-shadow">
                            <span className="text-primary font-mono bg-black/85 px-1.5 py-0.5 rounded border border-white/10 text-[9px] sm:text-[11px]">
                              Ch. {item.chapterNumber}
                            </span>
                            {item.totalPages > 1 && (
                              <span className="text-white/80 text-[8px] sm:text-[10px] bg-black/70 px-1 py-0.5 rounded">
                                {item.pageNumber}/{item.totalPages}
                              </span>
                            )}
                          </div>
                          {item.totalPages > 1 && (
                            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Title & Action Row */}
                      <div className="p-2 sm:p-3 flex flex-col justify-between flex-1 gap-1.5 sm:gap-2 bg-zinc-950">
                        <Link
                          href={`/manga/${item.mangaId}`}
                          className="font-black text-[11px] sm:text-sm text-white line-clamp-1 hover:text-primary transition-colors block"
                          title={item.mangaTitle}
                        >
                          {item.mangaTitle}
                        </Link>

                        <div className="flex items-center gap-1 sm:gap-1.5 pt-1 border-t border-white/[0.06]">
                          <Link
                            href={`/manga/${item.mangaId}/read/${item.chapterId}`}
                            className="flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-primary text-primary-foreground text-[10px] sm:text-xs font-black shadow-md shadow-primary/25 flex items-center justify-center gap-1 active:scale-95 transition-all hover:opacity-90 touch-manipulation cursor-pointer"
                            title={`Resume Reading Chapter ${item.chapterNumber}`}
                          >
                            <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current shrink-0" />
                            <span className="truncate">Resume</span>
                          </Link>

                          <Link
                            href={`/manga/${item.mangaId}`}
                            className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-primary transition-all flex items-center justify-center active:scale-95 touch-manipulation cursor-pointer shrink-0"
                            title="Open Manga Details"
                            aria-label="Open Manga Details"
                          >
                            <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* View All Open Page Button (Only shows if more than 2 rows exist) */}
              {isMounted && history.length > 6 && (
                <div className="flex justify-center pt-2">
                  <Link
                    href="/manga/continue-reading"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 text-primary border border-primary/30 hover:border-primary font-black text-xs sm:text-sm transition-all shadow-lg active:scale-95 touch-manipulation"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>View All Continue Reading ({history.length})</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* SEARCH RESULTS VIEW (with Infinite Scroll) */}
          {debouncedSearch.trim() ? (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Search Results for &quot;{debouncedSearch}&quot;
                </h2>
                <span className="text-xs text-primary font-bold">
                  {isSearching ? "Searching..." : `${searchResults.length} titles`}
                </span>
              </div>

              {isSearching ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                    {searchResults.map((item) => (
                      <MangaCard key={item.id} item={item} showBadges={isMounted} />
                    ))}
                  </div>

                  {/* Infinite Scroll Sentinel */}
                  <div ref={sentinelRef} className="py-8 flex items-center justify-center">
                    {isLoadingMore && (
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading more results...</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-20 bg-white/[0.02] border border-white/[0.06] rounded-3xl p-8">
                  <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">No manga found</h3>
                  <p className="text-sm text-white/50">Try searching for a different title or author.</p>
                </div>
              )}
            </section>
          ) : selectedGenre || selectedType !== "all" ? (
            /* FILTERED GENRE / TYPE VIEW (Infinite Scroll & Accurate Titles) */
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {activeGenreObj?.label
                      ? `${activeGenreObj.label} ${selectedType === "manhwa" ? "Manhwa" : selectedType === "manga" ? "Manga" : "Titles"}`
                      : selectedType === "manhwa"
                      ? "Trending Korean Manhwas"
                      : selectedType === "manga"
                      ? "Trending Japanese Mangas"
                      : "Filtered Series"}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 font-semibold mt-0.5">
                    {selectedType === "manhwa"
                      ? `Real-time Korean Manhwa ${activeGenreObj?.label ? `in ${activeGenreObj.label}` : "series"}`
                      : selectedType === "manga"
                      ? `Real-time Japanese Manga ${activeGenreObj?.label ? `in ${activeGenreObj.label}` : "series"}`
                      : `Equal 50/50 mix of trending Manga & Manhwa ${activeGenreObj?.label ? `in ${activeGenreObj.label}` : ""}`}
                  </p>
                </div>
                <span className="text-xs text-primary font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/30">
                  {isMounted ? (isGenreLoading ? "Loading..." : `${genreResults.length} loaded`) : ""}
                </span>
              </div>

              {isGenreLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                    {genreResults.map((item) => (
                      <MangaCard key={item.id} item={item} showBadges={isMounted} />
                    ))}
                  </div>

                  {/* Infinite Scroll Sentinel */}
                  <div ref={sentinelRef} className="py-8 flex items-center justify-center">
                    {isLoadingMore && (
                      <div className="flex items-center gap-2 text-xs font-black text-primary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading more {activeGenreObj?.label || "series"}...</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          ) : (
            /* DEFAULT 3 REAL-TIME MODULAR SECTIONS */
            <>
              {/* SECTION 1: TRENDING NOW (Loads and appears first!) */}
              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Trending Now
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-primary/80">
                    {isMounted && "Real-Time Picks"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {isTrendingNowLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                      ))
                    : trendingNow.map((item) => (
                        <MangaCard key={item.id} item={item} showBadges={isMounted} />
                      ))}
                </div>
              </section>

              {/* SECTION 2: TRENDING MANHWAS (Loads and appears as soon as ready) */}
              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-5 h-5 text-primary" />
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Trending Manhwas
                    </h2>
                  </div>
                  <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/30">
                    {isMounted && "Korean Manhwa"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {isTrendingManhwasLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                      ))
                    : trendingManhwas.map((item) => (
                        <MangaCard key={item.id} item={item} showBadges={isMounted} />
                      ))}
                </div>
              </section>

              {/* SECTION 3: TRENDING MANGAS (Loads and appears as soon as ready) */}
              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Trending Mangas
                    </h2>
                  </div>
                  <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/30">
                    {isMounted && "Japanese Manga"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {isTrendingMangasLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                      ))
                    : trendingMangas.map((item) => (
                        <MangaCard key={item.id} item={item} showBadges={isMounted} />
                      ))}
                </div>
              </section>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
