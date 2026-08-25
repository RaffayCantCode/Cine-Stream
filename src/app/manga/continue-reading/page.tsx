"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import {
  Bookmark,
  Play,
  BookOpen,
  X,
  LogIn,
  ArrowLeft,
  ArrowUpDown,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import {
  getLocalMangaHistory,
  removeLocalMangaProgress,
  fetchServerMangaHistory,
  removeServerMangaProgress,
  MangaReadingProgress,
} from "@/lib/manga-history";

export default function ContinueReadingPage() {
  const { status } = useSession();
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [items, setItems] = useState<MangaReadingProgress[]>(() =>
    typeof window !== "undefined" ? getLocalMangaHistory() : []
  );
  const [isLoading, setIsLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    if (status === "loading") {
      const local = getLocalMangaHistory();
      if (local.length > 0) setItems(local);
      setIsLoading(false);
      return;
    }

    if (status === "authenticated") {
      setIsLoading(true);
      try {
        const serverItems = await fetchServerMangaHistory();
        setItems(serverItems);
      } catch (err) {
        console.warn("[ContinueReadingPage] Failed to fetch server history:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      setItems(getLocalMangaHistory());
    }
  }, [status]);

  useEffect(() => {
    refreshHistory();

    const handler = () => {
      refreshHistory();
    };

    window.addEventListener("cinestream:manga-history-updated", handler);
    window.addEventListener("pageshow", handler);
    window.addEventListener("focus", handler);
    window.addEventListener("visibilitychange", handler);
    window.addEventListener("storage", handler);

    return () => {
      window.removeEventListener("cinestream:manga-history-updated", handler);
      window.removeEventListener("pageshow", handler);
      window.removeEventListener("focus", handler);
      window.removeEventListener("visibilitychange", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refreshHistory]);

  const sortedItems = useMemo(() => {
    const list = [...items];
    if (sortOrder === "oldest") {
      list.sort((a, b) => a.updatedAt - b.updatedAt);
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  }, [items, sortOrder]);

  const handleRemove = async (mangaId: string) => {
    setItems((prev) => prev.filter((item) => item.mangaId !== mangaId));
    if (status === "authenticated") {
      await removeServerMangaProgress(mangaId);
    } else {
      removeLocalMangaProgress(mangaId);
    }
  };

  if (status === "unauthenticated" && items.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
          <div className="px-5 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto">
            <div className="flex flex-col items-center justify-center text-center py-16 md:py-24">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20 text-primary mb-6 shadow-xl">
                <Bookmark className="w-10 h-10" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                No Reading History Found
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-md">
                Start reading any manga or manhwa, and your progress will automatically be saved here. Sign in to sync across all your devices.
              </p>
              <div className="flex items-center gap-4 mt-8">
                <Link
                  href="/manga"
                  className="inline-flex items-center gap-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all active:scale-95 shadow-xl shadow-black/40 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Browse Manga</span>
                </Link>
                <button
                  onClick={() => signIn()}
                  className="inline-flex items-center gap-2.5 bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold px-8 py-4 rounded-xl text-sm transition-all active:scale-95 border border-white/10 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-5 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto">
          <div className="mb-8">
            <Link
              href="/manga"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Manga
            </Link>
            <h1 className="flex items-center gap-3 text-4xl md:text-5xl font-black text-foreground tracking-tight">
              <Bookmark className="w-8 h-8 text-primary" />
              Continue Reading
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Pick up right where you left off. Your progress is synced across all
              your devices.
            </p>
            <div className="h-0.5 w-16 bg-primary/70 rounded-full mt-3 mb-6" />
          </div>

          {isLoading && items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] rounded-2xl bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 md:py-24">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground/60 mb-6">
                <BookOpen className="w-10 h-10" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                No manga in progress
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-md">
                Start reading a manga or manhwa and your progress will appear
                here.
              </p>
              <Link
                href="/manga"
                className="mt-8 inline-flex items-center gap-2 bg-primary hover:bg-primary/85 text-primary-foreground font-bold px-6 py-3.5 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-black/30"
              >
                <BookOpen className="w-4 h-4" />
                Browse Manga
              </Link>
            </div>
          ) : (
            <>
              {/* Sort Toggle */}
              <div className="flex items-center gap-2 mb-6">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <button
                    onClick={() => setSortOrder("latest")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      sortOrder === "latest"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    Latest First
                  </button>
                  <button
                    onClick={() => setSortOrder("oldest")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      sortOrder === "oldest"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    Oldest First
                  </button>
                </div>
                <span className="text-xs text-muted-foreground font-medium ml-1">
                  {items.length} {items.length === 1 ? "title" : "titles"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sortedItems.map((item) => (
                  <div
                    key={item.mangaId}
                    className="group relative flex flex-col justify-between p-4 rounded-3xl bg-zinc-900/90 border border-white/[0.08] hover:border-primary/50 hover:shadow-[0_12px_32px_hsl(var(--primary)/0.2)] transition-all duration-300 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemove(item.mangaId)}
                      className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/80 hover:bg-rose-600 text-white/60 hover:text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-lg opacity-80 hover:opacity-100 hover:scale-105 active:scale-95"
                      title="Remove from Continue Reading"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

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
                              Last read:{" "}
                              <strong className="text-primary">
                                Ch. {item.chapterNumber}
                              </strong>
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

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                      <Link
                        href={`/manga/${item.mangaId}/read/${item.chapterId}`}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-black transition-all shadow-md shadow-primary/25 flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation cursor-pointer hover:opacity-90"
                        title={`Resume Reading Chapter ${item.chapterNumber}`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume Ch. {item.chapterNumber}</span>
                      </Link>

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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
