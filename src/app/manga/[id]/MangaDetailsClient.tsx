"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { MangaItem, MangaChapter } from "@/lib/manga-fetch";
import { getMangaProgress, MangaReadingProgress } from "@/lib/manga-history";
import { fetchJson } from "@/lib/utils";
import { 
  BookOpen, 
  ArrowLeft, 
  ArrowUpDown, 
  Search, 
  Play, 
  CheckCircle2, 
  Loader2, 
  Users, 
  Calendar, 
  Bookmark,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { usePageContentReady } from "@/lib/pageLoad";

export default function MangaDetailsClient({ id }: { id: string }) {
  const [manga, setManga] = useState<MangaItem | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default order: Latest to Oldest (Descending) as requested
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [chapterSearch, setChapterSearch] = useState("");
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [progress, setProgress] = useState<MangaReadingProgress | null>(null);

  usePageContentReady(!isLoading);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    setProgress(getMangaProgress(id));

    const loadDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [detailsData, chaptersData] = await Promise.all([
          fetchJson<{ success: boolean; item: MangaItem }>(`/api/manga/details/${id}`),
          fetchJson<{ success: boolean; chapters: MangaChapter[] }>(`/api/manga/chapters/${id}?order=asc&limit=500`),
        ]);

        if (detailsData.success && detailsData.item) {
          setManga(detailsData.item);
        } else {
          setError("Failed to load manga details");
        }

        if (chaptersData.success && chaptersData.chapters) {
          setChapters(chaptersData.chapters || []);
        }
      } catch (err: any) {
        console.error("Failed to load manga:", err);
        setError(err.message || "Failed to load manga");
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [id]);

  // Filter and sort chapters in strict descending (latest to oldest) or ascending order
  const filteredChapters = useMemo(() => {
    let result = [...chapters];

    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.chapterNumber.toLowerCase().includes(q) ||
          (c.title && c.title.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const numA = parseFloat(a.chapterNumber) || 0;
      const numB = parseFloat(b.chapterNumber) || 0;
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });

    return result;
  }, [chapters, chapterSearch, sortOrder]);

  // First chapter (Chapter 1) & latest chapter
  const firstChapter = useMemo(() => {
    if (chapters.length === 0) return null;
    return [...chapters].sort((a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0))[0];
  }, [chapters]);

  const resumeChapter = useMemo(() => {
    if (!progress || chapters.length === 0) return null;
    return chapters.find((c) => c.id === progress.chapterId) || null;
  }, [progress, chapters]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Sidebar />
        <Loader2 className="w-8 h-8 animate-spin text-[#42f5dd]" />
      </div>
    );
  }

  if (error || !manga) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <Sidebar />
        <BookOpen className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Manga Not Found</h2>
        <p className="text-sm text-white/50 mb-6">{error || "Could not retrieve manga data."}</p>
        <Link
          href="/manga"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#42f5dd] text-black font-black text-sm shadow-lg shadow-[#42f5dd]/30"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Manga Hub</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64">
        {/* Cinematic Backdrop Hero */}
        <div className="relative w-full bg-gradient-to-b from-[#42f5dd]/15 via-background/80 to-background border-b border-white/[0.06] pt-10 md:pt-14 pb-12 px-5 sm:px-8 md:px-12">
          <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-8 items-start">
            
            {/* Poster Card */}
            <div className="shrink-0 w-48 sm:w-56 md:w-64 aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl border-2 border-[#42f5dd]/30 bg-muted/40 relative shadow-[0_0_30px_rgba(66,245,221,0.15)]">
              <img
                src={manga.coverImage}
                alt={manga.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-black uppercase text-[#42f5dd] border border-[#42f5dd]/40">
                {manga.type}
              </div>
            </div>

            {/* Main Info */}
            <div className="flex-1 flex flex-col items-start gap-4">
              <Link
                href="/manga"
                className="inline-flex items-center gap-2 text-xs font-black text-[#42f5dd] hover:text-white transition-colors bg-[#42f5dd]/10 px-4 py-1.5 rounded-full border border-[#42f5dd]/30 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Manga</span>
              </Link>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {manga.title}
              </h1>

              {/* Status & Metadata Badges */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
                <span className="px-3.5 py-1 rounded-full bg-[#42f5dd]/15 text-[#42f5dd] border border-[#42f5dd]/30 capitalize font-black">
                  {manga.status}
                </span>
                {manga.releaseYear && (
                  <span className="px-3 py-1 rounded-full bg-white/[0.06] text-white/80 border border-white/[0.08]">
                    {manga.releaseYear}
                  </span>
                )}
                {chapters.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-white/[0.06] text-white/80 border border-white/[0.08]">
                    {chapters.length} Chapters
                  </span>
                )}
                {manga.authors && manga.authors.length > 0 && (
                  <span className="text-white/60 flex items-center gap-1.5 ml-2 font-semibold">
                    <Users className="w-3.5 h-3.5 text-[#42f5dd]" />
                    <span>{manga.authors.join(", ")}</span>
                  </span>
                )}
              </div>

              {/* Synopsis */}
              <div className="max-w-3xl text-sm leading-relaxed text-zinc-300 font-medium">
                <p className={!isDescExpanded ? "line-clamp-3" : ""}>
                  {manga.description}
                </p>
                {manga.description.length > 200 && (
                  <button
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-xs font-black text-[#42f5dd] hover:text-white mt-2 flex items-center gap-1 cursor-pointer focus:outline-none"
                  >
                    <span>{isDescExpanded ? "Show Less" : "Read More"}</span>
                    {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Genre Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {manga.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-xl text-[11px] font-bold bg-white/[0.04] text-white/70 border border-white/[0.06]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Call to Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {resumeChapter ? (
                  <Link
                    href={`/manga/${manga.id}/read/${resumeChapter.id}`}
                    className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-[#42f5dd] hover:bg-[#34dbcb] text-black font-black text-sm transition-all shadow-xl shadow-[#42f5dd]/30 active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Continue Chapter {progress?.chapterNumber}</span>
                  </Link>
                ) : firstChapter ? (
                  <Link
                    href={`/manga/${manga.id}/read/${firstChapter.id}`}
                    className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-[#42f5dd] hover:bg-[#34dbcb] text-black font-black text-sm transition-all shadow-xl shadow-[#42f5dd]/30 active:scale-95 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Start Reading (Ch. {firstChapter.chapterNumber})</span>
                  </Link>
                ) : null}
              </div>

            </div>
          </div>
        </div>

        {/* Chapters Section - Clean Vertical Line-Up from Top to Bottom */}
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 md:px-12 pt-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-[#42f5dd] rounded-full shadow-[0_0_10px_#42f5dd]" />
              <h2 className="text-2xl font-black text-white tracking-tight">
                Chapters
              </h2>
              <span className="text-xs text-[#42f5dd] font-bold bg-[#42f5dd]/10 px-2.5 py-0.5 rounded-full border border-[#42f5dd]/30">
                {chapters.length} Total
              </span>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#42f5dd]/60" />
                <input
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  placeholder="Filter chapters..."
                  className="h-10 pl-9 pr-3 w-40 sm:w-48 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-white/30 outline-none focus:border-[#42f5dd]/60"
                />
              </div>

              {/* Order Toggle Button (Latest First vs Oldest First) */}
              <button
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#42f5dd]/15 hover:bg-[#42f5dd]/25 border border-[#42f5dd]/40 text-xs font-black text-[#42f5dd] hover:text-white transition-all cursor-pointer shadow-sm"
                title="Toggle chapter order"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#42f5dd]" />
                <span>{sortOrder === "desc" ? "Latest First" : "Oldest First"}</span>
              </button>
            </div>
          </div>

          {/* Clean Ordered Vertical Top-to-Bottom Chapter List */}
          {filteredChapters.length > 0 ? (
            <div className="flex flex-col gap-2.5 max-w-4xl">
              {filteredChapters.map((ch) => {
                const isCurrentRead = progress?.chapterId === ch.id;
                return (
                  <Link
                    key={ch.id}
                    href={`/manga/${manga.id}/read/${ch.id}`}
                    className={`group relative flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isCurrentRead
                        ? "bg-[#42f5dd]/15 border-[#42f5dd]/50 text-[#42f5dd] shadow-md shadow-[#42f5dd]/10"
                        : "bg-card/40 border-white/[0.06] hover:bg-white/[0.06] hover:border-[#42f5dd]/40 text-white"
                    }`}
                  >
                    {/* Left: Chapter Number & Title */}
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isCurrentRead
                          ? "bg-[#42f5dd] text-black"
                          : "bg-white/[0.06] text-white/70 group-hover:bg-[#42f5dd]/20 group-hover:text-[#42f5dd] transition-colors"
                      }`}>
                        {ch.chapterNumber}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm sm:text-base tracking-tight truncate group-hover:text-[#42f5dd] transition-colors">
                            {ch.title || `Chapter ${ch.chapterNumber}`}
                          </span>
                          {isCurrentRead && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#42f5dd]/25 text-[#42f5dd] border border-[#42f5dd]/40">
                              Current Read
                            </span>
                          )}
                        </div>
                        {ch.title && ch.title !== `Chapter ${ch.chapterNumber}` && (
                          <span className="text-xs text-white/40 truncate font-medium">
                            Chapter {ch.chapterNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Date & Play Indicator */}
                    <div className="flex items-center gap-3 shrink-0">
                      {ch.publishAt && !isNaN(new Date(ch.publishAt).getTime()) && (
                        <span className="text-xs text-zinc-400 font-semibold hidden sm:inline">
                          {format(new Date(ch.publishAt), "MMM d, yyyy")}
                        </span>
                      )}
                      <div className="w-8 h-8 rounded-full bg-white/[0.04] group-hover:bg-[#42f5dd] group-hover:text-black flex items-center justify-center text-white/40 transition-all">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6">
              <BookOpen className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No chapters match your search</h3>
              <p className="text-xs text-white/50">Try clearing the search filter.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
