"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { fetchJson } from "@/lib/utils";
import { BookOpen, Star, ArrowLeft, Clock, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

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
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  read: boolean;
}

// Get manga embed URL for reading
function getMangaEmbedUrl(mangaName: string, chapter: number): string {
  const clean = mangaName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  
  // Use MangaDex embed through 3rd party reader
  return `https://mangareader.to/read/${clean}/${chapter}`;
}

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

  const handleChapterChange = (direction: "prev" | "next") => {
    if (!selectedChapter) return;
    const currentIndex = chapters.findIndex((c) => c.number === selectedChapter.number);
    if (direction === "prev" && currentIndex < chapters.length - 1) {
      setSelectedChapter(chapters[currentIndex + 1]);
    } else if (direction === "next" && currentIndex > 0) {
      setSelectedChapter(chapters[currentIndex - 1]);
    }
  };

  if (readMode && selectedChapter && manga) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar />
        
        <main className="md:pl-56 lg:pl-64">
          {/* Reader Header */}
          <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setReadMode(false)}
                  className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <span className="text-white/30">|</span>
                <span className="text-sm font-medium text-white truncate max-w-[200px] md:max-w-md">
                  {manga.name}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleChapterChange("prev")}
                  disabled={selectedChapter.number >= chapters.length}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="text-sm text-white/60 px-2">
                  Ch. {selectedChapter.number}
                </span>
                <button
                  onClick={() => handleChapterChange("next")}
                  disabled={selectedChapter.number <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white disabled:opacity-30 transition"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Manga Reader Iframe */}
          <div className="w-full h-[calc(100vh-60px)] bg-black">
            <iframe
              src={getMangaEmbedUrl(manga.name, selectedChapter.number)}
              className="w-full h-full"
              allow="fullscreen"
              title={`${manga.name} - Chapter ${selectedChapter.number}`}
            />
          </div>
        </main>
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
            {/* Hero backdrop */}
            <div className="relative w-full h-[55vh] md:h-[65vh] flex items-end overflow-hidden">
              <div className="absolute inset-0">
                <img
                  src={manga.poster}
                  alt={manga.name}
                  className="w-full h-full object-cover object-top scale-105 blur-sm brightness-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
              </div>

              <div className="relative z-10 pb-10 md:pb-16 px-5 md:px-12 flex items-end gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
                {/* Poster */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="hidden md:block shrink-0 w-40 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
                >
                  <img src={manga.poster} alt={manga.name} className="w-full h-full object-cover" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="flex flex-col gap-3 max-w-2xl"
                >
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-600/90 text-white text-[10px] font-extrabold tracking-widest px-2.5 py-1 rounded-full uppercase">
                      📚 Manga
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

                  {/* Stats */}
                  <div className="flex items-center gap-4 flex-wrap text-xs text-white/50">
                    {manga.rating && (
                      <span className="flex items-center gap-1 text-amber-400 font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {manga.rating}
                      </span>
                    )}
                    {manga.chapters && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {manga.chapters} chapters
                      </span>
                    )}
                    {manga.year && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {manga.year}
                      </span>
                    )}
                  </div>

                  {/* Genres */}
                  {manga.genres && manga.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {manga.genres.slice(0, 6).map((g) => (
                        <span key={g} className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-white/60 text-sm leading-relaxed line-clamp-3 max-w-xl">
                    {manga.description}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Content below */}
            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-8">
              <Link
                href="/manga"
                className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Manga
              </Link>

              {/* Read Button */}
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
                      const chapter = chapters.find((c) => c.number === parseInt(e.target.value));
                      if (chapter) setSelectedChapter(chapter);
                    }}
                    className="h-12 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm font-semibold outline-none"
                  >
                    {chapters.map((ch) => (
                      <option key={ch.id} value={ch.number}>
                        Chapter {ch.number} {ch.read && "✓"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {chaptersLoading && (
                <div className="h-14 rounded-xl bg-muted/50 animate-pulse" />
              )}

              {/* Chapter list */}
              {!chaptersLoading && chapters.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-white mb-4">Chapters</h2>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                    {chapters.slice(0, 48).map((ch) => (
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
                  {chapters.length > 48 && (
                    <p className="text-center text-white/40 text-sm mt-4">
                      + {chapters.length - 48} more chapters
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
