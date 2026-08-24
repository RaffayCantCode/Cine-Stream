"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { MangaCard } from "@/components/manga/MangaCard";
import { MangaItem } from "@/lib/manga-fetch";
import { 
  getMangaHistory, 
  removeMangaProgress, 
  syncMangaHistoryFromServer, 
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

const GENRES = [
  { label: "All", id: "", name: "" },
  { label: "Action", id: "391b0423-d847-456f-aff0-8b040c0d0b04", name: "Action" },
  { label: "Romance", id: "423e2eae-a7a2-4a8b-ac03-a8351462d71d", name: "Romance" },
  { label: "Fantasy", id: "cdc58593-87dd-415e-bbc0-2ec27bf404cc", name: "Fantasy" },
  { label: "Isekai", id: "ace04997-f6bd-4329-856c-70ab7742f351", name: "Isekai" },
  { label: "Supernatural", id: "eabc54f9-f450-482a-b7e6-8c467a80b852", name: "Supernatural" },
  { label: "Sci-Fi", id: "256c8bd9-4904-4503-8b03-d40d1f250238", name: "Sci-fi" },
  { label: "Comedy", id: "4d32cc48-9f00-4cca-9b5a-a839f0764984", name: "Comedy" },
  { label: "Mystery", id: "ee9683c4-0415-499b-aa2f-f1804aad49ca", name: "Mystery" },
  { label: "Drama", id: "b9af3a63-f058-444f-a20d-83864c053c83", name: "Drama" },
  { label: "Slice of Life", id: "e5301a23-ebd9-49dd-a0cb-2add944c7fe9", name: "Slice of Life" },
];

const ITEMS_PER_PAGE = 24;

export interface MangaHomeClientProps {
  initialTrending?: MangaItem[];
  initialManhwas?: MangaItem[];
  initialMangas?: MangaItem[];
}

export default function MangaHomeClient({
  initialTrending = [],
  initialManhwas = [],
  initialMangas = [],
}: MangaHomeClientProps = {}) {
  const [trendingNow, setTrendingNow] = useState<MangaItem[]>(() =>
    initialTrending.length > 0 ? shuffleArray<MangaItem>(initialTrending).slice(0, 15) : []
  );
  const [isTrendingNowLoading, setIsTrendingNowLoading] = useState(initialTrending.length === 0);

  const [trendingManhwas, setTrendingManhwas] = useState<MangaItem[]>(() =>
    initialManhwas.length > 0 ? shuffleArray<MangaItem>(initialManhwas).slice(0, 15) : []
  );
  const [isTrendingManhwasLoading, setIsTrendingManhwasLoading] = useState(initialManhwas.length === 0);

  const [trendingMangas, setTrendingMangas] = useState<MangaItem[]>(() =>
    initialMangas.length > 0 ? shuffleArray<MangaItem>(initialMangas).slice(0, 15) : []
  );
  const [isTrendingMangasLoading, setIsTrendingMangasLoading] = useState(initialMangas.length === 0);

  const [history, setHistory] = useState<MangaReadingProgress[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MangaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Simplified type filter: All, Manhwa, Manga
  const [selectedType, setSelectedType] = useState<"all" | "manhwa" | "manga">("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [genreResults, setGenreResults] = useState<MangaItem[]>([]);
  const [isGenreLoading, setIsGenreLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageOffset, setPageOffset] = useState(0);

  // Page shell is immediately ready for instant navigation feel
  usePageContentReady(true);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const clientCache = useRef<Map<string, MangaItem[]>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSearchIdRef = useRef<number>(0);

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

  // Sync Reading History from Local & DB
  const refreshHistory = useCallback(async () => {
    setHistory(getMangaHistory());
    const synced = await syncMangaHistoryFromServer();
    setHistory(synced);
  }, []);

  useEffect(() => {
    refreshHistory();
    window.addEventListener("cinestream:manga-history-updated", () => setHistory(getMangaHistory()));
    return () => window.removeEventListener("cinestream:manga-history-updated", () => setHistory(getMangaHistory()));
  }, [refreshHistory]);

  // Handle Discard item from Continue Reading
  const handleDiscardHistory = (e: React.MouseEvent, mangaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeMangaProgress(mangaId);
    setHistory((prev) => prev.filter((item) => item.mangaId !== mangaId));
  };

  // Snappy 250ms debounce for live search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modular & Incremental Progressive Load for top speed
  useEffect(() => {
    let isMounted = true;

    // 1. Load Trending Now if not provided
    if (initialTrending.length === 0) {
      fetchJson<{ success: boolean; items: MangaItem[] }>("/api/manga/trending?limit=32")
        .then((data) => {
          if (!isMounted) return;
          const items = data.items || [];
          if (items.length > 0) {
            setTrendingNow(shuffleArray<MangaItem>(items).slice(0, 15));
          }
        })
        .catch((err) => console.warn("Failed to load trending now:", err))
        .finally(() => {
          if (isMounted) setIsTrendingNowLoading(false);
        });
    }

    // 2. Load Trending Manhwas if not provided
    if (initialManhwas.length === 0) {
      fetchJson<{ success: boolean; items: MangaItem[] }>("/api/manga/manhwa?limit=32")
        .then((data) => {
          if (!isMounted) return;
          const items = data.items || [];
          if (items.length > 0) {
            setTrendingManhwas(shuffleArray<MangaItem>(items).slice(0, 15));
          }
        })
        .catch((err) => console.warn("Failed to load trending manhwas:", err))
        .finally(() => {
          if (isMounted) setIsTrendingManhwasLoading(false);
        });
    }

    // 3. Load Trending Mangas if not provided
    if (initialMangas.length === 0) {
      fetchJson<{ success: boolean; items: MangaItem[] }>("/api/manga/latest?limit=32")
        .then((data) => {
          if (!isMounted) return;
          const items = data.items || [];
          if (items.length > 0) {
            setTrendingMangas(shuffleArray<MangaItem>(items).slice(0, 15));
          }
        })
        .catch((err) => console.warn("Failed to load trending mangas:", err))
        .finally(() => {
          if (isMounted) setIsTrendingMangasLoading(false);
        });
    }

    // Background pre-fetch top genres for instant 0ms switching
    const timer = setTimeout(() => {
      if (!isMounted) return;
      ["Action", "Fantasy", "Romance"].forEach(async (gName) => {
        const cacheKey = `genre_${gName}_all_0`;
        if (!clientCache.current.has(cacheKey)) {
          try {
            const res = await fetch(`/api/manga/search?limit=24&offset=0&genreName=${encodeURIComponent(gName)}&sortBy=followedCount`);
            if (res.ok) {
              const d = await res.json();
              if (d.items) clientCache.current.set(cacheKey, d.items);
            }
          } catch {}
        }
      });
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

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

    const genreObj = GENRES.find((g) => g.id === selectedGenre);
    const genreName = genreObj?.name || "";
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
        const genreParam = selectedGenre ? `&genreId=${selectedGenre}` : "";
        const genreNameParam = genreName ? `&genreName=${encodeURIComponent(genreName)}` : "";

        const data = await fetchJson<{ success: boolean; items: MangaItem[] }>(
          `/api/manga/search?limit=${ITEMS_PER_PAGE}&offset=0${typeParam}${genreParam}${genreNameParam}&sortBy=followedCount`
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
        const genreObj = GENRES.find((g) => g.id === selectedGenre);
        const genreParam = selectedGenre ? `&genreId=${selectedGenre}` : "";
        const genreNameParam = genreObj?.name ? `&genreName=${encodeURIComponent(genreObj.name)}` : "";

        const data = await fetchJson<{ success: boolean; items: MangaItem[] }>(
          `/api/manga/search?limit=${ITEMS_PER_PAGE}&offset=${nextOffset}${typeParam}${genreParam}${genreNameParam}&sortBy=followedCount`
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
                  onClick={() => setSelectedType(t)}
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
                    onClick={() => setSelectedGenre(isActive ? "" : g.id)}
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

          {/* CONTINUE READING SECTION (with Continue + Open Series buttons and Discard X button) */}
          {!debouncedSearch.trim() && history.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bookmark className="w-5 h-5 text-primary" />
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    Continue Reading
                  </h2>
                </div>
                <span className="text-xs text-primary font-black bg-primary/10 px-3 py-1 rounded-full border border-primary/30">
                  {history.length} In Progress
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {history.map((item) => (
                  <div
                    key={item.mangaId}
                    className="group relative flex flex-col justify-between p-4 rounded-3xl bg-zinc-900/90 border border-white/[0.08] hover:border-primary/50 hover:shadow-[0_12px_32px_hsl(var(--primary)/0.2)] transition-all duration-300 overflow-hidden"
                  >
                    {/* Top Discard (Cross X) Button — Only shows after page has mounted & loaded */}
                    {!isTrendingNowLoading && (
                      <button
                        type="button"
                        onClick={(e) => handleDiscardHistory(e, item.mangaId)}
                        className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/80 hover:bg-rose-600 text-white/60 hover:text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-lg opacity-80 hover:opacity-100 hover:scale-105 active:scale-95"
                        title="Remove from Continue Reading"
                        aria-label="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Content Details */}
                    <div className="flex gap-3.5 items-start">
                      <Link
                        href={`/manga/${item.mangaId}`}
                        className="relative w-20 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden bg-muted/40 shadow-md border border-white/10 block group-hover:scale-105 transition-transform"
                      >
                        <img
                          src={item.mangaCover}
                          alt={item.mangaTitle}
                          className="w-full h-full object-cover"
                        />
                      </Link>

                      <div className="flex-1 flex flex-col justify-between min-w-0 pr-6">
                        <div>
                          <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                            {item.mangaType}
                          </span>
                          <Link
                            href={`/manga/${item.mangaId}`}
                            className="text-sm sm:text-base font-black text-white truncate block hover:text-primary transition-colors mt-0.5"
                            title={item.mangaTitle}
                          >
                            {item.mangaTitle}
                          </Link>
                          <div className="flex flex-col gap-0.5 mt-1.5">
                            <span className="text-xs text-white/80 font-bold">
                              Last read: <strong className="text-primary">Ch. {item.chapterNumber}</strong>
                            </span>
                            {item.totalPages > 1 && (
                              <span className="text-[11px] text-white/50 font-medium">
                                Page {item.pageNumber} of {item.totalPages}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Row: [Continue / Resume] + [Open Series] */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                      {/* Button 1: Continue Reading (Direct to Chapter) */}
                      <Link
                        href={`/manga/${item.mangaId}/read/${item.chapterId}`}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-black transition-all shadow-md shadow-primary/25 flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer hover:opacity-90"
                        title={`Resume Reading Chapter ${item.chapterNumber}`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume Ch. {item.chapterNumber}</span>
                      </Link>

                      {/* Button 2: Open Series (Opens Details Page) */}
                      <Link
                        href={`/manga/${item.mangaId}`}
                        className="py-2.5 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white hover:text-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer shrink-0"
                        title="Open Manga Details Page"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                        <span>Open</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
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
                      <MangaCard key={item.id} item={item} />
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
                  {isGenreLoading ? "Loading..." : `${genreResults.length} loaded`}
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
                      <MangaCard key={item.id} item={item} />
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
                  <span className="text-xs font-bold text-primary/80">Real-Time Picks</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {isTrendingNowLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                      ))
                    : trendingNow.map((item) => (
                        <MangaCard key={item.id} item={item} />
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
                    Korean Manhwa
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {isTrendingManhwasLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                      ))
                    : trendingManhwas.map((item) => (
                        <MangaCard key={item.id} item={item} />
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
                    Japanese Manga
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 ultrawide:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
                  {isTrendingMangasLoading
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] animate-pulse" />
                      ))
                    : trendingMangas.map((item) => (
                        <MangaCard key={item.id} item={item} />
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
