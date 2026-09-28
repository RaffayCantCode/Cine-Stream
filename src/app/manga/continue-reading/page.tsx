"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  saveLocalMangaProgress,
  removeLocalMangaProgress,
  fetchServerMangaHistory,
  saveServerMangaProgress,
  removeServerMangaProgress,
  MangaReadingProgress,
} from "@/lib/manga-history";
import { fetchJson } from "@/lib/utils";
import { MangaItem } from "@/lib/manga-fetch";

export default function ContinueReadingPage() {
  const { status } = useSession();
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [items, setItems] = useState<MangaReadingProgress[]>(() =>
    typeof window !== "undefined" ? getLocalMangaHistory() : []
  );
  const [isLoading, setIsLoading] = useState(true);
  const discardedIdsRef = useRef<Set<string>>(new Set());
  const lastFetchTsRef = useRef<number>(0);

  const refreshHistory = useCallback(async (isBackground = false) => {
    const isDiscarded = (id: string) => {
      const clean = id.replace(/^(wc|asura)-/, "");
      return discardedIdsRef.current.has(id) || discardedIdsRef.current.has(clean);
    };

    if (isBackground && Date.now() - lastFetchTsRef.current < 60_000) {
      return;
    }

    if (status === "loading") {
      const local = getLocalMangaHistory().filter((item) => !isDiscarded(item.mangaId));
      if (local.length > 0) setItems(local);
      setIsLoading(false);
      return;
    }

    if (status === "authenticated") {
      if (!isBackground) setIsLoading(true);
      try {
        lastFetchTsRef.current = Date.now();
        const serverItems = await fetchServerMangaHistory();
        const filtered = serverItems.filter((item) => !isDiscarded(item.mangaId));
        setItems(filtered);
      } catch (err) {
        console.warn("[ContinueReadingPage] Failed to fetch server history:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      const local = getLocalMangaHistory().filter((item) => !isDiscarded(item.mangaId));
      setItems(local);
    }
  }, [status]);

  useEffect(() => {
    refreshHistory(false);

    const handleImmediate = () => {
      refreshHistory(false);
    };

    const handleBackground = () => {
      refreshHistory(true);
    };

    window.addEventListener("cinestream:manga-history-updated", handleImmediate);
    window.addEventListener("pageshow", handleBackground);
    window.addEventListener("focus", handleBackground);
    window.addEventListener("visibilitychange", handleBackground);
    window.addEventListener("storage", handleImmediate);

    return () => {
      window.removeEventListener("cinestream:manga-history-updated", handleImmediate);
      window.removeEventListener("pageshow", handleBackground);
      window.removeEventListener("focus", handleBackground);
      window.removeEventListener("visibilitychange", handleBackground);
      window.removeEventListener("storage", handleImmediate);
    };
  }, [refreshHistory]);

  // Auto-heal reading history entries (covers and types)
  const healedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!items || items.length === 0) return;
    const candidates = items.filter(
      (item) =>
        !healedRef.current.has(item.mangaId) &&
        (
          !item.mangaCover ||
          item.mangaCover.includes("icon-512.png") ||
          item.mangaCover.includes("icon.png") ||
          item.mangaType === "manga"
        )
    );

    if (candidates.length === 0) return;

    candidates.forEach((cand) => healedRef.current.add(cand.mangaId));

    (async () => {
      let hasUpdates = false;
      const updatedMap = new Map<string, { cover?: string; type?: "manga" | "manhwa" | "manhua" }>();

      await Promise.all(
        candidates.map(async (item) => {
          try {
            const data = await fetchJson<{ success: boolean; item: MangaItem }>(
              `/api/manga/details/${item.mangaId}`
            ).catch(() => null);

            if (data?.success && data.item) {
              const newCover = data.item.coverImage;
              const newType = data.item.type;
              const coverChanged = !!newCover && !newCover.includes("icon-512.png") && newCover !== item.mangaCover;
              const typeChanged = !!newType && newType !== item.mangaType;

              if (coverChanged || typeChanged) {
                hasUpdates = true;
                const safeCover = coverChanged ? newCover : item.mangaCover;
                const safeType = typeChanged ? newType : item.mangaType;

                updatedMap.set(item.mangaId, {
                  cover: safeCover,
                  type: safeType,
                });

                const updatedItem = {
                  ...item,
                  mangaCover: safeCover,
                  mangaType: safeType,
                };
                saveLocalMangaProgress(updatedItem);
                if (status === "authenticated") {
                  saveServerMangaProgress(updatedItem, true).catch(() => {});
                }
              }
            }
          } catch {}
        })
      );

      if (hasUpdates) {
        setItems((prev) =>
          prev.map((item) => {
            const up = updatedMap.get(item.mangaId);
            if (!up) return item;
            return {
              ...item,
              mangaCover: up.cover || item.mangaCover,
              mangaType: up.type || item.mangaType,
            };
          })
        );
      }
    })();
  }, [items, status]);

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
    const cleanTarget = mangaId.replace(/^(wc|asura)-/, "");
    discardedIdsRef.current.add(mangaId);
    discardedIdsRef.current.add(cleanTarget);
    discardedIdsRef.current.add(`wc-${cleanTarget}`);
    discardedIdsRef.current.add(`asura-${cleanTarget}`);

    setItems((prev) =>
      prev.filter(
        (item) =>
          item.mangaId !== mangaId &&
          item.mangaId.replace(/^(wc|asura)-/, "") !== cleanTarget
      )
    );
    removeLocalMangaProgress(mangaId);
    if (status === "authenticated") {
      await removeServerMangaProgress(mangaId);
    }
  };

  if (status === "unauthenticated" && items.length === 0) {
    return (
      <div
        className="min-h-screen bg-background text-foreground pb-20"
        style={
          {
            "--primary": "42 75% 65%",
            "--primary-foreground": "210 30% 6%",
            "--ring": "42 75% 65%",
            "--accent": "42 75% 65%",
          } as React.CSSProperties
        }
      >
        <Sidebar />
        <main className="w-full pt-8 md:pt-24 lg:pt-28">
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
    <div
      className="min-h-screen bg-background text-foreground pb-20"
      style={
        {
          "--primary": "42 75% 65%",
          "--primary-foreground": "210 30% 6%",
          "--ring": "42 75% 65%",
          "--accent": "42 75% 65%",
        } as React.CSSProperties
      }
    >
      <Sidebar />
      <main className="w-full pt-8 md:pt-24 lg:pt-28">
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

              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
                {sortedItems.map((item) => {
                  const cleanId = item.mangaId.replace(/^(wc|asura)-/, "");
                  const isFallbackCover = !item.mangaCover || item.mangaCover.includes("icon-512.png") || item.mangaCover.includes("icon.png");
                  const effectiveCover = isFallbackCover && item.mangaId.startsWith("wc-")
                    ? `https://temp.compsci88.com/cover/normal/${cleanId}.webp`
                    : (item.mangaCover || "/icon-512.png");
                  const effectiveType = (item.mangaType === "manhwa" || item.mangaType === "manhua")
                    ? item.mangaType
                    : (/raeliana|duke's mansion|solo leveling|manhwa|webtoon/i.test(item.mangaTitle) || item.mangaId.startsWith("asura-")
                        ? "manhwa"
                        : item.mangaType || "manga");

                  return (
                    <div
                      key={item.mangaId}
                      className="group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl bg-zinc-950/90 border border-white/[0.08] hover:border-primary/45 hover:shadow-[0_12px_28px_hsl(var(--primary)/0.15)] transition-all duration-300 overflow-hidden"
                    >
                      {/* Poster Cover Box (Compact Aspect on Mobile) */}
                      <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] overflow-hidden bg-zinc-900">
                        <img
                          src={effectiveCover}
                          alt={item.mangaTitle}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (item.mangaId.startsWith("wc-") && target.src.includes("/normal/")) {
                              target.src = `https://temp.compsci88.com/cover/fallback/${cleanId}.jpg`;
                              return;
                            }
                            if (!target.src.includes("icon-512.png")) {
                              target.src = "/icon-512.png";
                            }
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        {/* Gradient Scrim */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />

                        {/* Top Floating Badges: Type on left, Discard X on right */}
                        <div className="absolute top-1.5 sm:top-2 inset-x-1.5 sm:inset-x-2 flex items-center justify-between z-20">
                          <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-black/90 text-primary border border-white/20 text-[8px] sm:text-[9px] font-black uppercase tracking-wider backdrop-blur-md">
                            {effectiveType}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.mangaId)}
                            className="w-7 h-7 rounded-full bg-black/85 hover:bg-rose-600 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all shadow-md active:scale-90 flex items-center justify-center cursor-pointer"
                            title="Remove from Continue Reading"
                            aria-label="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Poster Click to Resume */}
                        <Link
                          href={`/manga/${item.mangaId}/read/${item.chapterId}?title=${encodeURIComponent(item.mangaTitle)}&ch=${encodeURIComponent(item.chapterNumber)}&cover=${encodeURIComponent(effectiveCover)}&type=${encodeURIComponent(effectiveType)}`}
                          className="absolute inset-0 z-10"
                          title={`Resume Ch. ${item.chapterNumber}`}
                        />

                        {/* Bottom Chapter Overlay on Poster */}
                        <div className="absolute bottom-2 left-2 z-10">
                          <span className="text-primary font-mono font-black bg-black/90 px-2.5 py-1 rounded-lg border border-white/20 text-xs sm:text-sm shadow-lg backdrop-blur-md">
                            Ch. {item.chapterNumber}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Title & Action Row */}
                      <div className="p-2 sm:p-3 flex flex-col justify-between flex-1 gap-1.5 sm:gap-2 bg-zinc-950">
                        <Link
                          href={`/manga/${item.mangaId}`}
                          className="font-black text-[11px] sm:text-sm text-white line-clamp-1 hover:text-primary transition-colors block"
                          title={item.mangaTitle}
                        >
                          {item.mangaTitle}
                        </Link>

                        <div className="flex items-center gap-1 sm:gap-1.5 pt-1 border-t border-white/[0.06]">
                          <Link
                            href={`/manga/${item.mangaId}/read/${item.chapterId}?title=${encodeURIComponent(item.mangaTitle)}&ch=${encodeURIComponent(item.chapterNumber)}&cover=${encodeURIComponent(effectiveCover)}&type=${encodeURIComponent(effectiveType)}`}
                            className="flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-primary text-primary-foreground text-[10px] sm:text-xs font-black shadow-md shadow-primary/25 flex items-center justify-center gap-1 active:scale-95 transition-all hover:opacity-90 touch-manipulation cursor-pointer"
                            title={`Resume Reading Chapter ${item.chapterNumber}`}
                          >
                            <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current shrink-0" />
                            <span className="truncate">Resume</span>
                          </Link>

                          <Link
                            href={`/manga/${item.mangaId}`}
                            className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-primary transition-all flex items-center justify-center active:scale-95 touch-manipulation cursor-pointer shrink-0"
                            title="Open Manga Details"
                            aria-label="Open Manga Details"
                          >
                            <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
