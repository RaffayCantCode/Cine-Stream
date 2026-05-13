"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { fetchJson } from "@/lib/utils";
import { BookOpen, ArrowLeft, Clock, ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut, Database, Globe, AlertCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface MangaDetail {
  id: string;
  name: string;
  poster: string;
  description: string;
  type?: string;
  genres?: string[];
  year?: number;
  author?: string;
  status?: string;
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  read: boolean;
  volume?: string | null;
  scanlationGroup?: string;
}

interface ChapterPage {
  chapterId: string;
  pages: string[];
}

function MangaDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const source = searchParams.get("source") || "mangadex";

  const [manga, setManga] = useState<MangaDetail | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [readMode, setReadMode] = useState(false);
  const [chapterData, setChapterData] = useState<ChapterPage | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [readDirection, setReadDirection] = useState<"vertical" | "horizontal">("vertical");
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);

  const readerRef = useState<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setChaptersLoading(true);
    setError(null);

    try {
      const url = `/api/manga/${id}/chapters?source=${source}`;
      const data = await fetchJson<{ success: boolean; data?: { manga: MangaDetail; chapters: Chapter[] }; error?: string }>(url);

      if (data.success && data.data) {
        setManga(data.data.manga);
        if (data.data.chapters.length > 0) {
          setChapters(data.data.chapters);
          setSelectedChapter(data.data.chapters[0]);
        }
      } else {
        throw new Error(data.error || "Failed to load manga");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load manga");
    } finally {
      setIsLoading(false);
      setChaptersLoading(false);
    }
  }, [id, source]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadChapter = useCallback(async (chapter: Chapter) => {
    setChapterLoading(true);
    setChapterData(null);
    try {
      const url = `/api/manga/chapter/${chapter.id}?source=${source}`;
      const data = await fetchJson<{ success: boolean; data?: ChapterPage; error?: string }>(url);
      if (data.success && data.data?.pages?.length) {
        setChapterData(data.data);
      } else {
        setChapterData({ chapterId: chapter.id, pages: [] });
      }
    } catch {
      setChapterData(null);
    } finally {
      setChapterLoading(false);
    }
  }, [source]);

  useEffect(() => {
    if (selectedChapter && readMode) {
      loadChapter(selectedChapter);
    }
  }, [selectedChapter, readMode, loadChapter]);

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFs);
    return () => document.removeEventListener("fullscreenchange", handleFs);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    setControlsTimeout(setTimeout(() => setShowControls(false), 3000));
  };

  const navigateChapter = (dir: "prev" | "next") => {
    if (!selectedChapter) return;
    const idx = chapters.findIndex(c => c.id === selectedChapter.id);
    let newIdx = -1;
    if (dir === "prev" && idx < chapters.length - 1) newIdx = idx + 1;
    else if (dir === "next" && idx > 0) newIdx = idx - 1;
    if (newIdx !== -1) {
      const ch = chapters[newIdx];
      setSelectedChapter(ch);
      loadChapter(ch);
    }
  };

  const toggleFullscreen = async () => {
    const el = document.querySelector(".reader-container") as HTMLElement;
    if (!el) return;
    if (!document.fullscreenElement) await el.requestFullscreen();
    else await document.exitFullscreen();
  };

  if (readMode && selectedChapter && manga) {
    return (
      <div className="fixed inset-0 z-[100] bg-black" onMouseMove={handleMouseMove}>
        {showControls && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setReadMode(false)} className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <span className="text-white/20 hidden sm:block">|</span>
                <span className="text-sm font-medium text-white truncate max-w-[200px]">{manga.name}</span>
                <span className="text-amber-400 text-xs font-bold">Ch. {selectedChapter.number}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20"> <ZoomOut className="w-4 h-4" /> </button>
                <span className="text-xs text-white/50 w-12 text-center">{zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20"> <ZoomIn className="w-4 h-4" /> </button>
                <span className="text-white/20">|</span>
                <button onClick={() => setReadDirection(d => d === "vertical" ? "horizontal" : "vertical")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${readDirection === "vertical" ? "bg-amber-600 text-white" : "bg-white/10 text-white/60"}`}>
                  {readDirection === "vertical" ? "↓ Vertical" : "→ Horizontal"}
                </button>
                <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20">
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 pb-3">
              <button onClick={() => navigateChapter("prev")} disabled={chapters.findIndex(c => c.id === selectedChapter.id) >= chapters.length - 1}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-30 text-sm">
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <select value={selectedChapter.id} onChange={(e) => { const ch = chapters.find(c => c.id === e.target.value); if (ch) { setSelectedChapter(ch); loadChapter(ch); } }}
                className="h-9 px-3 rounded-lg bg-white/10 border border-white/10 text-white text-sm min-w-[200px]">
                {chapters.map(ch => <option key={ch.id} value={ch.id} className="bg-zinc-900">Ch. {ch.number} - {ch.title || "No Title"}</option>)}
              </select>
              <button onClick={() => navigateChapter("next")} disabled={chapters.findIndex(c => c.id === selectedChapter.id) <= 0}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-30 text-sm">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {chapterLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 pt-24">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/60 text-sm">Loading chapter...</span>
          </div>
        ) : chapterData?.pages?.length ? (
          <div className={`reader-container w-full h-full overflow-auto pt-20 ${readDirection === "vertical" ? "" : "flex items-center justify-center"}`}
            style={{ cursor: showControls ? "default" : "none" }}>
            {readDirection === "vertical" ? (
              <div className="flex flex-col items-center gap-2 pb-4">
                {chapterData.pages.map((page, i) => (
                  <img key={i} src={page} alt={`Page ${i + 1}`}
                    style={{ maxHeight: "85vh", transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                    loading="lazy" className="max-w-full" />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full gap-1 px-4">
                {chapterData.pages.map((page, i) => (
                  <img key={i} src={page} alt={`Page ${i + 1}`}
                    style={{ maxHeight: "90vh", transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                    loading="lazy" className="h-full w-auto" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full pt-24 gap-4">
            <div className="text-4xl">📖</div>
            <p className="text-white/60 text-sm">Failed to load chapter pages</p>
            <button onClick={() => loadChapter(selectedChapter)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-500 transition flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
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
              <div className="flex items-center justify-center gap-2 mb-4">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <span className="text-2xl">😔</span>
              </div>
              <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load manga</div>
              <div className="text-sm text-white/50 mb-4">{error}</div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${source === "mangadex" ? "bg-violet-600 text-white" : "bg-emerald-600 text-white"} flex items-center gap-1.5`}>
                  {source === "mangadex" ? <><Database className="w-3.5 h-3.5" /> MangaDex</> : <><Globe className="w-3.5 h-3.5" /> WeebCentral</>}
                </span>
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={loadData} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-500 transition flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
                <Link href="/manga" className="px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm font-bold hover:bg-white/20 transition">
                  Back to Browse
                </Link>
              </div>
            </div>
          </div>
        ) : manga ? (
          <>
            <div className="relative w-full h-[55vh] md:h-[65vh] flex items-end overflow-hidden">
              <div className="absolute inset-0">
                <img src={manga.poster} alt={manga.name}
                  className="w-full h-full object-cover object-top scale-105 blur-sm brightness-50"
                  onError={(e) => { e.currentTarget.src = ""; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
              </div>
              <div className="relative z-10 pb-10 md:pb-16 px-5 md:px-12 flex items-end gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                  className="hidden md:block shrink-0 w-40 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <img src={manga.poster} alt={manga.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex flex-col gap-3 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`${source === "mangadex" ? "bg-violet-600" : "bg-emerald-600"} text-white text-[10px] font-extrabold tracking-widest px-2.5 py-1 rounded-full uppercase`}>
                      📚 {manga.type || "Manga"}
                    </span>
                    {manga.status && <span className="bg-white/10 text-white/70 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">{manga.status}</span>}
                  </div>
                  <h1 className="font-bold text-3xl md:text-5xl text-white leading-tight">{manga.name}</h1>
                  <div className="flex items-center gap-4 flex-wrap text-xs text-white/50">
                    {chapters.length > 0 && <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {chapters.length} chapters</span>}
                    {manga.year && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {manga.year}</span>}
                  </div>
                  {manga.genres && manga.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {manga.genres.slice(0, 6).map(g => (
                        <span key={g} className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">{g}</span>
                      ))}
                    </div>
                  )}
                  {manga.author && <p className="text-white/40 text-sm">by {manga.author}</p>}
                  <p className="text-white/60 text-sm leading-relaxed line-clamp-3 max-w-xl">{manga.description}</p>
                </motion.div>
              </div>
            </div>

            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-8">
              <div className="flex items-center justify-between">
                <Link href="/manga" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to Manga
                </Link>
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${source === "mangadex" ? "bg-violet-600/20 text-violet-400" : "bg-emerald-600/20 text-emerald-400"}`}>
                  {source === "mangadex" ? <Database className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                  {source === "mangadex" ? "MangaDex" : "WeebCentral"}
                </span>
              </div>

              {!chaptersLoading && chapters.length > 0 && selectedChapter && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button onClick={() => setReadMode(true)}
                    className="flex items-center gap-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold px-8 py-4 rounded-xl text-sm shadow-lg shadow-amber-500/25">
                    <BookOpen className="w-5 h-5" /> Read Chapter {selectedChapter.number}
                  </button>
                  <select value={selectedChapter.id}
                    onChange={(e) => { const ch = chapters.find(c => c.id === e.target.value); if (ch) setSelectedChapter(ch); }}
                    className="h-12 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm min-w-[200px]">
                    {chapters.map(ch => <option key={ch.id} value={ch.id} className="bg-zinc-900">Ch.{ch.number} - {ch.title || "No Title"}</option>)}
                  </select>
                  <select value={readDirection}
                    onChange={(e) => setReadDirection(e.target.value as "vertical" | "horizontal")}
                    className="h-12 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white/70 text-sm">
                    <option value="vertical" className="bg-zinc-900">↓ Vertical Scroll</option>
                    <option value="horizontal" className="bg-zinc-900">→ Horizontal</option>
                  </select>
                </div>
              )}

              {chaptersLoading && <div className="h-14 rounded-xl bg-muted/50 animate-pulse" />}

              {!chaptersLoading && chapters.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">Chapters</h2>
                    <span className="text-sm text-white/40">{chapters.length} chapters</span>
                  </div>
                  <div className="space-y-2">
                    {chapters.map(ch => (
                      <button key={ch.id} onClick={() => { setSelectedChapter(ch); setReadMode(true); }}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-4 ${selectedChapter?.id === ch.id ? "bg-amber-600 text-white" : "bg-white/[0.05] text-white/70 hover:bg-white/[0.09]"}`}>
                        <span className="font-bold text-sm w-16 shrink-0">Ch. {ch.number}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${selectedChapter?.id === ch.id ? "text-white" : "text-white/70"}`}>{ch.title || "No Title"}</p>
                          {ch.scanlationGroup && ch.scanlationGroup !== "Unknown" && (
                            <p className={`text-xs mt-0.5 truncate ${selectedChapter?.id === ch.id ? "text-amber-200" : "text-white/40"}`}>{ch.scanlationGroup}</p>
                          )}
                        </div>
                        {ch.volume && <span className={`text-xs shrink-0 ${selectedChapter?.id === ch.id ? "text-amber-200" : "text-white/30"}`}>Vol.{ch.volume}</span>}
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

export default function MangaDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MangaDetailContent />
    </Suspense>
  );
}