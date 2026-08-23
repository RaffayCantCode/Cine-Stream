"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MangaItem, MangaChapter, ChapterPagesData } from "@/lib/manga-fetch";
import { saveMangaProgress, getMangaProgress } from "@/lib/manga-history";
import { fetchJson } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  BookOpen,
  Layers,
  Scroll,
  RotateCcw,
  Loader2,
  CheckCircle2,
  List,
  Sparkles
} from "lucide-react";
import { usePageContentReady } from "@/lib/pageLoad";

type ReadingMode = "webtoon" | "single";

export default function MangaReaderClient({
  mangaId,
  chapterId,
}: {
  mangaId: string;
  chapterId: string;
}) {
  const router = useRouter();

  const [manga, setManga] = useState<MangaItem | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [pagesData, setPagesData] = useState<ChapterPagesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [readingMode, setReadingMode] = useState<ReadingMode>("webtoon");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  usePageContentReady(!isLoading);

  // Load Saved Preferences (Reading Mode)
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("cinestream.manga_reading_mode") as ReadingMode;
      if (savedMode === "webtoon" || savedMode === "single") {
        setReadingMode(savedMode);
      }
    } catch {}
  }, []);

  // Fetch Manga Details, Chapter List, and Chapter Pages
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    setIsLoading(true);
    setError(null);
    setPagesData(null);

    const loadChapter = async () => {
      try {
        const [detailsData, chaptersData, pagesRes] = await Promise.all([
          fetchJson<{ success: boolean; item: MangaItem }>(`/api/manga/details/${mangaId}`),
          fetchJson<{ success: boolean; chapters: MangaChapter[] }>(`/api/manga/chapters/${mangaId}?order=asc&limit=500`),
          fetchJson<{ success: boolean; pageUrls: string[]; dataSaverUrls: string[] }>(`/api/manga/chapter/${chapterId}`),
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

        if (pagesRes.success && pagesRes.pageUrls && pagesRes.pageUrls.length > 0) {
          setPagesData({
            chapterId,
            chapterNumber: "",
            mangaId,
            pageUrls: pagesRes.pageUrls,
            dataSaverUrls: pagesRes.dataSaverUrls || [],
          });
        } else {
          setError("Failed to load chapter pages. The chapter may be unavailable or external.");
        }
      } catch (err: any) {
        console.error("Failed to load chapter:", err);
        setError(err.message || "Failed to load chapter pages");
      } finally {
        setIsLoading(false);
      }
    };

    loadChapter();
  }, [mangaId, chapterId]);

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

  // Save Reading Progress (with next chapter metadata)
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
    },
    [manga, currentChapter, totalPages, nextChapter]
  );

  // Sync initial page or saved page on mount
  useEffect(() => {
    if (totalPages > 0) {
      const saved = getMangaProgress(mangaId);
      if (saved && saved.chapterId === chapterId && saved.pageNumber <= totalPages) {
        setCurrentPage(saved.pageNumber);
      } else {
        setCurrentPage(1);
        updateProgress(1);
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
      { threshold: 0.5 }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [readingMode, totalPages, currentPage, updateProgress]);

  // Switch Reading Mode
  const handleSetMode = (mode: ReadingMode) => {
    setReadingMode(mode);
    try {
      localStorage.setItem("cinestream.manga_reading_mode", mode);
    } catch {}
  };

  // Single Page Mode Controls
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      updateProgress(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (nextChapter) {
      router.push(`/manga/${mangaId}/read/${nextChapter.id}`);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      updateProgress(prev);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (prevChapter) {
      router.push(`/manga/${mangaId}/read/${prevChapter.id}`);
    }
  };

  // Keyboard Navigation
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      readerContainerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#42f5dd] mb-3" />
        <p className="text-sm text-zinc-400 font-bold">Loading chapter pages...</p>
      </div>
    );
  }

  if (error || !pagesData) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <BookOpen className="w-16 h-16 text-zinc-700 mb-4" />
        <h2 className="text-2xl font-black text-white mb-2">Failed to Load Chapter</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">{error || "Could not retrieve chapter images."}</p>
        <Link
          href={`/manga/${mangaId}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#42f5dd] text-black font-black text-sm shadow-xl shadow-[#42f5dd]/30"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Chapter List</span>
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={readerContainerRef}
      className="min-h-screen bg-black text-white flex flex-col select-none relative overflow-x-hidden"
    >
      {/* TOP FLOATING NAVIGATION BAR */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          showControls ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        } bg-black/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xl`}
      >
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <Link
            href={`/manga/${mangaId}`}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-[#42f5dd]/20 hover:text-[#42f5dd] text-white/80 transition-colors"
            title="Back to Details"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex flex-col min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {manga?.title || "Manga"}
            </h1>
            <span className="text-[11px] text-[#42f5dd] font-bold truncate">
              {currentChapter ? currentChapter.title || `Chapter ${currentChapter.chapterNumber}` : `Chapter`}
            </span>
          </div>
        </div>

        {/* Center: Chapter Jump Picker */}
        <div className="relative">
          <button
            onClick={() => setChapterPickerOpen(!chapterPickerOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <List className="w-3.5 h-3.5 text-[#42f5dd]" />
            <span>Ch. {currentChapter?.chapterNumber || "1"}</span>
          </button>

          {/* Chapter Dropdown Jump Menu */}
          {chapterPickerOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 max-h-80 overflow-y-auto custom-scrollbar bg-zinc-900/95 border border-[#42f5dd]/30 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-2xl">
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
                        router.push(`/manga/${mangaId}/read/${ch.id}`);
                      }}
                      className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
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

        {/* Right: Mode Toggle & Automatic Next Chapter Button */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="hidden sm:flex items-center bg-white/[0.06] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => handleSetMode("webtoon")}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
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
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                readingMode === "single"
                  ? "bg-[#42f5dd] text-black shadow-md shadow-[#42f5dd]/30"
                  : "text-white/60 hover:text-white"
              }`}
              title="Single Page Flip"
            >
              Single
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 transition-colors hidden md:block"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* DEDICATED NEXT CHAPTER BUTTON: Shows ONLY if next chapter exists */}
          {nextChapter && (
            <Link
              href={`/manga/${mangaId}/read/${nextChapter.id}`}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[#42f5dd] hover:bg-[#34dbcb] text-black text-xs font-black shadow-lg shadow-[#42f5dd]/25 transition-all cursor-pointer shrink-0"
              title={`Next Chapter (Ch. ${nextChapter.chapterNumber})`}
            >
              <span className="hidden sm:inline">Next Chapter</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </Link>
          )}
        </div>
      </header>

      {/* MAIN READING CANVAS */}
      <main
        onClick={() => setShowControls((prev) => !prev)}
        className="flex-1 flex flex-col items-center justify-center pt-16 pb-24 min-h-screen cursor-default"
      >
        {readingMode === "webtoon" ? (
          /* CONTINUOUS WEBTOON VERTICAL SCROLL */
          <div className="w-full max-w-3xl flex flex-col items-center mx-auto">
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
                    className="w-full h-auto object-contain block select-none"
                  />
                  {/* Subtle Page Watermark */}
                  <span className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md bg-black/60 text-[9px] text-white/50 backdrop-blur-md pointer-events-none font-bold">
                    {pageNum} / {totalPages}
                  </span>
                </div>
              );
            })}

            {/* END OF CHAPTER BANNER */}
            <div className="w-full p-8 my-8 text-center bg-zinc-950 border border-white/10 rounded-3xl space-y-4 max-w-xl mx-4">
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
                    href={`/manga/${mangaId}/read/${nextChapter.id}`}
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[#42f5dd] hover:bg-[#34dbcb] text-black font-black text-sm shadow-xl shadow-[#42f5dd]/30 transition-all cursor-pointer"
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
          </div>
        ) : (
          /* SINGLE PAGE FLIP MODE */
          <div className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center relative px-4">
            <div className="relative w-full max-w-3xl aspect-[2/3] max-h-[85vh] flex items-center justify-center bg-zinc-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={pagesData.pageUrls[currentPage - 1]}
                alt={`Page ${currentPage}`}
                className="w-full h-full object-contain"
              />

              {/* Invisible Click Zones for Left/Right Page Flip */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPage();
                }}
                className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize group flex items-center justify-start pl-4"
              >
                <div className="opacity-0 group-hover:opacity-100 p-3 rounded-full bg-black/60 text-[#42f5dd] backdrop-blur-md transition-opacity">
                  <ChevronLeft className="w-6 h-6" />
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPage();
                }}
                className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize group flex items-center justify-end pr-4"
              >
                <div className="opacity-0 group-hover:opacity-100 p-3 rounded-full bg-black/60 text-[#42f5dd] backdrop-blur-md transition-opacity">
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
                className="p-2.5 rounded-xl bg-white/[0.08] hover:bg-[#42f5dd]/20 hover:text-[#42f5dd] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
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
                className="p-2.5 rounded-xl bg-[#42f5dd] text-black hover:bg-[#34dbcb] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-black shadow-md shadow-[#42f5dd]/20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM FLOATING CONTROLS */}
      <footer
        className={`fixed bottom-4 inset-x-0 mx-auto w-fit z-50 transition-all duration-300 ${
          showControls ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none"
        } bg-black/90 backdrop-blur-2xl border border-[#42f5dd]/30 rounded-2xl px-5 py-2.5 flex items-center gap-4 shadow-2xl shadow-[#42f5dd]/10`}
      >
        {/* Prev Chapter */}
        {prevChapter ? (
          <Link
            href={`/manga/${mangaId}/read/${prevChapter.id}`}
            className="flex items-center gap-1 text-xs font-black text-white/80 hover:text-[#42f5dd] transition-colors cursor-pointer"
            title={`Prev: Ch. ${prevChapter.chapterNumber}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Ch. {prevChapter.chapterNumber}</span>
          </Link>
        ) : (
          <span className="text-xs text-white/20 font-bold">First Chapter</span>
        )}

        <div className="w-px h-4 bg-white/20" />

        {/* Current Position */}
        <span className="text-xs font-black text-[#42f5dd]">
          Page {currentPage} / {totalPages}
        </span>

        <div className="w-px h-4 bg-white/20" />

        {/* Next Chapter (ONLY shows if next chapter exists) */}
        {nextChapter ? (
          <Link
            href={`/manga/${mangaId}/read/${nextChapter.id}`}
            className="flex items-center gap-1 text-xs font-black text-[#42f5dd] hover:text-white transition-colors cursor-pointer"
            title={`Next: Ch. ${nextChapter.chapterNumber}`}
          >
            <span>Ch. {nextChapter.chapterNumber}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="text-xs text-[#42f5dd]/50 font-bold">Latest Chapter</span>
        )}
      </footer>
    </div>
  );
}
