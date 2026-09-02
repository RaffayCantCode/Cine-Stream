"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { MangaItem, MangaChapter } from "@/lib/manga-fetch";
import { 
  getLocalMangaProgress, 
  fetchServerMangaProgress, 
  saveServerMangaProgress,
  MangaReadingProgress,
  isChapterRead,
  toggleChapterReadStatus
} from "@/lib/manga-history";
import { useWatchlist } from "@/context/WatchlistContext";
import { fetchJson } from "@/lib/utils";
import { 
  BookOpen, 
  ArrowLeft, 
  ArrowUpDown, 
  Search, 
  Play, 
  Loader2, 
  Users, 
  ChevronDown, 
  ChevronUp,
  Bookmark,
  CheckCircle2,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { usePageContentReady } from "@/lib/pageLoad";

export interface MangaDetailsClientProps {
  id: string;
  initialManga?: MangaItem | null;
  initialChapters?: MangaChapter[];
}

export default function MangaDetailsClient({
  id,
  initialManga = null,
  initialChapters = [],
}: MangaDetailsClientProps) {
  const { data: session, status: authStatus } = useSession();
  const isAuthed = authStatus === "authenticated" && !!session?.user?.id;

  const [manga, setManga] = useState<MangaItem | null>(initialManga);
  const [isDetailsLoading, setIsDetailsLoading] = useState(!initialManga);

  const [chapters, setChapters] = useState<MangaChapter[]>(initialChapters);
  const [isChaptersLoading, setIsChaptersLoading] = useState(initialChapters.length === 0);

  const [error, setError] = useState<string | null>(null);

  // Default order: Latest to Oldest (Descending)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [chapterSearch, setChapterSearch] = useState("");
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<MangaReadingProgress | null>(() =>
    typeof window !== "undefined" ? getLocalMangaProgress(id) : null
  );
  const [readTick, setReadTick] = useState(0);

  const { isSaved, toggle } = useWatchlist();
  const inWatchlist = manga ? isSaved(manga.id, manga.type || "manga") : false;

  // Check if description text overflows 3 lines
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const checkOverflow = () => {
      if (!isDescExpanded) {
        setCanExpand(el.scrollHeight > el.clientHeight + 4);
      }
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [manga?.description, isDescExpanded]);

  // Shell signals ready after mount so NavigationLoader hides properly
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  usePageContentReady(isMounted);

  const lastProgressFetchRef = useRef<number>(0);

  // Fetch reading progress strictly based on active auth status
  const refreshProgress = useCallback(async (isBackground = false) => {
    if (isBackground && Date.now() - lastProgressFetchRef.current < 60_000) {
      return;
    }

    if (authStatus === "loading") {
      const local = getLocalMangaProgress(id);
      if (local) setProgress(local);
      return;
    }

    if (isAuthed) {
      try {
        lastProgressFetchRef.current = Date.now();
        const serverP = await fetchServerMangaProgress(id);
        if (serverP) {
          setProgress(serverP);
        } else {
          const local = getLocalMangaProgress(id);
          if (local) {
            setProgress(local);
            saveServerMangaProgress(local, true).catch(() => {});
          }
        }
      } catch (err) {
        console.warn("[MangaDetailsClient] Failed to fetch server progress:", err);
      }
    } else {
      setProgress(getLocalMangaProgress(id));
    }
  }, [authStatus, isAuthed, id]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    refreshProgress(false);

    const handleImmediateUpdate = () => {
      refreshProgress(false);
      setReadTick((t) => t + 1);
    };

    const handleBackgroundUpdate = () => {
      refreshProgress(true);
      setReadTick((t) => t + 1);
    };

    window.addEventListener("cinestream:manga-history-updated", handleImmediateUpdate);
    window.addEventListener("cinestream:manga-read-chapters-updated", handleImmediateUpdate);
    window.addEventListener("pageshow", handleBackgroundUpdate);
    window.addEventListener("focus", handleBackgroundUpdate);
    window.addEventListener("visibilitychange", handleBackgroundUpdate);
    window.addEventListener("storage", handleImmediateUpdate);

    let isMountedLocal = true;

    // 1. Fetch metadata/details if not provided
    if (!initialManga) {
      setIsDetailsLoading(true);
      fetchJson<{ success: boolean; item: MangaItem }>(`/api/manga/details/${id}`)
        .then((data) => {
          if (!isMountedLocal) return;
          if (data.success && data.item) {
            setManga(data.item);
          } else {
            setError("Failed to load manga details");
          }
        })
        .catch((err: any) => {
          if (!isMountedLocal) return;
          console.error("Failed to load manga details:", err);
          setError(err.message || "Failed to load manga details");
        })
        .finally(() => {
          if (isMountedLocal) setIsDetailsLoading(false);
        });
    }

    // 2. Fetch chapters if not provided
    if (initialChapters.length === 0) {
      setIsChaptersLoading(true);
      fetchJson<{ success: boolean; chapters: MangaChapter[] }>(`/api/manga/chapters/${id}?order=asc&limit=500`)
        .then((data) => {
          if (!isMountedLocal) return;
          if (data.success && data.chapters) {
            setChapters(data.chapters || []);
          }
        })
        .catch((err: any) => {
          if (!isMountedLocal) return;
          console.warn("Failed to load chapters:", err);
        })
        .finally(() => {
          if (isMountedLocal) setIsChaptersLoading(false);
        });
    }

    return () => {
      isMountedLocal = false;
      window.removeEventListener("cinestream:manga-history-updated", handleImmediateUpdate);
      window.removeEventListener("cinestream:manga-read-chapters-updated", handleImmediateUpdate);
      window.removeEventListener("pageshow", handleBackgroundUpdate);
      window.removeEventListener("focus", handleBackgroundUpdate);
      window.removeEventListener("visibilitychange", handleBackgroundUpdate);
      window.removeEventListener("storage", handleImmediateUpdate);
    };
  }, [id, initialManga, initialChapters.length, refreshProgress]);

  // Filter and sort chapters in strict descending (latest to oldest) or ascending order
  const filteredChapters = useMemo(() => {
    let result = [...chapters];

    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.chapterNumber.toLowerCase().includes(q) ||
          (c.title && c.title.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const numA = parseFloat(a.chapterNumber) || 0;
      const numB = parseFloat(b.chapterNumber) || 0;
      return sortOrder === "desc" ? numB - numA : numA - numB;
    });

    return result;
  }, [chapters, chapterSearch, sortOrder]);

  // First chapter (numerical Chapter 1 or lowest chapter)
  const firstChapter = useMemo(() => {
    if (chapters.length === 0) return null;
    return [...chapters].sort((a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0))[0];
  }, [chapters]);

  // Resume chapter based on active reading progress
  const resumeChapter = useMemo(() => {
    if (!progress || chapters.length === 0) return null;
    return chapters.find((c) => c.id === progress.chapterId) || null;
  }, [progress, chapters]);

  return (
    <div
      className="min-h-screen bg-background text-foreground pb-24 select-none"
      style={
        {
          "--primary": "48 100% 50%",
          "--primary-foreground": "0 0% 0%",
          "--ring": "48 100% 50%",
          "--accent": "48 100% 50%",
        } as React.CSSProperties
      }
    >
      <Sidebar />

      <main className="w-full pt-8 md:pt-24 lg:pt-28">
        {/* Error State */}
        {error && !manga && (
          <div className="max-w-4xl mx-auto px-6 py-20 text-center">
            <BookOpen className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">Failed to Load Manga</h2>
            <p className="text-sm text-zinc-400 mb-6">{error}</p>
            <Link
              href="/manga"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Manga Hub</span>
            </Link>
          </div>
        )}

        {/* DETAILS HERO SECTION (Modular / Fast Render) */}
        {isDetailsLoading ? (
          <div className="w-full px-5 sm:px-8 md:px-12 py-8 animate-pulse">
            <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
              <div className="w-48 sm:w-60 md:w-72 aspect-[2/3] rounded-3xl bg-white/[0.04]" />
              <div className="flex-1 space-y-4 pt-4">
                <div className="h-8 w-2/3 bg-white/[0.04] rounded-2xl" />
                <div className="h-4 w-1/3 bg-white/[0.04] rounded-xl" />
                <div className="h-20 w-full bg-white/[0.04] rounded-2xl" />
              </div>
            </div>
          </div>
        ) : manga && (
          <div className="relative overflow-hidden border-b border-white/10 pb-12 pt-4">
            {/* Background Blur Backdrop */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10 blur-3xl scale-125 pointer-events-none"
              style={{ backgroundImage: `url(${manga.coverImage})` }}
            />

            <div className="relative w-full px-5 sm:px-8 md:px-12">
              <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
                
                {/* Poster Cover */}
                <div className="w-48 sm:w-60 md:w-72 aspect-[2/3] shrink-0 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative group mx-auto md:mx-0">
                  <img
                    src={manga.coverImage}
                    alt={manga.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/80 backdrop-blur-md text-primary border border-primary/30 shadow-lg">
                    {manga.type}
                  </div>
                </div>

                {/* Info & Metadata */}
                <div className="flex-1 space-y-5 text-left w-full">
                  <Link
                    href="/manga"
                    className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-primary transition-colors mb-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>All Manga</span>
                  </Link>

                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                    {manga.title}
                  </h1>

                  {/* Status & Metadata Badges */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
                    <span className="px-3.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 capitalize font-black">
                      {manga.status}
                    </span>
                    {manga.releaseYear && (
                      <span className="px-3 py-1 rounded-full bg-white/[0.06] text-white/80 border border-white/[0.08]">
                        {manga.releaseYear}
                      </span>
                    )}
                    {chapters.length > 0 ? (
                      <span className="px-3 py-1 rounded-full bg-white/[0.06] text-white/80 border border-white/[0.08]">
                        {chapters.length} Chapters
                      </span>
                    ) : isChaptersLoading ? (
                      <span className="px-3 py-1 rounded-full bg-white/[0.06] text-primary/80 border border-white/[0.08] flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        <span>Loading Chapters...</span>
                      </span>
                    ) : null}
                    {manga.authors && manga.authors.length > 0 && (
                      <span className="text-white/60 flex items-center gap-1.5 ml-2 font-semibold">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>{manga.authors.join(", ")}</span>
                      </span>
                    )}
                  </div>

                  {/* Synopsis */}
                  <div className="max-w-3xl text-sm leading-relaxed text-zinc-300 font-medium">
                    <div
                      ref={descRef}
                      className={`whitespace-pre-line text-zinc-300 ${
                        !isDescExpanded ? "line-clamp-3" : "line-clamp-none"
                      }`}
                    >
                      {manga.description}
                    </div>
                    {canExpand && (
                      <button
                        type="button"
                        onClick={() => setIsDescExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-primary hover:opacity-80 mt-2.5 py-1 px-2.5 -ml-2.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer touch-manipulation focus:outline-none select-none"
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
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
                    {resumeChapter ? (
                      <Link
                        href={`/manga/${manga.id}/read/${resumeChapter.id}?title=${encodeURIComponent(manga.title)}&ch=${encodeURIComponent(progress?.chapterNumber || "")}`}
                        className="inline-flex items-center gap-2.5 bg-[#E5E5E5] hover:bg-white text-[#090F15] font-extrabold px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-xs sm:text-sm transition-all duration-300 shadow-xl shadow-black/40 hover:scale-[1.03] active:scale-95 cursor-pointer touch-manipulation"
                      >
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5 text-[#090F15]" />
                        <span>Continue Chapter {progress?.chapterNumber}</span>
                      </Link>
                    ) : firstChapter ? (
                      <Link
                        href={`/manga/${manga.id}/read/${firstChapter.id}?title=${encodeURIComponent(manga.title)}&ch=${encodeURIComponent(firstChapter.chapterNumber)}`}
                        className="inline-flex items-center gap-2.5 bg-[#E5E5E5] hover:bg-white text-[#090F15] font-extrabold px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-xs sm:text-sm transition-all duration-300 shadow-xl shadow-black/40 hover:scale-[1.03] active:scale-95 cursor-pointer touch-manipulation"
                      >
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5 text-[#090F15]" />
                        <span>Start Reading (Ch. {firstChapter.chapterNumber})</span>
                      </Link>
                    ) : isChaptersLoading ? (
                      <div className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white/70 text-xs font-bold">
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Loading Chapters...</span>
                      </div>
                    ) : null}

                    {/* Bookmark / Watchlist Button */}
                    <button
                      onClick={() => {
                        if (!manga) return;
                        toggle({
                          mediaId: manga.id,
                          mediaType: manga.type || "manga",
                          title: manga.title,
                          posterPath: manga.coverImage,
                        });
                      }}
                      className={`flex items-center gap-2 px-6 py-3.5 sm:py-4 rounded-2xl font-extrabold text-xs sm:text-sm border transition-all duration-300 active:scale-95 cursor-pointer touch-manipulation ${
                        inWatchlist
                          ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20"
                          : "bg-white/[0.08] hover:bg-white/[0.14] border-white/10 text-white"
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${inWatchlist ? "fill-current" : ""}`} />
                      <span>{inWatchlist ? "In Watchlist" : "Add to Watchlist"}</span>
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHAPTERS SECTION (Streams in modularly) */}
        <div className="w-full px-5 sm:px-8 md:px-12 pt-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_hsl(var(--primary))]" />
              <h2 className="text-2xl font-black text-white tracking-tight">
                Chapters {chapters.length > 0 && `(${chapters.length})`}
              </h2>
            </div>

            {/* Filter Search & Order Toggle */}
            {chapters.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  <input
                    type="text"
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder="Search chapter number..."
                    className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                </div>

                <button
                  onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                  className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/40 text-xs font-black text-primary hover:text-white transition-all cursor-pointer shadow-sm touch-manipulation"
                  title="Toggle chapter order"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
                  <span>{sortOrder === "desc" ? "Latest First" : "Oldest First"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Chapter Items List or Skeletons */}
          {isChaptersLoading ? (
            <div className="flex flex-col gap-2.5 w-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
              ))}
            </div>
          ) : filteredChapters.length > 0 ? (
            <div className="flex flex-col gap-2.5 w-full">
              {filteredChapters.map((ch) => {
                const isCurrentRead = progress?.chapterId === ch.id;
                const isRead = isCurrentRead || isChapterRead(manga?.id || id, ch.id, ch.chapterNumber, progress?.chapterNumber);

                return (
                  <Link
                    key={ch.id}
                    href={`/manga/${manga?.id || id}/read/${ch.id}?title=${encodeURIComponent(manga?.title || "")}&ch=${encodeURIComponent(ch.chapterNumber)}`}
                    className={`group relative flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-200 cursor-pointer touch-manipulation active:scale-[0.99] ${
                      isCurrentRead
                        ? "bg-primary/15 border-primary/50 text-primary shadow-md shadow-primary/10"
                        : isRead
                        ? "bg-card/30 border-white/[0.04] text-white/70 hover:border-primary/30 hover:text-white"
                        : "bg-card/50 border-white/[0.06] hover:bg-white/[0.06] hover:border-primary/40 text-white"
                    }`}
                  >
                    {/* Left: Chapter Number & Title */}
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isCurrentRead
                          ? "bg-primary text-primary-foreground"
                          : isRead
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-white/[0.06] text-white/70 group-hover:bg-primary/20 group-hover:text-primary transition-colors"
                      }`}>
                        {ch.chapterNumber}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-extrabold text-sm sm:text-base tracking-tight truncate group-hover:text-primary transition-colors ${
                            isRead && !isCurrentRead ? "text-white/80" : ""
                          }`}>
                            {ch.title || `Chapter ${ch.chapterNumber}`}
                          </span>
                          {isCurrentRead ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary/25 text-primary border border-primary/40">
                              Current Read
                            </span>
                          ) : isRead ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Read</span>
                            </span>
                          ) : null}
                        </div>
                        {ch.title && ch.title !== `Chapter ${ch.chapterNumber}` && (
                          <span className="text-xs text-white/40 truncate font-medium">
                            Chapter {ch.chapterNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Date, Read Toggle Button & Play Indicator */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {ch.publishAt && !isNaN(new Date(ch.publishAt).getTime()) && (
                        <span className="text-xs text-zinc-400 font-semibold hidden sm:inline mr-1">
                          {format(new Date(ch.publishAt), "MMM d, yyyy")}
                        </span>
                      )}

                      {/* Interactive 1-Click Mark as Read/Unread */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleChapterReadStatus(manga?.id || id, ch.id, ch.chapterNumber);
                          setReadTick((t) => t + 1);
                        }}
                        title={isRead ? "Mark as Unread" : "Mark as Read"}
                        className={`p-2 rounded-xl border transition-all cursor-pointer touch-manipulation active:scale-90 ${
                          isRead
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-white/[0.04] border-white/10 text-white/40 hover:text-white hover:bg-white/[0.08]"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <div className="w-8 h-8 rounded-full bg-white/[0.04] group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center text-white/40 transition-all">
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
