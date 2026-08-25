"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MangaItem, MangaChapter, ChapterPagesData } from "@/lib/manga-fetch";
import {
  getLocalMangaProgress,
  saveLocalMangaProgress,
  fetchServerMangaProgress,
  saveServerMangaProgress,
  markChapterAsRead,
} from "@/lib/manga-history";
import { fetchJson } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronRight,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  CheckCircle2,
  List,
  AlertCircle,
  Sun,
  SunMedium,
  SunDim,
  X,
  Check,
} from "lucide-react";
import { usePageContentReady } from "@/lib/pageLoad";

export interface MangaReaderClientProps {
  mangaId: string;
  chapterId: string;
  initialManga?: MangaItem | null;
  initialChapters?: MangaChapter[];
  initialPages?: ChapterPagesData | null;
}

export default function MangaReaderClient({
  mangaId,
  chapterId,
  initialManga = null,
  initialChapters = [],
  initialPages = null,
}: MangaReaderClientProps) {
  const { data: session, status: authStatus } = useSession();
  const isAuthed = authStatus === "authenticated" && !!session?.user?.id;

  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTitle = searchParams.get("title") || "";
  const queryCh = searchParams.get("ch") || "";

  const [manga, setManga] = useState<MangaItem | null>(initialManga);
  const [chapters, setChapters] = useState<MangaChapter[]>(initialChapters);
  const [pagesData, setPagesData] = useState<ChapterPagesData | null>(initialPages);
  const [isLoading, setIsLoading] = useState(!initialPages);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(50); // 50% default for desktop, 100% for mobile
  const [brightness, setBrightness] = useState<number>(100); // 30% to 150%
  const [brightnessPickerOpen, setBrightnessPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const initialSaveDoneRef = useRef(false);
  const lastSavedPageRef = useRef<number>(1);

  usePageContentReady(!isLoading);

  // Load Saved Preferences (Brightness & Zoom Level with 50% desktop / 100% mobile default)
  useEffect(() => {
    try {
      const isMobile = window.innerWidth < 768;
      const defaultZoom = isMobile ? 100 : 50;
      const savedZoom = localStorage.getItem("cinestream.manga_zoom_level");
      if (savedZoom) {
        const parsed = parseInt(savedZoom, 10);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 200) {
          const cleanZoom = Math.round(parsed / 10) * 10;
          setZoomLevel(cleanZoom);
        } else {
          setZoomLevel(defaultZoom);
        }
      } else {
        setZoomLevel(defaultZoom);
      }
      const savedBrightness = localStorage.getItem("cinestream.manga_brightness");
      if (savedBrightness) {
        const parsed = parseInt(savedBrightness, 10);
        if (!isNaN(parsed) && parsed >= 30 && parsed <= 150) {
          setBrightness(parsed);
        }
      }
    } catch {}
  }, []);

  const handleSetBrightness = (val: number) => {
    const clamped = Math.max(30, Math.min(150, val));
    setBrightness(clamped);
    try {
      localStorage.setItem("cinestream.manga_brightness", String(clamped));
    } catch {}
  };

  // Listen to standard fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Fetch Manga Details, Chapter List, and Chapter Pages
  const loadChapter = useCallback(async () => {
    if (pagesData && pagesData.chapterId === chapterId && manga && chapters.length > 0) {
      setIsLoading(false);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    setIsLoading(true);
    setError(null);

    try {
      const titleParam = queryTitle ? `?title=${encodeURIComponent(queryTitle)}&ch=${encodeURIComponent(queryCh)}` : "";

      const fetches: Promise<any>[] = [];
      if (!manga) fetches.push(fetchJson<{ success: boolean; item: MangaItem }>(`/api/manga/details/${mangaId}`));
      else fetches.push(Promise.resolve({ success: true, item: manga }));

      if (chapters.length === 0) fetches.push(fetchJson<{ success: boolean; chapters: MangaChapter[] }>(`/api/manga/chapters/${mangaId}?order=asc&limit=500`));
      else fetches.push(Promise.resolve({ success: true, chapters }));

      if (!pagesData || pagesData.chapterId !== chapterId) {
        fetches.push(fetchJson<{ success: boolean; pageUrls: string[]; dataSaverUrls: string[] }>(`/api/manga/chapter/${chapterId}${titleParam}`));
      } else {
        fetches.push(Promise.resolve({ success: true, pageUrls: pagesData.pageUrls, dataSaverUrls: pagesData.dataSaverUrls }));
      }

      const [detailsData, chaptersData, pagesRes] = await Promise.all(fetches);

      if (detailsData.success && detailsData.item) {
        setManga(detailsData.item);
      }

      if (chaptersData.success && chaptersData.chapters) {
        setChapters(chaptersData.chapters || []);
      }

      if (pagesRes.success && Array.isArray(pagesRes.pageUrls) && pagesRes.pageUrls.length > 0) {
        setPagesData({
          chapterId,
          chapterNumber: queryCh || "",
          mangaId,
          pageUrls: pagesRes.pageUrls,
          dataSaverUrls: pagesRes.dataSaverUrls || [],
        });
      } else {
        setError("Could not retrieve chapter images. The chapter may be offline or still uploading.");
      }
    } catch (err: any) {
      console.error("Failed to load chapter:", err);
      setError(err.message || "Failed to load chapter pages");
    } finally {
      setIsLoading(false);
    }
  }, [mangaId, chapterId, queryTitle, queryCh, manga, chapters, pagesData]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  // Current Chapter Metadata
  const currentChapter = useMemo(() => {
    const cleanTarget = chapterId.replace(/^(wc|asura)-/, "");
    return (
      chapters.find(
        (c) =>
          c.id === chapterId ||
          c.id.replace(/^(wc|asura)-/, "") === cleanTarget
      ) || null
    );
  }, [chapters, chapterId]);

  // Sorted Chapters List (Ascending 1, 2, 3...)
  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0));
  }, [chapters]);

  // Previous and Next Chapters
  const currentChapterIdx = useMemo(() => {
    const cleanTarget = chapterId.replace(/^(wc|asura)-/, "");
    return sortedChapters.findIndex(
      (c) =>
        c.id === chapterId ||
        c.id.replace(/^(wc|asura)-/, "") === cleanTarget
    );
  }, [sortedChapters, chapterId]);

  const nextChapter = useMemo(() => {
    return currentChapterIdx >= 0 && currentChapterIdx < sortedChapters.length - 1
      ? sortedChapters[currentChapterIdx + 1]
      : null;
  }, [sortedChapters, currentChapterIdx]);

  // Total pages count
  const totalPages = pagesData?.pageUrls?.length || 0;

  // Persist Reading Progress strictly based on active authentication state
  const persistProgress = useCallback(
    (page: number) => {
      const resolvedTitle = manga?.title || initialManga?.title || queryTitle || "Manga";
      const resolvedCover = manga?.coverImage || initialManga?.coverImage || "/icon-512.png";
      const rawType = manga?.type || initialManga?.type;
      const resolvedType = (rawType === "manhwa" || rawType === "manhua") ? rawType : "manga";
      const resolvedChapterNumber = currentChapter?.chapterNumber || queryCh || "1";
      const resolvedChapterTitle = currentChapter?.title || null;
      const resolvedTotalPages = totalPages > 0 ? totalPages : 1;

      const payload = {
        mangaId,
        mangaTitle: resolvedTitle,
        mangaCover: resolvedCover,
        mangaType: resolvedType as "manga" | "manhwa" | "manhua",
        chapterId,
        chapterNumber: resolvedChapterNumber,
        chapterTitle: resolvedChapterTitle,
        pageNumber: page > 0 ? page : 1,
        totalPages: resolvedTotalPages,
        nextChapterId: nextChapter ? nextChapter.id : null,
        nextChapterNumber: nextChapter ? nextChapter.chapterNumber : null,
      };

      if (isAuthed) {
        saveServerMangaProgress(payload);
      } else {
        saveLocalMangaProgress(payload);
      }

      markChapterAsRead(mangaId, chapterId, resolvedChapterNumber);
    },
    [isAuthed, manga, initialManga, queryTitle, currentChapter, queryCh, totalPages, mangaId, chapterId, nextChapter]
  );

  // Restore saved page position and immediately save current entry on mount
  useEffect(() => {
    if (authStatus === "loading") return;

    let cancelled = false;

    const initReadingState = async () => {
      let savedPage = 1;

      if (isAuthed) {
        const serverSaved = await fetchServerMangaProgress(mangaId);
        if (cancelled) return;
        if (serverSaved && (serverSaved.chapterId === chapterId || serverSaved.chapterId.replace(/^(wc|asura)-/, "") === chapterId.replace(/^(wc|asura)-/, "")) && serverSaved.pageNumber > 0) {
          savedPage = (totalPages > 0 && serverSaved.pageNumber <= totalPages) ? serverSaved.pageNumber : 1;
        }
      } else {
        const localSaved = getLocalMangaProgress(mangaId);
        if (localSaved && (localSaved.chapterId === chapterId || localSaved.chapterId.replace(/^(wc|asura)-/, "") === chapterId.replace(/^(wc|asura)-/, "")) && localSaved.pageNumber > 0) {
          savedPage = (totalPages > 0 && localSaved.pageNumber <= totalPages) ? localSaved.pageNumber : 1;
        }
      }

      if (!cancelled) {
        if (savedPage > 1) {
          setCurrentPage(savedPage);
          lastSavedPageRef.current = savedPage;
        }
        persistProgress(savedPage);
        initialSaveDoneRef.current = true;
      }
    };

    initReadingState();

    return () => {
      cancelled = true;
    };
  }, [authStatus, isAuthed, mangaId, chapterId, totalPages, persistProgress]);

  // Preload Next 3 Pages in Memory
  useEffect(() => {
    if (!pagesData?.pageUrls) return;
    const urls = pagesData.pageUrls;
    const nextIndices = [currentPage, currentPage + 1, currentPage + 2].filter((i) => i < urls.length);
    for (const idx of nextIndices) {
      const img = new Image();
      img.src = urls[idx];
    }
  }, [pagesData, currentPage]);

  // Webtoon Scroll Intersection Observer for Current Page tracking
  useEffect(() => {
    if (totalPages <= 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute("data-page") || "1", 10);
            if (pageNum && pageNum !== currentPage) {
              setCurrentPage(pageNum);
              if (initialSaveDoneRef.current && pageNum !== lastSavedPageRef.current) {
                lastSavedPageRef.current = pageNum;
                persistProgress(pageNum);
              }
            }
          }
        }
      },
      { threshold: 0.4 }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [totalPages, currentPage, persistProgress]);

  // Zoom Handler Functions (+ / - / reset in clean steps of 10)
  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => {
      const base = Math.floor(prev / 10) * 10;
      const next = Math.min(200, base + 10);
      try { localStorage.setItem("cinestream.manga_zoom_level", String(next)); } catch {}
      return next;
    });
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => {
      const base = Math.ceil(prev / 10) * 10;
      const next = Math.max(20, base - 10);
      try { localStorage.setItem("cinestream.manga_zoom_level", String(next)); } catch {}
      return next;
    });
  };

  const handleZoomReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const targetZoom = isMobile ? 100 : 50;
    setZoomLevel(targetZoom);
    try { localStorage.setItem("cinestream.manga_zoom_level", String(targetZoom)); } catch {}
  };

  // Proper Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (readerContainerRef.current?.requestFullscreen) {
        readerContainerRef.current.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        handleZoomReset();
      } else if (e.key === "[") {
        e.preventDefault();
        handleSetBrightness(brightness - 10);
      } else if (e.key === "]") {
        e.preventDefault();
        handleSetBrightness(brightness + 10);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Handle tap to toggle controls with touch drag discrimination
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length > 0) {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartPos.current.y);
      // Only toggle if tap wasn't a scroll or swipe
      if (dx < 10 && dy < 10) {
        setShowControls((prev) => !prev);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
        <p className="text-sm text-zinc-400 font-bold">Loading chapter pages...</p>
      </div>
    );
  }

  if (error || !pagesData || pagesData.pageUrls.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Chapter Temporarily Unavailable</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">{error || "Could not retrieve chapter images."}</p>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => loadChapter()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-black text-sm shadow-xl shadow-primary/30 active:scale-95 cursor-pointer touch-manipulation"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Loading Chapter</span>
          </button>
          <Link
            href={`/manga/${mangaId}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-sm border border-white/10 active:scale-95 cursor-pointer touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Chapter List</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={readerContainerRef}
      className="min-h-screen w-full bg-black text-white flex flex-col select-none relative overflow-x-hidden"
    >
      {/* Sleek Top Micro Progress Bar (Zero Intrusion) */}
      {totalPages > 0 && (
        <div
          className="fixed top-0 left-0 h-[2.5px] bg-primary z-[60] transition-[width] duration-150 pointer-events-none shadow-[0_0_8px_hsl(var(--primary))]"
          style={{
            width: `${Math.min(100, Math.round((currentPage / totalPages) * 100))}%`,
          }}
        />
      )}

      {/* TOP FLOATING NAVIGATION BAR (Clean, Responsive & Fully Accessible on Mobile & Desktop) */}
      <header
        style={{
          paddingTop: "max(0.6rem, env(safe-area-inset-top, 0.6rem))",
          paddingBottom: "0.6rem",
          paddingLeft: "max(0.6rem, env(safe-area-inset-left, 0.6rem))",
          paddingRight: "max(0.6rem, env(safe-area-inset-right, 0.6rem))",
        }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          showControls ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        } bg-black/95 backdrop-blur-2xl border-b border-white/10 px-2.5 sm:px-6 flex items-center justify-between gap-2 shadow-2xl`}
      >
        {/* Left: Back & (Desktop-only) Title/Chapter */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          <Link
            href={`/manga/${mangaId}`}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-primary/20 hover:text-primary text-white/80 transition-colors shrink-0 touch-manipulation active:scale-90"
            title="Back to Details"
          >
            <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </Link>

          <div className="hidden md:flex flex-col min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[180px] md:max-w-xs">
              {manga?.title || queryTitle || "Manga"}
            </h1>
            <span className="text-[10px] sm:text-[11px] text-primary font-bold truncate">
              {currentChapter ? currentChapter.title || `Chapter ${currentChapter.chapterNumber}` : queryCh ? `Chapter ${queryCh}` : `Chapter`}
            </span>
          </div>
        </div>

        {/* Center: Chapter Jump Picker + Brightness Adjuster */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Chapter Dropdown Jump Picker */}
          <div className="relative">
            <button
              onClick={() => {
                setChapterPickerOpen(!chapterPickerOpen);
                setBrightnessPickerOpen(false);
              }}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer touch-manipulation active:scale-95"
            >
              <List className="w-3.5 h-3.5 text-primary" />
              <span>Ch. {currentChapter?.chapterNumber || queryCh || "1"}</span>
            </button>

            {/* Click-away backdrop overlay */}
            {chapterPickerOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
                onClick={() => setChapterPickerOpen(false)}
              />
            )}

            {/* Chapter Jump Menu */}
            {chapterPickerOpen && (
              <div className="fixed left-3 right-3 sm:left-auto sm:-translate-x-1/4 sm:w-80 top-16 sm:top-full mt-2 max-h-[75vh] sm:max-h-96 flex flex-col bg-[#0c0d14] border-2 border-primary/50 rounded-2xl p-3 shadow-[0_25px_80px_rgba(0,0,0,0.98)] z-50">
                <div className="flex items-center justify-between px-2 pb-2.5 mb-2 border-b border-white/10 shrink-0">
                  <span className="text-xs font-black uppercase tracking-wider text-primary">
                    Jump to Chapter ({chapters.length})
                  </span>
                  <button
                    onClick={() => setChapterPickerOpen(false)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                    aria-label="Close chapter menu"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1">
                  {[...sortedChapters].reverse().map((ch) => {
                    const isCurrent = ch.id === chapterId;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setChapterPickerOpen(false);
                          router.push(`/manga/${mangaId}/read/${ch.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(ch.chapterNumber)}`);
                        }}
                        className={`text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between touch-manipulation border ${
                          isCurrent
                            ? "bg-primary text-primary-foreground font-black border-primary shadow-lg shadow-primary/30"
                            : "bg-white/[0.04] text-zinc-100 hover:bg-primary hover:text-black border-white/5"
                        }`}
                      >
                        <span className="truncate">{ch.title || `Chapter ${ch.chapterNumber}`}</span>
                        {isCurrent ? (
                          <CheckCircle2 className="w-4 h-4 text-primary-foreground shrink-0 ml-2" />
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-mono shrink-0 ml-2">Ch. {ch.chapterNumber}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BRIGHTNESS CONTROL (Compact & Responsive for Desktop + Mobile) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setBrightnessPickerOpen(!brightnessPickerOpen);
                setChapterPickerOpen(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer touch-manipulation active:scale-95 ${
                brightness !== 100
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white"
              }`}
              title="Adjust Reader Brightness"
              aria-label="Adjust Reader Brightness"
            >
              {brightness < 70 ? (
                <SunDim className="w-3.5 h-3.5 text-primary" />
              ) : brightness > 110 ? (
                <Sun className="w-3.5 h-3.5 text-primary" />
              ) : (
                <SunMedium className="w-3.5 h-3.5 text-primary" />
              )}
              <span className="font-mono text-[11px] sm:text-xs">{brightness}%</span>
            </button>

            {/* Click-away backdrop overlay */}
            {brightnessPickerOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={() => setBrightnessPickerOpen(false)}
              />
            )}

            {/* Brightness Popover Menu */}
            {brightnessPickerOpen && (
              <div className="fixed left-4 right-4 sm:left-auto sm:-translate-x-1/3 sm:w-80 top-16 sm:top-full mt-2 flex flex-col bg-[#0c0d14] border-2 border-primary/60 rounded-2xl p-4 shadow-[0_25px_80px_rgba(0,0,0,0.98)] z-50 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SunMedium className="w-4 h-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      Brightness
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-primary font-mono bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/30">
                      {brightness}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setBrightnessPickerOpen(false)}
                      className="p-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/30 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      title="Apply & Close"
                      aria-label="Close Brightness Popup"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                </div>

                {/* Range Slider */}
                <div className="flex items-center gap-3 py-1">
                  <SunDim className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="range"
                    min="30"
                    max="150"
                    step="5"
                    value={brightness}
                    onChange={(e) => handleSetBrightness(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <Sun className="w-4 h-4 text-primary shrink-0" />
                </div>

                {/* Quick Preset Buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-white/10">
                  {[50, 75, 100, 125].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSetBrightness(preset)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        brightness === preset
                          ? "bg-primary text-primary-foreground font-black shadow-md shadow-primary/30 scale-102"
                          : "bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Zoom Controls, Fullscreen & Next Chapter Button */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Zoom In / Out Controls (Bold & Prominent) */}
          <div className="flex items-center bg-[#141622] border-2 border-primary/40 hover:border-primary/80 rounded-2xl p-1 shadow-lg shadow-black/50 transition-all">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 20}
              className="p-1.5 sm:p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 text-white/90 hover:text-primary disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              title="Zoom Out (-10%)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              onClick={handleZoomReset}
              className="px-2 sm:px-2.5 py-1 text-xs sm:text-sm font-black text-primary font-mono tracking-tight hover:bg-primary/15 rounded-lg transition-all cursor-pointer touch-manipulation"
              title="Reset Zoom (50% Desktop / 100% Mobile)"
            >
              {zoomLevel}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1.5 sm:p-2 rounded-xl bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/50 hover:border-primary font-black shadow-md shadow-primary/20 hover:scale-105 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              title="Zoom In (+10%)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Fullscreen Button: Hidden on Mobile */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-primary transition-colors cursor-pointer touch-manipulation active:scale-90"
            title="Toggle Fullscreen (F)"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Next Chapter Button */}
          {nextChapter && (
            <Link
              href={`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-black shadow-lg shadow-primary/25 transition-all cursor-pointer shrink-0 touch-manipulation active:scale-95"
              title={`Next Chapter (Ch. ${nextChapter.chapterNumber})`}
            >
              <span className="hidden sm:inline">Next Ch.</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
            </Link>
          )}
        </div>
      </header>

      {/* MAIN READING CANVAS (Pure Continuous Vertical Scroll with Hardware-Accelerated Brightness & Zoom) */}
      <main
        style={{
          paddingTop: "max(4.5rem, calc(4.25rem + env(safe-area-inset-top, 0px)))",
          paddingBottom: "max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setShowControls((prev) => !prev)}
        className="flex-1 flex flex-col items-center justify-center min-h-screen w-full cursor-default overflow-x-auto"
      >
        <div
          style={{
            width: `${zoomLevel}%`,
            maxWidth: `${Math.max(360, Math.round(1400 * (zoomLevel / 100)))}px`,
            filter: brightness !== 100 ? `brightness(${brightness}%)` : undefined,
          }}
          className="flex flex-col items-center mx-auto transition-[width,filter] duration-150"
        >
          {pagesData.pageUrls.map((url, idx) => {
            const pageNum = idx + 1;
            return (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                  else pageRefs.current.delete(pageNum);
                }}
                className="relative w-full flex justify-center bg-black min-h-[400px] sm:min-h-[600px]"
              >
                <img
                  src={url}
                  alt={`Page ${pageNum}`}
                  referrerPolicy="no-referrer"
                  loading={pageNum <= 4 ? "eager" : "lazy"}
                  decoding="async"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.retried) {
                      target.dataset.retried = "true";
                      target.src = `${url}${url.includes("?") ? "&" : "?"}_retry=${Date.now()}`;
                    }
                  }}
                  className="w-full h-auto object-contain block select-none"
                />
                {/* Subtle Page Watermark */}
                <span className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md bg-black/70 text-[9px] text-white/60 backdrop-blur-md pointer-events-none font-bold z-10">
                  {pageNum} / {totalPages}
                </span>
              </div>
            );
          })}

          {/* END OF CHAPTER BANNER */}
          {totalPages > 0 && (
            <div className="w-full p-8 my-8 text-center bg-zinc-950 border border-white/10 rounded-3xl space-y-4 max-w-xl mx-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto border border-primary/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">
                Finished {currentChapter ? currentChapter.title || `Chapter ${currentChapter.chapterNumber}` : "Chapter"}!
              </h3>

              {nextChapter ? (
                <div className="pt-2">
                  <Link
                    href={`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`}
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-black text-sm shadow-xl shadow-primary/30 transition-all cursor-pointer touch-manipulation active:scale-95"
                  >
                    <span>Read Next Chapter {nextChapter.chapterNumber}</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-primary font-bold">
                  🎉 You are caught up with the latest released chapter!
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
