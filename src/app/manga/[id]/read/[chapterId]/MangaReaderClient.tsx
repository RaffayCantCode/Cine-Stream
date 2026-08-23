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
} from "lucide-react";
import { usePageContentReady } from "@/lib/pageLoad";

type ReadingMode = "webtoon" | "single" | "double";

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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 50% to 200%
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  usePageContentReady(!isLoading);

  // Load Saved Preferences (Reading Mode & Zoom Level)
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("cinestream.manga_reading_mode") as ReadingMode;
      if (savedMode === "webtoon" || savedMode === "single" || savedMode === "double") {
        setReadingMode(savedMode);
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

    try {
      const titleParam = queryTitle ? `?title=${encodeURIComponent(queryTitle)}&ch=${encodeURIComponent(queryCh)}` : "";

      const [detailsData, chaptersData, pagesRes] = await Promise.all([
        fetchJson<{ success: boolean; item: MangaItem }>(`/api/manga/details/${mangaId}`),
        fetchJson<{ success: boolean; chapters: MangaChapter[] }>(`/api/manga/chapters/${mangaId}?order=asc&limit=500`),
        fetchJson<{ success: boolean; pageUrls: string[]; dataSaverUrls: string[] }>(`/api/manga/chapter/${chapterId}${titleParam}`),
      ]);

      if (detailsData.success && detailsData.item) {
        setManga(detailsData.item);
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
      const next = Math.min(200, prev + 10);
      try { localStorage.setItem("cinestream.manga_zoom_level", String(next)); } catch {}
      return next;
    });
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setZoomLevel((prev) => {
      const next = Math.max(50, prev - 10);
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

  // Single & Double Page Mode Navigation
  const handleNextPage = () => {
    if (readingMode === "double") {
      if (currentPage + 2 <= totalPages) {
        const next = currentPage + 2;
        setCurrentPage(next);
        updateProgress(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (currentPage + 1 === totalPages) {
        // Last page of odd count
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
      if (currentPage > 2) {
        const prev = currentPage - 2;
        setCurrentPage(prev);
        updateProgress(prev);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (currentPage === 2) {
        setCurrentPage(1);
        updateProgress(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (prevChapter) {
        router.push(`/manga/${mangaId}/read/${prevChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(prevChapter.chapterNumber)}`);
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

  // Proper Fullscreen Toggle (Starts from top without offsets)
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

  // Double page spread calculation (Left to Right)
  const pageLeft = currentPage;
  const pageRight = currentPage + 1 <= totalPages ? currentPage + 1 : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#42f5dd] mb-3" />
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
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#42f5dd] text-black font-black text-sm shadow-xl shadow-[#42f5dd]/30 active:scale-95 cursor-pointer touch-manipulation"
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
      {/* TOP FLOATING NAVIGATION BAR (Safe area top padded for PWA / Mobile Homescreen) */}
      <header
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))",
          paddingBottom: "0.75rem",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0.75rem))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0.75rem))",
        }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          showControls ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        } bg-black/95 backdrop-blur-2xl border-b border-white/10 px-3 sm:px-6 flex items-center justify-between shadow-2xl`}
      >
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2 sm:pr-4">
          <Link
            href={`/manga/${mangaId}`}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-[#42f5dd]/20 hover:text-[#42f5dd] text-white/80 transition-colors shrink-0 touch-manipulation active:scale-90"
            title="Back to Details"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex flex-col min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[130px] sm:max-w-xs md:max-w-md">
              {manga?.title || queryTitle || "Manga"}
            </h1>
            <span className="text-[10px] sm:text-[11px] text-[#42f5dd] font-bold truncate">
              {currentChapter ? currentChapter.title || `Chapter ${currentChapter.chapterNumber}` : queryCh ? `Chapter ${queryCh}` : `Chapter`}
            </span>
          </div>
        </div>

        {/* Center: Chapter Jump Picker */}
        <div className="relative shrink-0">
          <button
            onClick={() => setChapterPickerOpen(!chapterPickerOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer touch-manipulation active:scale-95"
          >
            <List className="w-3.5 h-3.5 text-[#42f5dd]" />
            <span>Ch. {currentChapter?.chapterNumber || queryCh || "1"}</span>
          </button>

          {/* Chapter Dropdown Jump Menu */}
          {chapterPickerOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 max-h-80 overflow-y-auto custom-scrollbar bg-zinc-900/98 border border-[#42f5dd]/30 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-2xl">
              <div className="text-[10px] font-black uppercase text-[#42f5dd] px-3 py-1.5">
                Jump to Chapter ({chapters.length})
              </div>
              <div className="flex flex-col gap-1">
                {[...sortedChapters].reverse().map((ch) => {
                  const isCurrent = ch.id === chapterId;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setChapterPickerOpen(false);
                        router.push(`/manga/${mangaId}/read/${ch.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(ch.chapterNumber)}`);
                      }}
                      className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between touch-manipulation ${
                        isCurrent
                          ? "bg-[#42f5dd] text-black font-black"
                          : "text-white/80 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <span className="truncate">{ch.title || `Chapter ${ch.chapterNumber}`}</span>
                      {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Zoom Controls, Mode Toggle, Fullscreen & Next Chapter Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Zoom In / Out Controls */}
          <div className="flex items-center bg-white/[0.06] border border-white/10 rounded-xl p-0.5 sm:p-1">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-[#42f5dd] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleZoomReset}
              className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-black text-[#42f5dd] hover:bg-white/10 rounded-md transition-all cursor-pointer touch-manipulation"
              title="Reset Zoom to 100% (0)"
            >
              {zoomLevel}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-[#42f5dd] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="hidden md:flex items-center bg-white/[0.06] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => handleSetMode("webtoon")}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all touch-manipulation ${
                readingMode === "webtoon"
                  ? "bg-[#42f5dd] text-black shadow-md shadow-[#42f5dd]/30"
                  : "text-white/60 hover:text-white"
              }`}
              title="Webtoon Continuous Scroll"
            >
              Scroll
            </button>
            <button
              onClick={() => handleSetMode("single")}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all touch-manipulation ${
                readingMode === "single"
                  ? "bg-[#42f5dd] text-black shadow-md shadow-[#42f5dd]/30"
                  : "text-white/60 hover:text-white"
              }`}
              title="Single Page Flip"
            >
              Single
            </button>
            <button
              onClick={() => handleSetMode("double")}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all touch-manipulation ${
                readingMode === "double"
                  ? "bg-[#42f5dd] text-black shadow-md shadow-[#42f5dd]/30"
                  : "text-white/60 hover:text-white"
              }`}
              title="Double-Page Spread (Left to Right)"
            >
              Double
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-[#42f5dd] transition-colors cursor-pointer touch-manipulation active:scale-90"
            title="Toggle Fullscreen (F)"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* DEDICATED NEXT CHAPTER BUTTON: Shows ONLY if next chapter exists */}
          {nextChapter && (
            <Link
              href={`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`}
              className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#42f5dd] hover:bg-[#34dbcb] text-black text-xs font-black shadow-lg shadow-[#42f5dd]/25 transition-all cursor-pointer shrink-0 touch-manipulation active:scale-95"
              title={`Next Chapter (Ch. ${nextChapter.chapterNumber})`}
            >
              <span className="hidden sm:inline">Next Chapter</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            </Link>
          )}
        </div>
      </header>

      {/* MAIN READING CANVAS (Safe-area padded for Notch & Status Bar) */}
      <main
        style={{
          paddingTop: "max(4.5rem, calc(4.25rem + env(safe-area-inset-top, 0px)))",
          paddingBottom: "max(6rem, calc(5rem + env(safe-area-inset-bottom, 0px)))",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setShowControls((prev) => !prev)}
        className="flex-1 flex flex-col items-center justify-center min-h-screen w-full cursor-default"
      >
        {readingMode === "webtoon" ? (
          /* CONTINUOUS WEBTOON VERTICAL SCROLL */
          <div
            style={{ width: `${Math.round(768 * (zoomLevel / 100))}px`, maxWidth: "100vw" }}
            className="w-full flex flex-col items-center mx-auto transition-[width] duration-200"
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
                  className="relative w-full flex justify-center bg-black overflow-hidden"
                >
                  <img
                    src={url}
                    alt={`Page ${pageNum}`}
                    loading={pageNum <= 3 ? "eager" : "lazy"}
                    decoding="async"
                    className="w-full h-auto object-contain block select-none"
                  />
                  {/* Subtle Page Watermark */}
                  <span className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md bg-black/70 text-[9px] text-white/60 backdrop-blur-md pointer-events-none font-bold">
                    {pageNum} / {totalPages}
                  </span>
                </div>
              );
            })}

            {/* END OF CHAPTER BANNER: Shows ONLY after pages loaded */}
            {totalPages > 0 && (
              <div className="w-full p-8 my-8 text-center bg-zinc-950 border border-white/10 rounded-3xl space-y-4 max-w-xl mx-4 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-[#42f5dd]/15 text-[#42f5dd] flex items-center justify-center mx-auto border border-[#42f5dd]/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-white">
                  Finished {currentChapter ? currentChapter.title || `Chapter ${currentChapter.chapterNumber}` : "Chapter"}!
                </h3>

                {/* NEXT CHAPTER CTA: Shows ONLY when next chapter exists */}
                {nextChapter ? (
                  <div className="pt-2">
                    <Link
                      href={`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[#42f5dd] hover:bg-[#34dbcb] text-black font-black text-sm shadow-xl shadow-[#42f5dd]/30 transition-all cursor-pointer touch-manipulation active:scale-95"
                    >
                      <span>Read Next Chapter {nextChapter.chapterNumber}</span>
                      <ChevronRight className="w-4 h-4 stroke-[3]" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-[#42f5dd] font-bold">
                    🎉 You are caught up with the latest released chapter!
                  </p>
                )}
              </div>
            )}
          </div>
        ) : readingMode === "double" ? (
          /* DOUBLE-PAGE SPREAD MODE (Desktop Side-by-Side Left to Right) */
          <div
            style={{ width: `${Math.round(1350 * (zoomLevel / 100))}px`, maxWidth: "100vw" }}
            className="w-full flex-1 flex flex-col items-center justify-center relative px-2 sm:px-6 transition-[width] duration-200"
          >
            <div className="relative w-full flex items-center justify-center bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl p-2 sm:p-4">
              <div className="flex items-center justify-center gap-2 sm:gap-4 w-full">
                {/* Left Page (Page N) */}
                <div className="flex-1 flex justify-end items-center max-w-[50%]">
                  <img
                    src={pagesData.pageUrls[pageLeft - 1]}
                    alt={`Page ${pageLeft}`}
                    className="w-auto h-auto max-h-[85vh] object-contain block select-none rounded-l-xl shadow-lg"
                  />
                </div>

                {/* Right Page (Page N+1) if available */}
                {pageRight ? (
                  <div className="flex-1 flex justify-start items-center max-w-[50%]">
                    <img
                      src={pagesData.pageUrls[pageRight - 1]}
                      alt={`Page ${pageRight}`}
                      className="w-auto h-auto max-h-[85vh] object-contain block select-none rounded-r-xl shadow-lg"
                    />
                  </div>
                ) : null}
              </div>

              {/* Invisible Click Zones for Left/Right Double-Page Flip */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize group flex items-center justify-start pl-4 touch-manipulation"
              >
                <div className="opacity-0 group-hover:opacity-100 p-3 rounded-full bg-black/70 text-[#42f5dd] backdrop-blur-md transition-opacity">
                  <ChevronLeft className="w-6 h-6" />
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize group flex items-center justify-end pr-4 touch-manipulation"
              >
                <div className="opacity-0 group-hover:opacity-100 p-3 rounded-full bg-black/70 text-[#42f5dd] backdrop-blur-md transition-opacity">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Spread Navigation Bar */}
            <div className="w-full max-w-md flex items-center justify-between gap-4 mt-6 px-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                disabled={currentPage <= 1 && !prevChapter}
                className="p-2.5 rounded-xl bg-white/[0.08] hover:bg-[#42f5dd]/20 hover:text-[#42f5dd] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-xs font-black text-white/90">
                {pageRight ? `Pages ${pageLeft} - ${pageRight} of ${totalPages}` : `Page ${pageLeft} of ${totalPages}`}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                disabled={(pageRight ? pageRight >= totalPages : pageLeft >= totalPages) && !nextChapter}
                className="p-2.5 rounded-xl bg-[#42f5dd] text-black hover:bg-[#34dbcb] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-black shadow-md shadow-[#42f5dd]/20 touch-manipulation active:scale-90"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          /* SINGLE PAGE FLIP MODE */
          <div
            style={{ width: `${Math.round(800 * (zoomLevel / 100))}px`, maxWidth: "100vw" }}
            className="w-full flex-1 flex flex-col items-center justify-center relative px-2 sm:px-4 transition-[width] duration-200"
          >
            <div className="relative w-full flex items-center justify-center bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={pagesData.pageUrls[currentPage - 1]}
                alt={`Page ${currentPage}`}
                className="w-full h-auto object-contain block select-none"
              />

              {/* Invisible Click Zones for Left/Right Page Flip */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize group flex items-center justify-start pl-4 touch-manipulation"
              >
                <div className="opacity-0 group-hover:opacity-100 p-3 rounded-full bg-black/70 text-[#42f5dd] backdrop-blur-md transition-opacity">
                  <ChevronLeft className="w-6 h-6" />
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize group flex items-center justify-end pr-4 touch-manipulation"
              >
                <div className="opacity-0 group-hover:opacity-100 p-3 rounded-full bg-black/70 text-[#42f5dd] backdrop-blur-md transition-opacity">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Page Slider / Navigation Bar */}
            <div className="w-full max-w-md flex items-center justify-between gap-4 mt-6 px-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                disabled={currentPage <= 1 && !prevChapter}
                className="p-2.5 rounded-xl bg-white/[0.08] hover:bg-[#42f5dd]/20 hover:text-[#42f5dd] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer touch-manipulation active:scale-90"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-xs font-black text-white/90">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                disabled={currentPage >= totalPages && !nextChapter}
                className="p-2.5 rounded-xl bg-[#42f5dd] text-black hover:bg-[#34dbcb] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-black shadow-md shadow-[#42f5dd]/20 touch-manipulation active:scale-90"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM FLOATING CONTROLS (Safe-area padded for Home Indicator) */}
      <footer
        style={{
          bottom: "max(1rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)))",
        }}
        className={`fixed inset-x-0 mx-auto w-fit max-w-[95vw] z-50 transition-all duration-300 ${
          showControls ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
        } bg-black/95 backdrop-blur-2xl border border-[#42f5dd]/30 rounded-2xl px-4 sm:px-5 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-4 shadow-2xl shadow-[#42f5dd]/10`}
      >
        {/* Prev Chapter */}
        {prevChapter ? (
          <Link
            href={`/manga/${mangaId}/read/${prevChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(prevChapter.chapterNumber)}`}
            className="flex items-center gap-1 text-xs font-black text-white/80 hover:text-[#42f5dd] transition-colors cursor-pointer touch-manipulation"
            title={`Prev: Ch. ${prevChapter.chapterNumber}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Ch. {prevChapter.chapterNumber}</span>
          </Link>
        ) : (
          <span className="text-xs text-white/20 font-bold hidden sm:inline">Start</span>
        )}

        <div className="w-px h-4 bg-white/20" />

        {/* Current Position & Quick Zoom */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-[#42f5dd]">
            {readingMode === "double" && pageRight
              ? `p. ${pageLeft}-${pageRight} / ${totalPages}`
              : `p. ${currentPage} / ${totalPages}`}
          </span>
          <span className="text-[10px] font-bold text-white/40 hidden sm:inline">
            ({zoomLevel}%)
          </span>
        </div>

        <div className="w-px h-4 bg-white/20" />

        {/* Next Chapter (ONLY shows if next chapter exists) */}
        {nextChapter ? (
          <Link
            href={`/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`}
            className="flex items-center gap-1 text-xs font-black text-[#42f5dd] hover:text-white transition-colors cursor-pointer touch-manipulation"
            title={`Next: Ch. ${nextChapter.chapterNumber}`}
          >
            <span className="hidden sm:inline">Ch. {nextChapter.chapterNumber}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="text-xs text-[#42f5dd]/50 font-bold">Latest Chapter</span>
        )}
      </footer>
    </div>
  );
}
