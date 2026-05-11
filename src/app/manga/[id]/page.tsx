"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { fetchJson } from "@/lib/utils";
import { BookOpen, Star, ArrowLeft, Clock, ChevronLeft, ChevronRight, Maximize2, Minimize2, Settings, ZoomIn, ZoomOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MangaDetail {
  id: string;
  name: string;
  poster: string;
  description: string;
  type?: string;
  genres?: string[];
  year?: number;
  chapters?: number;
  volumes?: number;
  status?: string;
  rating?: string | null;
  author?: string;
  tags?: string[];
  lastChapter?: string | null;
  originalLanguage?: string;
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  read: boolean;
}

interface ChapterPage {
  chapterId: string;
  pages: string[];
  baseUrl?: string;
  hash?: string;
}

type ReadDirection = "horizontal" | "vertical";
type ZoomLevel = number;

export default function MangaDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [manga, setManga] = useState<MangaDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [readMode, setReadMode] = useState(false);
  const [chapterData, setChapterData] = useState<ChapterPage | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [readDirection, setReadDirection] = useState<ReadDirection>("vertical");
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const readerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJson<{ success: boolean; data: MangaDetail }>(
          `/api/manga/${id}`
        );
        if (data.success && data.data) {
          setManga(data.data);
        } else {
          throw new Error("Manga not found");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load manga");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const loadChapter = useCallback(async (chapter: Chapter) => {
    setChapterLoading(true);
    setChapterData(null);
    setCurrentPage(0);
    try {
      const data = await fetchJson<{ success: boolean; data: ChapterPage; error?: string }>(
        `/api/manga/chapter/${chapter.id}`
      );
      if (data.success && data.data?.pages) {
        setChapterData(data.data);
      } else {
        throw new Error(data.error || "Failed to load chapter");
      }
    } catch {
      setChapterData(null);
    } finally {
      setChapterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    const loadChapters = async () => {
      setChaptersLoading(true);
      try {
        const data = await fetchJson<{
          success: boolean;
          data: { chapters: Chapter[]; totalChapters: number; manga: MangaDetail };
        }>(`/api/manga/${id}/chapters`);
        if (data.success && data.data?.chapters) {
          setChapters(data.data.chapters);
          if (data.data.chapters.length > 0) {
            setSelectedChapter(data.data.chapters[0]);
          }
        }
      } catch {
        // Chapters failed silently
      } finally {
        setChaptersLoading(false);
      }
    };
    loadChapters();
  }, [id]);

  useEffect(() => {
    if (selectedChapter && readMode) {
      loadChapter(selectedChapter);
    }
  }, [selectedChapter, readMode, loadChapter]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  const handleChapterChange = (direction: "prev" | "next") => {
    if (!selectedChapter) return;
    const currentIndex = chapters.findIndex((c) => c.id === selectedChapter.id);
    let newIndex = -1;
    if (direction === "prev" && currentIndex < chapters.length - 1) {
      newIndex = currentIndex + 1;
    } else if (direction === "next" && currentIndex > 0) {
      newIndex = currentIndex - 1;
    }
    if (newIndex !== -1) {
      const newChapter = chapters[newIndex];
      setSelectedChapter(newChapter);
      loadChapter(newChapter);
    }
  };

  const handleChapterSelect = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    loadChapter(chapter);
  };

  const toggleFullscreen = async () => {
    if (!readerRef.current) return;
    if (!document.fullscreenElement) {
      await readerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleZoom = (delta: number) => {
    setZoom((z) => Math.min(200, Math.max(50, z + delta)));
  };

  if (readMode && selectedChapter && manga) {
    const totalPages = chapterData?.pages?.length || 0;

    return (
      <div
        className="fixed inset-0 z-[100] bg-black"
        onMouseMove={handleMouseMove}
        ref={readerRef}
      >
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 via-black/60 to-transparent"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setReadMode(false)}
                    className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                  <span className="text-white/20 hidden sm:block">|</span>
                  <span className="text-sm font-medium text-white truncate max-w-[180px] md:max-w-md">
                    {manga.name}
                  </span>
                  <span className="text-amber-400 text-xs font-bold">
                    Ch. {selectedChapter.number}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleZoom(-10)}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-white/50 w-12 text-center">{zoom}%</span>
                  <button
                    onClick={() => handleZoom(10)}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <span className="text-white/20">|</span>

                  <button
                    onClick={() => setReadDirection(d => d === "vertical" ? "horizontal" : "vertical")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      readDirection === "vertical"
                        ? "bg-amber-600 text-white"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                    }`}
                    title="Toggle reading direction"
                  >
                    {readDirection === "vertical" ? "↓ Vertical" : "→ Horizontal"}
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 pb-3">
                <button
                  onClick={() => handleChapterChange("prev")}
                  disabled={chapters.findIndex((c) => c.id === selectedChapter.id) >= chapters.length - 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 transition text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>

                <select
                  value={selectedChapter.number}
                  onChange={(e) => {
                    const ch = chapters.find((c) => c.number === parseFloat(e.target.value));
                    if (ch) handleChapterSelect(ch);
                  }}
                  className="h-9 px-3 rounded-lg bg-white/10 border border-white/10 text-white text-sm font-medium outline-none cursor-pointer"
                >
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.number} className="bg-zinc-900">
                      Ch. {ch.number} {ch.title !== `Chapter ${ch.number}` ? `- ${ch.title}` : ""}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleChapterChange("next")}
                  disabled={chapters.findIndex((c) => c.id === selectedChapter.id) <= 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 transition text-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {chapterLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 pt-24">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/60 text-sm">Loading chapter...</span>
          </div>
        ) : chapterData?.pages && chapterData.pages.length > 0 ? (
          <div
            className={`w-full h-full overflow-auto ${readDirection === "vertical" ? "pt-20" : "pt-20"}`}
            style={{ cursor: showControls ? "default" : "none" }}
          >
            {readDirection === "vertical" ? (
              <div className="flex flex-col items-center gap-2 pb-4">
                {chapterData.pages.map((page, idx) => (
                  <img
                    key={`${page}-${idx}`}
                    src={page}
                    alt={`Page ${idx + 1}`}
                    className="max-w-full object-contain"
                    style={{ maxHeight: "85vh", transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                    loading={idx < 3 ? "eager" : "lazy"}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-start justify-center h-full gap-1 px-4">
                {chapterData.pages.map((page, idx) => (
                  <img
                    key={`${page}-${idx}`}
                    src={page}
                    alt={`Page ${idx + 1}`}
                    className="h-full w-auto object-contain"
                    style={{ maxHeight: "90vh", transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                    loading={idx < 3 ? "eager" : "lazy"}
                  />
                ))}
              </div>
            )}

            {totalPages > 0 && showControls && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-white/60">
                {currentPage + 1} / {totalPages}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full pt-24 gap-4">
            <div className="text-4xl">📖</div>
            <p className="text-white/60 text-sm">Failed to load chapter pages.</p>
            <button
              onClick={() => loadChapter(selectedChapter)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-500 transition"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-0">
        {isLoading ? (
          <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
            <div className="w-full h-[60vh] rounded-2xl bg-muted/50 animate-pulse" />
          </div>
        ) : error ? (
          <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <div className="text-2xl mb-2">😔</div>
              <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load manga</div>
              <div className="text-sm text-white/50">{error}</div>
            </div>
          </div>
        ) : manga ? (
          <>
            <div className="relative w-full h-[55vh] md:h-[65vh] flex items-end overflow-hidden">
              <div className="absolute inset-0">
                <img
                  src={manga.poster}
                  alt={manga.name}
                  className="w-full h-full object-cover object-top scale-105 blur-sm brightness-50"
                  onError={(e) => { e.currentTarget.src = ""; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
              </div>

              <div className="relative z-10 pb-10 md:pb-16 px-5 md:px-12 flex items-end gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="hidden md:block shrink-0 w-40 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
                >
                  <img src={manga.poster} alt={manga.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex flex-col gap-3 max-w-2xl"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-600/90 text-white text-[10px] font-extrabold tracking-widest px-2.5 py-1 rounded-full uppercase">
                      📚 {manga.originalLanguage === "ja" ? "Manga" : manga.originalLanguage === "ko" ? "Manhwa" : "Comic"}
                    </span>
                    {manga.type && (
                      <span className="bg-white/10 text-white/70 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">
                        {manga.type}
                      </span>
                    )}
                    {manga.status && (
                      <span className="bg-white/10 text-white/70 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">
                        {manga.status}
                      </span>
                    )}
                  </div>

                  <h1 className="font-bold text-3xl md:text-5xl text-white leading-tight">
                    {manga.name}
                  </h1>

                  <div className="flex items-center gap-4 flex-wrap text-xs text-white/50">
                    {manga.rating && (
                      <span className="flex items-center gap-1 text-amber-400 font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {manga.rating}
                      </span>
                    )}
                    {chapters.length > 0 && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {chapters.length} chapters
                      </span>
                    )}
                    {manga.year && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {manga.year}
                      </span>
                    )}
                  </div>

                  {manga.genres && manga.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {manga.genres.slice(0, 6).map((g) => (
                        <span key={g} className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  {manga.author && (
                    <p className="text-white/40 text-sm">by {manga.author}</p>
                  )}

                  <p className="text-white/60 text-sm leading-relaxed line-clamp-3 max-w-xl">
                    {manga.description}
                  </p>
                </motion.div>
              </div>
            </div>

            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-8">
              <Link
                href="/manga"
                className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Manga
              </Link>

              {!chaptersLoading && chapters.length > 0 && selectedChapter && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button
                    onClick={() => setReadMode(true)}
                    className="flex items-center gap-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-95 text-white font-bold px-8 py-4 rounded-xl text-sm transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                  >
                    <BookOpen className="w-5 h-5" />
                    Read Chapter {selectedChapter.number}
                  </button>

                  <select
                    value={selectedChapter.number}
                    onChange={(e) => {
                      const chapter = chapters.find((c) => c.number === parseFloat(e.target.value));
                      if (chapter) setSelectedChapter(chapter);
                    }}
                    className="h-12 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm font-semibold outline-none cursor-pointer"
                  >
                    {chapters.map((ch) => (
                      <option key={ch.id} value={ch.number} className="bg-zinc-900">
                        Chapter {ch.number} {ch.read && "✓"}
                      </option>
                    ))}
                  </select>

                  <select
                    onChange={(e) => setReadDirection(e.target.value as ReadDirection)}
                    className="h-12 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white/70 text-sm font-semibold outline-none cursor-pointer"
                  >
                    <option value="vertical" className="bg-zinc-900">↓ Vertical Scroll</option>
                    <option value="horizontal" className="bg-zinc-900">→ Horizontal</option>
                  </select>
                </div>
              )}

              {chaptersLoading && (
                <div className="h-14 rounded-xl bg-muted/50 animate-pulse" />
              )}

              {!chaptersLoading && chapters.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">Chapters</h2>
                    <span className="text-sm text-white/40">{chapters.length} chapters</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                    {chapters.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setSelectedChapter(ch);
                          setReadMode(true);
                        }}
                        className={`aspect-square rounded-lg text-sm font-bold transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                          selectedChapter?.id === ch.id
                            ? "bg-amber-600 text-white shadow-lg shadow-amber-500/30 scale-105"
                            : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
                        }`}
                      >
                        <span>{ch.number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chapters.length === 0 && !chaptersLoading && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <div className="text-2xl mb-2">📖</div>
                  <div className="text-lg font-bold text-white mb-1">No chapters available</div>
                  <div className="text-sm text-white/50">This manga may not have any translated chapters yet.</div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}