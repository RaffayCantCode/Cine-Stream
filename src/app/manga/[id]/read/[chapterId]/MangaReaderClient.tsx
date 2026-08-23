"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MangaItem, MangaChapter, ChapterPagesData } from "@/lib/manga-fetch";
import {
  saveMangaProgress,
  getMangaProgress,
  syncMangaHistoryFromServer,
  markChapterAsRead,
} from "@/lib/manga-history";
import { fetchJson } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  CheckCircle2,
  List,
  AlertCircle,
  Sparkles,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { usePageContentReady } from "@/lib/pageLoad";

type ReadingMode = "webtoon" | "single" | "double";
type ReadingDirection = "rtl" | "ltr"; // RTL = Right-to-Left (Manga), LTR = Left-to-Right

export default function MangaReaderClient({
  mangaId,
  chapterId,
}: {
  mangaId: string;
  chapterId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTitle = searchParams.get("title") || "";
  const queryCh = searchParams.get("ch") || "";

  const [manga, setManga] = useState<MangaItem | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [pagesData, setPagesData] = useState<ChapterPagesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [readingMode, setReadingMode] = useState<ReadingMode>("webtoon");
  const [readingDirection, setReadingDirection] = useState<ReadingDirection>("rtl");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 50% to 200%
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [widePages, setWidePages] = useState<Set<number>>(new Set());

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  usePageContentReady(!isLoading);

  // Load Saved Preferences (Reading Mode, Direction & Zoom Level)
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("cinestream.manga_reading_mode") as ReadingMode;
      if (savedMode === "webtoon" || savedMode === "single" || savedMode === "double") {
        setReadingMode(savedMode);
      }
      const savedDir = localStorage.getItem("cinestream.manga_reading_dir") as ReadingDirection;
      if (savedDir === "rtl" || savedDir === "ltr") {
        setReadingDirection(savedDir);
      }
      const savedZoom = localStorage.getItem("cinestream.manga_zoom_level");
      if (savedZoom) {
        const parsed = parseInt(savedZoom, 10);
        if (!isNaN(parsed) && parsed >= 50 && parsed <= 200) {
          setZoomLevel(parsed);
        }
      }
    } catch {}
  }, []);

  // Track wide/landscape images (aspect ratio > 1.15) for proper Double-Page spread handling
  const handleImageLoad = useCallback((pageNum: number, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > img.naturalHeight * 1.15) {
      setWidePages((prev) => {
        if (prev.has(pageNum)) return prev;
        const next = new Set(prev);
        next.add(pageNum);
        return next;
      });
    }
  }, []);

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
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    setIsLoading(true);
    setError(null);
    setPagesData(null);
    setWidePages(new Set());

    try {
      const titleParam = queryTitle ? `?title=${encodeURIComponent(queryTitle)}&ch=${encodeURIComponent(queryCh)}` : "";

      const [detailsData, chaptersData, pagesRes] = await Promise.all([
        fetchJson<{ success: boolean; item: MangaItem }>(`/api/manga/details/${mangaId}`),
        fetchJson<{ success: boolean; chapters: MangaChapter[] }>(`/api/manga/chapters/${mangaId}?order=asc&limit=500`),
        fetchJson<{ success: boolean; pageUrls: string[]; dataSaverUrls: string[] }>(`/api/manga/chapter/${chapterId}${titleParam}`),
      ]);

      if (detailsData.success && detailsData.item) {
        setManga(detailsData.item);
        // If manhwa or webtoon, enforce webtoon continuous vertical scroll by default
        if (detailsData.item.type === "manhwa" && !localStorage.getItem("cinestream.manga_reading_mode")) {
          setReadingMode("webtoon");
        }
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
  }, [mangaId, chapterId, queryTitle, queryCh]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  // Current Chapter Metadata
  const currentChapter = useMemo(() => {
    return chapters.find((c) => c.id === chapterId) || null;
  }, [chapters, chapterId]);

  // Sorted Chapters List (Ascending 1, 2, 3...)
  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0));
  }, [chapters]);

  // Previous and Next Chapters
  const currentChapterIdx = useMemo(() => {
    return sortedChapters.findIndex((c) => c.id === chapterId);
  }, [sortedChapters, chapterId]);

  const prevChapter = useMemo(() => {
    return currentChapterIdx > 0 ? sortedChapters[currentChapterIdx - 1] : null;
  }, [sortedChapters, currentChapterIdx]);

  const nextChapter = useMemo(() => {
    return currentChapterIdx >= 0 && currentChapterIdx < sortedChapters.length - 1
      ? sortedChapters[currentChapterIdx + 1]
      : null;
  }, [sortedChapters, currentChapterIdx]);

  // Total pages count
  const totalPages = pagesData?.pageUrls?.length || 0;

  // Save Reading Progress
  const updateProgress = useCallback(
    (page: number) => {
      if (!manga || !currentChapter || totalPages <= 0) return;
      saveMangaProgress({
        mangaId: manga.id,
        mangaTitle: manga.title,
        mangaCover: manga.coverImage,
        mangaType: manga.type,
        chapterId: currentChapter.id,
        chapterNumber: currentChapter.chapterNumber,
        chapterTitle: currentChapter.title,
        pageNumber: page,
        totalPages,
        nextChapterId: nextChapter ? nextChapter.id : null,
        nextChapterNumber: nextChapter ? nextChapter.chapterNumber : null,
      });
      markChapterAsRead(manga.id, currentChapter.id, currentChapter.chapterNumber);
    },
    [manga, currentChapter, totalPages, nextChapter]
  );

  // Sync initial page or saved page on mount (local + cloud account sync)
  useEffect(() => {
    if (totalPages > 0) {
      const saved = getMangaProgress(mangaId);
      if (saved && saved.chapterId === chapterId && saved.pageNumber <= totalPages) {
        setCurrentPage(saved.pageNumber);
      } else {
        syncMangaHistoryFromServer().then((syncedList) => {
          const serverSaved = syncedList.find((item) => item.mangaId === mangaId);
          if (serverSaved && serverSaved.chapterId === chapterId && serverSaved.pageNumber <= totalPages) {
            setCurrentPage(serverSaved.pageNumber);
          } else {
            setCurrentPage(1);
            updateProgress(1);
          }
        });
      }
    }
  }, [totalPages, mangaId, chapterId, updateProgress]);

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
    if (readingMode !== "webtoon" || totalPages <= 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute("data-page") || "1", 10);
            if (pageNum && pageNum !== currentPage) {
              setCurrentPage(pageNum);
              updateProgress(pageNum);
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
  }, [readingMode, totalPages, currentPage, updateProgress]);

  // Zoom Handler Functions (+ / - / reset)
  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => {
      const next = Math.min(200, prev + 15);
      try { localStorage.setItem("cinestream.manga_zoom_level", String(next)); } catch {}
      return next;
    });
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => {
      const next = Math.max(50, prev - 15);
      try { localStorage.setItem("cinestream.manga_zoom_level", String(next)); } catch {}
      return next;
    });
  };

  const handleZoomReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel(100);
    try { localStorage.setItem("cinestream.manga_zoom_level", "100"); } catch {}
  };

  // Switch Reading Mode
  const handleSetMode = (mode: ReadingMode) => {
    setReadingMode(mode);
    try {
      localStorage.setItem("cinestream.manga_reading_mode", mode);
    } catch {}
  };

  // Toggle Reading Direction (RTL Manga vs LTR Western)
  const toggleReadingDirection = () => {
    const next = readingDirection === "rtl" ? "ltr" : "rtl";
    setReadingDirection(next);
    try {
      localStorage.setItem("cinestream.manga_reading_dir", next);
    } catch {}
  };

  // Double-Page Spread calculations (Book Cover offset + Wide page detection)
  const isCurrentPageWide = widePages.has(currentPage);
  // In Double mode: Page 1 is the standalone cover. Subsequent pages (2-3, 4-5, 6-7) form spreads.
  const isCoverPage = currentPage === 1;

  let pageFirst = currentPage;
  let pageSecond: number | null = null;

  if (readingMode === "double") {
    if (isCoverPage || isCurrentPageWide) {
      pageFirst = currentPage;
      pageSecond = null;
    } else {
      pageFirst = currentPage;
      if (currentPage + 1 <= totalPages && !widePages.has(currentPage + 1)) {
        pageSecond = currentPage + 1;
      }
    }
  }

  // Single & Double Page Mode Navigation
  const handleNextPage = () => {
    if (readingMode === "double") {
      if (isCoverPage) {
        // From Cover (Page 1) -> Go to first spread (Page 2)
        if (currentPage < totalPages) {
          const next = 2;
          setCurrentPage(next);
          updateProgress(next);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (nextChapter) {
          router.push(`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`);
        }
      } else if (isCurrentPageWide) {
        // Wide single spread advances by 1 page
        if (currentPage < totalPages) {
          const next = currentPage + 1;
          setCurrentPage(next);
          updateProgress(next);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (nextChapter) {
          router.push(`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`);
        }
      } else if (pageSecond && pageSecond + 1 <= totalPages) {
        // Standard double spread advances to next spread
        const next = pageSecond + 1;
        setCurrentPage(next);
        updateProgress(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (currentPage < totalPages) {
        const next = currentPage + 1;
        setCurrentPage(next);
        updateProgress(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (nextChapter) {
        router.push(`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`);
      }
    } else {
      if (currentPage < totalPages) {
        const next = currentPage + 1;
        setCurrentPage(next);
        updateProgress(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (nextChapter) {
        router.push(`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`);
      }
    }
  };

  const handlePrevPage = () => {
    if (readingMode === "double") {
      if (currentPage <= 2) {
        if (currentPage === 2) {
          setCurrentPage(1);
          updateProgress(1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (prevChapter) {
          router.push(`/manga/${mangaId}/read/${prevChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(prevChapter.chapterNumber)}`);
        }
      } else {
        const prev = Math.max(2, currentPage - 2);
        setCurrentPage(prev);
        updateProgress(prev);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      if (currentPage > 1) {
        const prev = currentPage - 1;
        setCurrentPage(prev);
        updateProgress(prev);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (prevChapter) {
        router.push(`/manga/${mangaId}/read/${prevChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(prevChapter.chapterNumber)}`);
      }
    }
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

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === "f" || e.key === "F") {
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

  const isManhwa = manga?.type === "manhwa";

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
            width: `${Math.min(100, Math.round(((readingMode === "double" && pageSecond ? pageSecond : currentPage) / totalPages) * 100))}%`,
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

        {/* Center: Chapter Jump Picker + Mode Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Chapter Dropdown Jump Picker */}
          <div className="relative">
            <button
              onClick={() => setChapterPickerOpen(!chapterPickerOpen)}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer touch-manipulation active:scale-95"
            >
              <List className="w-3.5 h-3.5 text-primary" />
              <span>Ch. {currentChapter?.chapterNumber || queryCh || "1"}</span>
            </button>

            {/* Click-away backdrop overlay to prevent blending with white pages */}
            {chapterPickerOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
                onClick={() => setChapterPickerOpen(false)}
              />
            )}

            {/* Chapter Jump Menu (Solid, 100% Opaque, Centered on Mobile) */}
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

          {/* Reading Mode Switcher (Visible on BOTH Mobile & Desktop) */}
          <div className="flex items-center bg-white/[0.06] p-0.5 sm:p-1 rounded-xl border border-white/10">
            <button
              onClick={() => handleSetMode("webtoon")}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all touch-manipulation ${
                readingMode === "webtoon"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "text-white/60 hover:text-white"
              }`}
              title="Continuous Vertical Scroll"
            >
              Scroll
            </button>
            <button
              onClick={() => handleSetMode("single")}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all touch-manipulation ${
                readingMode === "single"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "text-white/60 hover:text-white"
              }`}
              title="Single Page Flip"
            >
              Single
            </button>
            <button
              onClick={() => handleSetMode("double")}
              className={`hidden md:block px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all touch-manipulation ${
                readingMode === "double"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                  : "text-white/60 hover:text-white"
              }`}
              title="Double-Page Spread (Desktop Book View)"
            >
              Spread
            </button>
          </div>

          {/* Reading Direction Toggle (Only shown in Double Spread mode) */}
          {readingMode === "double" && (
            <button
              onClick={toggleReadingDirection}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-bold text-white/80 hover:text-primary transition-all cursor-pointer touch-manipulation"
              title="Toggle Reading Direction (Manga RTL vs Western LTR)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
              <span>{readingDirection === "rtl" ? "Manga (RTL)" : "Western (LTR)"}</span>
            </button>
          )}
        </div>

        {/* Right: Zoom Controls, Fullscreen & Chapter Jump Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Zoom In / Out Controls */}
          <div className="flex items-center bg-white/[0.06] border border-white/10 rounded-xl p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleZoomReset}
              className="px-1.5 py-0.5 text-[10px] sm:text-xs font-black text-primary hover:bg-white/10 rounded-md transition-all cursor-pointer touch-manipulation"
              title="Reset Zoom (100%)"
            >
              {zoomLevel}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Button: HIDDEN ON MOBILE */}
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

      {/* MANHWA DOUBLE-MODE ADVISORY BANNER (Informs users when viewing vertical strips in spread mode) */}
      {isManhwa && readingMode === "double" && (
        <div className="fixed top-16 inset-x-0 mx-auto z-40 max-w-md px-4 pointer-events-none">
          <div className="bg-zinc-950/95 border border-primary/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs pointer-events-auto">
            <div className="flex items-center gap-2 text-white/90 font-medium min-w-0">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">This is a vertical Manhwa. Scroll mode is recommended.</span>
            </div>
            <button
              onClick={() => handleSetMode("webtoon")}
              className="px-3 py-1 rounded-xl bg-primary text-primary-foreground font-black text-xs shrink-0 cursor-pointer shadow-md"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      {/* FLOATING SIDE CHEVRON BUTTONS FOR DESKTOP & TABLET (Outside the Page View, Zero Obstruction) */}
      {(readingMode === "single" || readingMode === "double") && (
        <>
          {/* Left Arrow (Previous Page) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrevPage();
            }}
            disabled={currentPage <= 1 && !prevChapter}
            className="hidden md:flex fixed left-3 lg:left-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-2xl bg-zinc-900/85 hover:bg-primary text-white/80 hover:text-primary-foreground border border-white/15 backdrop-blur-xl shadow-2xl items-center justify-center transition-all cursor-pointer select-none hover:scale-110 active:scale-95 disabled:opacity-20 disabled:pointer-events-none group"
            title="Previous Page (Left Arrow / A)"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-6 h-6 transition-transform group-hover:-translate-x-0.5" />
          </button>

          {/* Right Arrow (Next Page) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNextPage();
            }}
            disabled={(readingMode === "double" && pageSecond ? pageSecond >= totalPages : currentPage >= totalPages) && !nextChapter}
            className="hidden md:flex fixed right-3 lg:right-6 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-2xl bg-zinc-900/85 hover:bg-primary text-white/80 hover:text-primary-foreground border border-white/15 backdrop-blur-xl shadow-2xl items-center justify-center transition-all cursor-pointer select-none hover:scale-110 active:scale-95 disabled:opacity-20 disabled:pointer-events-none group"
            title="Next Page (Right Arrow / D)"
            aria-label="Next Page"
          >
            <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-0.5" />
          </button>
        </>
      )}

      {/* MAIN READING CANVAS */}
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
        {readingMode === "webtoon" ? (
          /* CONTINUOUS WEBTOON VERTICAL SCROLL */
          <div
            style={{
              width: `${zoomLevel}%`,
              minWidth: zoomLevel < 100 ? `${zoomLevel}%` : "100%",
              maxWidth: `${Math.round(768 * (zoomLevel / 100))}px`,
            }}
            className="flex flex-col items-center mx-auto transition-[width] duration-200"
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
                  className="relative w-full flex justify-center bg-black"
                >
                  <img
                    src={url}
                    alt={`Page ${pageNum}`}
                    loading={pageNum <= 3 ? "eager" : "lazy"}
                    decoding="async"
                    onLoad={(e) => handleImageLoad(pageNum, e)}
                    className="w-full h-auto object-contain block select-none"
                  />
                  {/* Subtle Page Watermark */}
                  <span className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md bg-black/70 text-[9px] text-white/60 backdrop-blur-md pointer-events-none font-bold">
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
        ) : readingMode === "double" ? (
          /* DOUBLE-PAGE SPREAD MODE (Book Spread / RTL & LTR aware - 100% Unclipped) */
          <div
            style={{ width: `${Math.round(1400 * (zoomLevel / 100))}px`, maxWidth: "100vw" }}
            className="w-full flex-1 flex flex-col items-center justify-center relative px-0 sm:px-2 transition-[width] duration-200 mx-auto"
          >
            <div className="relative w-full flex items-center justify-center bg-black">
              
              {isCoverPage || isCurrentPageWide || !pageSecond ? (
                /* Standalone Single Page (Cover or Landscape Spread) */
                <div className="w-full flex flex-col items-center justify-center min-h-[50vh]">
                  {isCoverPage && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary/80 bg-primary/10 px-3 py-1 rounded-full border border-primary/30 mb-2">
                      Cover Page
                    </span>
                  )}
                  <img
                    src={pagesData.pageUrls[currentPage - 1]}
                    alt={`Page ${currentPage}`}
                    onLoad={(e) => handleImageLoad(currentPage, e)}
                    className="w-full h-auto max-w-full object-contain block select-none mx-auto"
                  />
                </div>
              ) : (
                /* Side-by-Side 2-Page Book Spread (Uncut & Unclipped) */
                <div className="flex items-start justify-center w-full">
                  {readingDirection === "rtl" ? (
                    /* Manga Japanese RTL: Page N+1 on Left, Page N on Right */
                    <>
                      <div className="w-1/2 flex items-center justify-end">
                        <img
                          src={pagesData.pageUrls[pageSecond - 1]}
                          alt={`Page ${pageSecond}`}
                          onLoad={(e) => handleImageLoad(pageSecond, e)}
                          className="w-full h-auto max-w-full object-contain block select-none"
                        />
                      </div>
                      <div className="w-1/2 flex items-center justify-start">
                        <img
                          src={pagesData.pageUrls[pageFirst - 1]}
                          alt={`Page ${pageFirst}`}
                          onLoad={(e) => handleImageLoad(pageFirst, e)}
                          className="w-full h-auto max-w-full object-contain block select-none"
                        />
                      </div>
                    </>
                  ) : (
                    /* Western LTR: Page N on Left, Page N+1 on Right */
                    <>
                      <div className="w-1/2 flex items-center justify-end">
                        <img
                          src={pagesData.pageUrls[pageFirst - 1]}
                          alt={`Page ${pageFirst}`}
                          onLoad={(e) => handleImageLoad(pageFirst, e)}
                          className="w-full h-auto max-w-full object-contain block select-none"
                        />
                      </div>
                      <div className="w-1/2 flex items-center justify-start">
                        <img
                          src={pagesData.pageUrls[pageSecond - 1]}
                          alt={`Page ${pageSecond}`}
                          onLoad={(e) => handleImageLoad(pageSecond, e)}
                          className="w-full h-auto max-w-full object-contain block select-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Invisible Left/Right Click Zones */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize touch-manipulation"
              />

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize touch-manipulation"
              />
            </div>
          </div>
        ) : (
          /* SINGLE PAGE FLIP MODE (100% Unclipped) */
          <div
            style={{
              width: `${zoomLevel}%`,
              minWidth: zoomLevel < 100 ? `${zoomLevel}%` : "100%",
              maxWidth: `${Math.round(850 * (zoomLevel / 100))}px`,
            }}
            className="flex-1 flex flex-col items-center justify-center relative px-0 sm:px-2 transition-[width] duration-200 mx-auto"
          >
            <div className="relative w-full flex items-center justify-center bg-black">
              <img
                src={pagesData.pageUrls[currentPage - 1]}
                alt={`Page ${currentPage}`}
                onLoad={(e) => handleImageLoad(currentPage, e)}
                className="w-full h-auto object-contain block select-none"
              />

              {/* Mobile / Touch Responsive Left/Right Click Zones */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize touch-manipulation"
              />

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                className="absolute inset-y-0 right-0 w-1/3 cursor-e-resize touch-manipulation"
              />
            </div>

            {/* Mobile Thumb Navigation Floating Bar (Only on Mobile screens in Single Mode) */}
            <div className="md:hidden flex items-center justify-between gap-3 w-full max-w-xs mt-4 px-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                disabled={currentPage <= 1 && !prevChapter}
                className="flex items-center gap-1 py-2 px-3.5 rounded-xl bg-white/[0.08] hover:bg-primary/20 text-white font-bold text-xs disabled:opacity-30 active:scale-95 cursor-pointer touch-manipulation"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <span className="text-xs font-black text-primary">
                p. {currentPage} / {totalPages}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                disabled={currentPage >= totalPages && !nextChapter}
                className="flex items-center gap-1 py-2 px-3.5 rounded-xl bg-primary text-primary-foreground font-black text-xs shadow-md shadow-primary/20 disabled:opacity-30 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
