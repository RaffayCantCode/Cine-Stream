"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MangaItem, MangaChapter, ChapterPagesData } from "@/lib/manga-fetch";
import {
  getLocalMangaProgress,
  fetchServerMangaProgress,
  saveLocalMangaProgress,
  saveServerMangaProgress,
  markChapterAsRead,
} from "@/lib/manga-history";
import { fetchJson } from "@/lib/utils";
import { getMangaTheme, mangaThemeStyle, resolveMangaKind } from "@/lib/manga-theme";
import {
  PagedReader,
  PagedReaderMode,
  ReadingDirection,
} from "@/components/manga/PagedReader";
import { MangaPageItem } from "@/components/manga/MangaPageItem";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize,
  Minimize,
  Sun,
  SunDim,
  X,
  List,
  Loader2,
  AlertCircle,
  RotateCcw,
  Settings,
  AlignJustify,
  Square,
  Columns,
  CheckCircle2,
} from "lucide-react";
import { usePageContentReady } from "@/lib/pageLoad";

export interface MangaReaderClientProps {
  mangaId: string;
  chapterId: string;
  initialManga?: MangaItem | null;
  initialChapters?: MangaChapter[];
  initialPages?: ChapterPagesData | null;
}

type ReaderMode = "webtoon" | PagedReaderMode;

const MODE_OPTIONS: {
  key: ReaderMode;
  label: string;
  hint: string;
  icon: typeof AlignJustify;
  desktopOnly?: boolean;
}[] = [
  { key: "webtoon", label: "Scroll", hint: "Continuous vertical strip", icon: AlignJustify },
  { key: "single", label: "Single", hint: "One page at a time", icon: Square },
  { key: "double", label: "Dual", hint: "Two-page spread", icon: Columns, desktopOnly: true },
];

export default function MangaReaderClient({
  mangaId,
  chapterId,
  initialManga = null,
  initialChapters = [],
  initialPages = null,
}: MangaReaderClientProps) {
  const { data: session, status: authStatus } = useSession();
  const isAuthed = authStatus === "authenticated" && !!session?.user?.id;

  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTitle = searchParams.get("title") || "";
  const queryCh = searchParams.get("ch") || "";
  const queryCover = searchParams.get("cover") || "";
  const queryType = searchParams.get("type") || "";

  const [sessionCover, setSessionCover] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<string | null>(null);

  const [manga, setManga] = useState<MangaItem | null>(initialManga);
  const [chapters, setChapters] = useState<MangaChapter[]>(initialChapters);
  const [pagesData, setPagesData] = useState<ChapterPagesData | null>(initialPages);
  const [isLoading, setIsLoading] = useState(!initialPages);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [brightness, setBrightness] = useState(100);
  const [webtoonWidth, setWebtoonWidth] = useState(100);
  const [readerMode, setReaderMode] = useState<ReaderMode>("webtoon");
  const [direction, setDirection] = useState<ReadingDirection>("rtl");
  const [isMobile, setIsMobile] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  const [showControls, setShowControls] = useState(true);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const prefsInitializedRef = useRef(false);
  const lastScrollPageRef = useRef(1);

  const resolvedKind = useMemo(
    () =>
      resolveMangaKind({
        type: manga?.type || initialManga?.type || queryType || sessionType,
        tags: manga?.tags,
        title: manga?.title || initialManga?.title || queryTitle,
        id: mangaId,
      }),
    [
      manga?.type,
      manga?.tags,
      manga?.title,
      initialManga?.type,
      initialManga?.title,
      queryType,
      queryTitle,
      sessionType,
      mangaId,
    ]
  );

  const theme = useMemo(() => getMangaTheme(resolvedKind), [resolvedKind]);
  const accentText = theme.isManhwa ? "text-white" : "text-black";
  /** Webtoon strips are far too tall for a two-page spread — dual is manga-only. */
  const dualAllowed = resolvedKind === "manga";
  const availableModes = useMemo(
    () => MODE_OPTIONS.filter((option) => option.key !== "double" || dualAllowed),
    [dualAllowed]
  );

  usePageContentReady(!isLoading);

  // Session cover/type hints (instant render before API resolves)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sc = sessionStorage.getItem(`cs_manga_cover_${mangaId}`);
    if (sc && !sc.includes("icon-512.png")) setSessionCover(sc);
    const st = sessionStorage.getItem(`cs_manga_type_${mangaId}`);
    if (st) setSessionType(st);
  }, [mangaId]);

  // Load persisted reader preferences once.
  useEffect(() => {
    if (typeof window === "undefined" || prefsInitializedRef.current) return;
    prefsInitializedRef.current = true;

    const mobile = window.matchMedia("(max-width: 767px)").matches;
    setIsMobile(mobile);

    try {
      const storedMode = localStorage.getItem("cinestream.manga_reader_mode");
      const storedDir = localStorage.getItem("cinestream.manga_reading_direction");
      const storedWidth = parseInt(
        localStorage.getItem("cinestream.manga_webtoon_width") || "",
        10
      );
      const storedBrightness = parseInt(
        localStorage.getItem("cinestream.manga_brightness") || "",
        10
      );

      if (storedBrightness >= 30 && storedBrightness <= 150) {
        setBrightness(storedBrightness);
      }
      if (storedWidth >= 60 && storedWidth <= 150) {
        setWebtoonWidth(storedWidth);
      }

      setDirection(
        storedDir === "rtl" || storedDir === "ltr"
          ? storedDir
          : resolvedKind === "manga"
          ? "rtl"
          : "ltr"
      );

      let mode: ReaderMode;
      if (storedMode === "webtoon" || storedMode === "single" || storedMode === "double") {
        mode = storedMode;
      } else {
        mode = mobile ? "webtoon" : resolvedKind === "manga" ? "single" : "webtoon";
      }
      if (mobile && mode === "double") mode = "single";

      setReaderMode(mode);
    } catch {
      setReaderMode(window.matchMedia("(max-width: 767px)").matches ? "webtoon" : "single");
    }

    setPrefsReady(true);

    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setReaderMode((prev) => (prev === "double" ? "single" : prev));
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBrightness = useCallback((value: number) => {
    const clamped = Math.max(30, Math.min(150, value));
    setBrightness(clamped);
    try {
      localStorage.setItem("cinestream.manga_brightness", String(clamped));
    } catch {}
  }, []);

  const updateWebtoonWidth = useCallback((value: number) => {
    const clamped = Math.max(60, Math.min(150, value));
    setWebtoonWidth(clamped);
    try {
      localStorage.setItem("cinestream.manga_webtoon_width", String(clamped));
    } catch {}
  }, []);

  const changeMode = useCallback(
    (mode: ReaderMode) => {
      if (mode === "double" && (isMobile || !dualAllowed)) return;
      setReaderMode(mode);
      setSettingsOpen(false);
      setShowControls(true);
      try {
        localStorage.setItem("cinestream.manga_reader_mode", mode);
      } catch {}
      if (mode === "double") {
        setCurrentPage((page) => (page <= 1 ? 1 : page % 2 === 0 ? page : page - 1));
      }
    },
    [dualAllowed, isMobile]
  );

  // Keep manhwa out of dual mode even if an old preference or URL asked for it.
  useEffect(() => {
    if (readerMode !== "double" || dualAllowed) return;
    setReaderMode("webtoon");
    try {
      localStorage.setItem("cinestream.manga_reader_mode", "webtoon");
    } catch {}
  }, [dualAllowed, readerMode]);

  const changeDirection = useCallback((next: ReadingDirection) => {
    setDirection(next);
    try {
      localStorage.setItem("cinestream.manga_reading_direction", next);
    } catch {}
  }, []);

  const exitFullscreenIfActive = useCallback(() => {
    if (
      typeof document !== "undefined" &&
      (document.fullscreenElement || (document as any).webkitFullscreenElement)
    ) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      exitFullscreenIfActive();
    }
  }, [exitFullscreenIfActive]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement)
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    window.addEventListener("popstate", exitFullscreenIfActive);
    window.addEventListener("beforeunload", exitFullscreenIfActive);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      window.removeEventListener("popstate", exitFullscreenIfActive);
      window.removeEventListener("beforeunload", exitFullscreenIfActive);
      exitFullscreenIfActive();
    };
  }, [exitFullscreenIfActive]);

  // Fetch manga details, chapter list and chapter pages.
  const loadChapter = useCallback(async () => {
    if (pagesData && pagesData.chapterId === chapterId && manga && chapters.length > 0) {
      setIsLoading(false);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    setIsLoading(true);
    setError(null);

    try {
      const titleParam = queryTitle
        ? `?title=${encodeURIComponent(queryTitle)}&ch=${encodeURIComponent(queryCh)}`
        : "";

      const fetches: Promise<any>[] = [];
      if (!manga) {
        fetches.push(
          fetchJson<{ success: boolean; item: MangaItem }>(
            `/api/manga/details/${mangaId}`
          ).catch(() => ({ success: false, item: null }))
        );
      } else {
        fetches.push(Promise.resolve({ success: true, item: manga }));
      }

      if (chapters.length === 0) {
        fetches.push(
          fetchJson<{ success: boolean; chapters: MangaChapter[] }>(
            `/api/manga/chapters/${mangaId}?order=asc&limit=500`
          )
        );
      } else {
        fetches.push(Promise.resolve({ success: true, chapters }));
      }

      if (!pagesData || pagesData.chapterId !== chapterId) {
        fetches.push(
          fetchJson<{ success: boolean; pageUrls: string[]; dataSaverUrls: string[] }>(
            `/api/manga/chapter/${chapterId}${titleParam}`
          )
        );
      } else {
        fetches.push(
          Promise.resolve({
            success: true,
            pageUrls: pagesData.pageUrls,
            dataSaverUrls: pagesData.dataSaverUrls,
          })
        );
      }

      const [detailsData, chaptersData, pagesRes] = await Promise.all(fetches);

      if (detailsData?.success && detailsData?.item) {
        setManga(detailsData.item);
        if (typeof window !== "undefined") {
          try {
            if (
              detailsData.item.coverImage &&
              !detailsData.item.coverImage.includes("icon-512.png")
            ) {
              sessionStorage.setItem(
                `cs_manga_cover_${mangaId}`,
                detailsData.item.coverImage
              );
            }
            if (detailsData.item.type) {
              sessionStorage.setItem(`cs_manga_type_${mangaId}`, detailsData.item.type);
            }
          } catch {}
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
        setError(
          "Could not retrieve chapter images. The chapter may be offline or still uploading."
        );
      }
    } catch (err: any) {
      console.error("Failed to load chapter:", err);
      setError(err.message || "Failed to load chapter pages");
    } finally {
      setIsLoading(false);
    }
  }, [mangaId, chapterId, queryTitle, queryCh, manga, chapters, pagesData]);

  // Load each chapter exactly once. The loader closes over async state
  // (manga / chapters / pagesData), so keeping it in a ref prevents the
  // effect from re-firing in a loop when a series has no chapters.
  const loadChapterRef = useRef(loadChapter);
  const loadedChapterKeyRef = useRef<string | null>(null);
  useEffect(() => {
    loadChapterRef.current = loadChapter;
  }, [loadChapter]);
  useEffect(() => {
    const key = `${mangaId}:${chapterId}`;
    if (loadedChapterKeyRef.current === key) return;
    loadedChapterKeyRef.current = key;
    loadChapterRef.current();
  }, [mangaId, chapterId]);

  // Reset scroll and page when switching chapters.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    if (readerContainerRef.current) {
      readerContainerRef.current.scrollTop = 0;
    }
    pageRefs.current.clear();
    setCurrentPage(1);
    lastScrollPageRef.current = 1;
  }, [chapterId]);

  // Restore the last read page in this chapter (paged modes + webtoon).
  const restoredChapterRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pagesData || pagesData.pageUrls.length === 0) return;
    if (isAuthed) return; // signed-in readers restore from the server below
    const restoreKey = `${pagesData.chapterId}:${pagesData.pageUrls.length}`;
    if (restoredChapterRef.current === restoreKey) return;
    restoredChapterRef.current = restoreKey;

    const stored = getLocalMangaProgress(mangaId);
    const clean = (value: string) => value.replace(/^(wc|asura)-/, "");
    const sameChapter = stored && clean(stored.chapterId) === clean(chapterId);
    const page = sameChapter ? stored?.pageNumber || 1 : 1;
    const safePage = Math.max(1, Math.min(pagesData.pageUrls.length, page));
    setCurrentPage(safePage);
    lastScrollPageRef.current = safePage;

    if (safePage > 1 && readerMode === "webtoon") {
      window.setTimeout(() => {
        pageRefs.current.get(safePage)?.scrollIntoView({ block: "start" });
      }, 450);
    }
  }, [pagesData, mangaId, chapterId, readerMode, isAuthed]);

  // Signed-in readers resume from their synced server progress.
  const serverRestoredRef = useRef<string | null>(null);
  const serverRestoreFinishedRef = useRef(false);
  useEffect(() => {
    if (!isAuthed || !pagesData || pagesData.pageUrls.length === 0) return;
    const restoreKey = `${pagesData.chapterId}:${pagesData.pageUrls.length}`;
    if (serverRestoredRef.current === restoreKey) return;
    serverRestoredRef.current = restoreKey;
    serverRestoreFinishedRef.current = false;

    let cancelled = false;
    fetchServerMangaProgress(mangaId)
      .then((stored) => {
        if (cancelled || !stored) return;
        const clean = (value: string) => value.replace(/^(wc|asura)-/, "");
        if (clean(stored.chapterId) !== clean(chapterId)) return;
        const safePage = Math.max(
          1,
          Math.min(pagesData.pageUrls.length, stored.pageNumber || 1)
        );
        setCurrentPage(safePage);
        lastScrollPageRef.current = safePage;
        if (safePage > 1 && readerMode === "webtoon") {
          window.setTimeout(() => {
            pageRefs.current.get(safePage)?.scrollIntoView({ block: "start" });
          }, 450);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) serverRestoreFinishedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthed, pagesData, mangaId, chapterId, readerMode]);

  const currentChapter = useMemo(() => {
    const cleanTarget = chapterId.replace(/^(wc|asura)-/, "");
    return (
      chapters.find(
        (c) => c.id === chapterId || c.id.replace(/^(wc|asura)-/, "") === cleanTarget
      ) || null
    );
  }, [chapters, chapterId]);

  const sortedChapters = useMemo(
    () =>
      [...chapters].sort(
        (a, b) => (parseFloat(a.chapterNumber) || 0) - (parseFloat(b.chapterNumber) || 0)
      ),
    [chapters]
  );

  const currentChapterIdx = useMemo(() => {
    const cleanTarget = chapterId.replace(/^(wc|asura)-/, "");
    return sortedChapters.findIndex(
      (c) => c.id === chapterId || c.id.replace(/^(wc|asura)-/, "") === cleanTarget
    );
  }, [sortedChapters, chapterId]);

  const prevChapter = useMemo(
    () => (currentChapterIdx > 0 ? sortedChapters[currentChapterIdx - 1] : null),
    [sortedChapters, currentChapterIdx]
  );

  const nextChapter = useMemo(
    () =>
      currentChapterIdx >= 0 && currentChapterIdx < sortedChapters.length - 1
        ? sortedChapters[currentChapterIdx + 1]
        : null,
    [sortedChapters, currentChapterIdx]
  );

  const totalPages = pagesData?.pageUrls?.length || 0;

  const resolvedTitle = manga?.title || initialManga?.title || queryTitle || "Manga";
  const resolvedChapterNumber =
    currentChapter?.chapterNumber || queryCh || "1";
  const resolvedChapterLabel = currentChapter?.title
    ? currentChapter.title
    : `Chapter ${resolvedChapterNumber}`;

  // Resolve the best available cover once, reused by progress + header.
  const resolvedCover = useMemo(() => {
    const cleanId = mangaId.replace(/^(wc|asura)-/, "");
    const raw =
      manga?.coverImage || initialManga?.coverImage || queryCover || sessionCover;
    const isFallback = !raw || raw.includes("icon-512.png") || raw.includes("icon.png");
    return isFallback && mangaId.startsWith("wc-")
      ? `https://temp.compsci88.com/cover/normal/${cleanId}.webp`
      : raw || "/icon-512.png";
  }, [manga?.coverImage, initialManga?.coverImage, queryCover, sessionCover, mangaId]);

  const buildProgressPayload = useCallback(
    (pageNumber: number) => ({
      mangaId,
      mangaTitle: resolvedTitle,
      mangaCover: resolvedCover,
      mangaType: resolvedKind,
      chapterId,
      chapterNumber: resolvedChapterNumber,
      chapterTitle: currentChapter?.title || null,
      pageNumber: Math.max(1, pageNumber),
      totalPages: totalPages > 0 ? totalPages : 1,
      nextChapterId: nextChapter ? nextChapter.id : null,
      nextChapterNumber: nextChapter ? nextChapter.chapterNumber : null,
    }),
    [
      mangaId,
      resolvedTitle,
      resolvedCover,
      resolvedKind,
      chapterId,
      resolvedChapterNumber,
      currentChapter?.title,
      totalPages,
      nextChapter,
    ]
  );

  const persistProgress = useCallback(
    (pageNumber: number, immediate = false) => {
      const payload = buildProgressPayload(pageNumber);
      if (isAuthed) {
        saveServerMangaProgress(payload, immediate);
      } else {
        saveLocalMangaProgress(payload);
      }

      if (typeof window !== "undefined") {
        try {
          if (!resolvedCover.includes("icon-512.png")) {
            sessionStorage.setItem(`cs_manga_cover_${mangaId}`, resolvedCover);
          }
          sessionStorage.setItem(`cs_manga_type_${mangaId}`, resolvedKind);
          sessionStorage.setItem(`cs_manga_title_${mangaId}`, resolvedTitle);
        } catch {}
      }
    },
    [buildProgressPayload, isAuthed, resolvedCover, resolvedKind, resolvedTitle, mangaId]
  );

  // Keep the latest page/closure available to unload and navigation handlers.
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const persistProgressRef = useRef(persistProgress);
  useEffect(() => {
    persistProgressRef.current = persistProgress;
  }, [persistProgress]);

  useEffect(() => {
    const flush = () => {
      if (totalPages <= 0) return;
      if (isAuthed && !serverRestoreFinishedRef.current) return;
      persistProgressRef.current(currentPageRef.current, true);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [totalPages, isAuthed]);

  // Mark the chapter read and persist the entry once per chapter. When this
  // chapter already has saved progress we keep that page instead of resetting
  // the reader to page 1 (which would erase the resume position).
  const initialisedChapterRef = useRef<string | null>(null);
  useEffect(() => {
    if (authStatus === "loading") return;

    const initKey = `${authStatus}:${mangaId}:${chapterId}`;
    if (initialisedChapterRef.current === initKey) return;
    initialisedChapterRef.current = initKey;

    markChapterAsRead(mangaId, chapterId, resolvedChapterNumber);

    // Local readers can persist immediately; signed-in readers wait for the
    // server restore so opening a chapter never rewinds synced progress.
    if (!isAuthed) {
      const stored = getLocalMangaProgress(mangaId);
      const clean = (value: string) => value.replace(/^(wc|asura)-/, "");
      const sameChapter = !!stored && clean(stored.chapterId) === clean(chapterId);
      persistProgress(sameChapter ? Math.max(1, stored?.pageNumber || 1) : 1, true);
    }
  }, [
    authStatus,
    isAuthed,
    chapterId,
    mangaId,
    resolvedChapterNumber,
    persistProgress,
  ]);

  // Debounced page-position save.
  const pageSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pagesData || totalPages === 0) return;
    if (authStatus === "loading") return;
    if (isAuthed && !serverRestoreFinishedRef.current) return;
    if (pageSaveTimerRef.current) clearTimeout(pageSaveTimerRef.current);
    pageSaveTimerRef.current = setTimeout(() => {
      persistProgress(currentPage);
    }, 1200);
    return () => {
      if (pageSaveTimerRef.current) clearTimeout(pageSaveTimerRef.current);
    };
  }, [currentPage, pagesData, totalPages, persistProgress, authStatus, isAuthed]);

  // Preload upcoming pages.
  useEffect(() => {
    if (!pagesData?.pageUrls) return;
    const urls = pagesData.pageUrls;
    const amount = readerMode === "double" ? 4 : 3;
    for (let offset = 1; offset <= amount; offset += 1) {
      const idx = currentPage - 1 + offset;
      if (idx < urls.length) {
        const img = new Image();
        img.src = urls[idx];
      }
    }
  }, [pagesData, currentPage, readerMode]);

  // Track the visible page while scrolling (webtoon).
  useEffect(() => {
    if (readerMode !== "webtoon" || totalPages <= 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNum = parseInt(entry.target.getAttribute("data-page") || "0", 10);
          if (pageNum > 0 && pageNum !== lastScrollPageRef.current) {
            lastScrollPageRef.current = pageNum;
            setCurrentPage(pageNum);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [totalPages, readerMode, pagesData]);

  // Keep the double-page spread aligned to an even page start.
  useEffect(() => {
    if (readerMode !== "double") return;
    setCurrentPage((page) => (page <= 1 ? 1 : page % 2 === 0 ? page : page - 1));
  }, [readerMode]);

  const scrollToPage = useCallback((page: number) => {
    const target = Math.max(1, Math.min(totalPages, page));
    const el = pageRefs.current.get(target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    lastScrollPageRef.current = target;
    setCurrentPage(target);
  }, [totalPages]);

  const goToNextChapter = useCallback(() => {
    if (!nextChapter) return;
    persistProgress(currentPageRef.current, true);
    router.push(
      `/manga/${mangaId}/read/${nextChapter.id}?title=${encodeURIComponent(
        resolvedTitle
      )}&ch=${encodeURIComponent(nextChapter.chapterNumber)}`
    );
  }, [nextChapter, router, mangaId, resolvedTitle, persistProgress]);

  const goToPrevChapter = useCallback(() => {
    if (!prevChapter) return;
    persistProgress(currentPageRef.current, true);
    router.push(
      `/manga/${mangaId}/read/${prevChapter.id}?title=${encodeURIComponent(
        resolvedTitle
      )}&ch=${encodeURIComponent(prevChapter.chapterNumber)}`
    );
  }, [prevChapter, router, mangaId, resolvedTitle, persistProgress]);

  const goNext = useCallback(() => {
    if (readerMode === "webtoon") {
      scrollToPage(currentPage + 1);
      return;
    }
    if (readerMode === "single") {
      if (currentPage < totalPages) setCurrentPage((page) => Math.min(totalPages, page + 1));
      else goToNextChapter();
      return;
    }
    if (currentPage === 1) {
      if (totalPages >= 2) setCurrentPage(2);
      else goToNextChapter();
      return;
    }
    if (currentPage + 2 <= totalPages) setCurrentPage(currentPage + 2);
    else goToNextChapter();
  }, [readerMode, currentPage, totalPages, scrollToPage, goToNextChapter]);

  const goPrev = useCallback(() => {
    if (readerMode === "webtoon") {
      scrollToPage(currentPage - 1);
      return;
    }
    if (readerMode === "single") {
      setCurrentPage((page) => Math.max(1, page - 1));
      return;
    }
    setCurrentPage((page) => (page <= 2 ? 1 : page - 2));
  }, [readerMode, currentPage, scrollToPage]);

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
    setSettingsOpen(false);
    setChapterPickerOpen(false);
  }, []);

  // Auto-hide the chrome after a few seconds of reading in every mode.
  useEffect(() => {
    if (!showControls) return;
    if (settingsOpen || chapterPickerOpen) return;
    const timer = setTimeout(
      () => setShowControls(false),
      readerMode === "webtoon" ? 6500 : 5200
    );
    return () => clearTimeout(timer);
  }, [showControls, readerMode, currentPage, settingsOpen, chapterPickerOpen]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (e.key === "Escape") {
        setSettingsOpen(false);
        setChapterPickerOpen(false);
        return;
      }

      if (readerMode === "webtoon") return;

      const forwardKey = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
      const backKey = direction === "rtl" ? "ArrowRight" : "ArrowLeft";

      if (e.key === forwardKey || e.key === " " || e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === backKey || e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readerMode, direction, goNext, goPrev, toggleFullscreen]);

  const progressPercent = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
  const atChapterEnd =
    readerMode === "double" ? currentPage + 1 >= totalPages : currentPage >= totalPages;

  const headerChapterHref = (chapter: MangaChapter) =>
    `/manga/${mangaId}/read/${chapter.id}?title=${encodeURIComponent(
      resolvedTitle
    )}&ch=${encodeURIComponent(chapter.chapterNumber)}&cover=${encodeURIComponent(
      resolvedCover
    )}&type=${encodeURIComponent(resolvedKind)}`;

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={mangaThemeStyle(resolvedKind) as React.CSSProperties}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10"
          style={{ background: theme.gradient }}
        >
          <Loader2 className={`h-7 w-7 animate-spin ${accentText}`} />
        </div>
        <div>
          <p className="text-sm font-black text-white">Preparing your chapter</p>
          <p className="text-xs font-semibold text-white/45 mt-1">
            Fetching high-resolution pages…
          </p>
        </div>
      </div>
    );
  }

  if (error || !pagesData || pagesData.pageUrls.length === 0) {
    return (
      <div
        className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center"
        style={mangaThemeStyle(resolvedKind) as React.CSSProperties}
      >
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">
          Chapter Temporarily Unavailable
        </h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">
          {error || "Could not retrieve chapter images."}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => loadChapter()}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm shadow-xl active:scale-95 cursor-pointer touch-manipulation ${accentText}`}
            style={{ background: theme.gradient }}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Loading Chapter</span>
          </button>
          <Link
            href={`/manga/${mangaId}`}
            onClick={exitFullscreenIfActive}
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
      style={mangaThemeStyle(resolvedKind) as React.CSSProperties}
      className="relative min-h-screen w-full bg-black text-white select-none overflow-x-hidden"
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: theme.isManhwa
            ? "radial-gradient(circle at 50% 0%, rgba(157,3,252,0.13) 0%, transparent 42%), radial-gradient(circle at 90% 90%, rgba(252,3,173,0.08) 0%, transparent 40%)"
            : "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 42%)",
        }}
      />

      {/* TOP BAR */}
      <header
        style={{
          paddingTop: "max(0.55rem, env(safe-area-inset-top, 0.55rem))",
          paddingLeft: "max(0.55rem, env(safe-area-inset-left, 0.55rem))",
          paddingRight: "max(0.55rem, env(safe-area-inset-right, 0.55rem))",
          paddingBottom: "0.55rem",
        }}
        className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-2 border-b border-white/10 bg-black/85 px-2.5 backdrop-blur-2xl transition-all duration-300 sm:px-5 ${
          showControls
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href={`/manga/${mangaId}`}
            onClick={exitFullscreenIfActive}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white active:scale-90 sm:h-9 sm:w-9"
            title="Back to details"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <span
            className={`hidden shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wider sm:inline-flex ${theme.chipClass}`}
          >
            {theme.label}
          </span>

          <div className="min-w-0">
            <h1 className="truncate text-xs font-black text-white sm:text-sm">
              {resolvedTitle}
            </h1>
            <p className="truncate text-[10px] font-bold text-white/45 sm:text-[11px]">
              {resolvedChapterLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setChapterPickerOpen((open) => !open);
              setSettingsOpen(false);
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white active:scale-95 sm:h-9"
            title="Chapters"
          >
            <List className="h-4 w-4" />
            <span className="hidden text-[11px] font-black sm:inline">
              Ch. {resolvedChapterNumber}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                chapterPickerOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              setSettingsOpen((open) => !open);
              setChapterPickerOpen(false);
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors active:scale-90 sm:h-9 sm:w-9 ${
              settingsOpen
                ? "border-white/30 bg-white/15 text-white"
                : "border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12] hover:text-white"
            }`}
            title="Reader settings"
            aria-label="Reader settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white active:scale-90 sm:flex"
            title="Toggle fullscreen (F)"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* CHAPTER PICKER */}
      {chapterPickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            onClick={() => setChapterPickerOpen(false)}
          />
          <div
            className="fixed left-3 right-3 z-50 flex max-h-[72vh] flex-col rounded-2xl border border-white/15 bg-[#0a0a0d]/98 p-3 shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:left-auto sm:right-6 sm:w-96"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 px-1 pb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-white/70">
                Chapters ({chapters.length})
              </span>
              <button
                type="button"
                onClick={() => setChapterPickerOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                aria-label="Close chapter list"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="custom-scrollbar flex flex-col gap-1.5 overflow-y-auto pr-1">
              {[...sortedChapters].reverse().map((ch) => {
                const clean = (value: string) => value.replace(/^(wc|asura)-/, "");
                const isCurrent = clean(ch.id) === clean(chapterId);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setChapterPickerOpen(false);
                      router.push(headerChapterHref(ch));
                    }}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all active:scale-[0.99] ${
                      isCurrent
                        ? `border-transparent ${accentText}`
                        : "border-white/5 bg-white/[0.04] text-white/80 hover:bg-white/[0.09] hover:text-white"
                    }`}
                    style={isCurrent ? { background: theme.gradient } : undefined}
                  >
                    <span className="truncate">
                      {ch.title || `Chapter ${ch.chapterNumber}`}
                    </span>
                    {isCurrent ? (
                      <CheckCircle2 className={`ml-2 h-4 w-4 shrink-0 ${accentText}`} />
                    ) : (
                      <span className="ml-2 shrink-0 font-mono text-[10px] text-white/35">
                        Ch. {ch.chapterNumber}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* SETTINGS PANEL */}
      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            className="fixed left-3 right-3 z-50 flex max-h-[76vh] flex-col gap-4 overflow-y-auto rounded-2xl border border-white/15 bg-[#0a0a0d]/98 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:left-auto sm:right-6 sm:w-[350px]"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-white/70">
                Reader Settings
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                aria-label="Close settings"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-white/40">
                Reading mode
              </p>
              <div
                className={`grid gap-1.5 ${
                  availableModes.length === 2 ? "grid-cols-2" : "grid-cols-3"
                }`}
              >
                {availableModes.map((option) => {
                  const Icon = option.icon;
                  const disabled = option.desktopOnly && isMobile;
                  const active = readerMode === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => changeMode(option.key)}
                      style={active ? { background: theme.gradient } : undefined}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[10px] font-black transition-all ${
                        active
                          ? `border-transparent ${accentText}`
                          : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.09] hover:text-white"
                      } ${disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
                      title={
                        disabled ? "Double page mode is available on tablets & desktop" : option.hint
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {isMobile && dualAllowed && (
                <p className="mt-1.5 text-[10px] font-semibold text-white/35">
                  Dual page mode unlocks on tablet &amp; desktop.
                </p>
              )}
              {!dualAllowed && (
                <p className="mt-1.5 text-[10px] font-semibold text-white/35">
                  Dual page is manga-only; manhwa uses the continuous scroll reader.
                </p>
              )}
            </div>

            {readerMode !== "webtoon" && (
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-white/40">
                  Reading direction
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["ltr", "rtl"] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => changeDirection(dir)}
                      style={direction === dir ? { background: theme.gradient } : undefined}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-black transition-all ${
                        direction === dir
                          ? `border-transparent ${accentText}`
                          : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.09] hover:text-white"
                      }`}
                    >
                      {dir === "ltr" ? "Left → Right" : "Right → Left"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-white/35">
                  Manga usually reads right → left. Manhwa reads left → right.
                </p>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/40">
                  Brightness
                </p>
                <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-black text-white/70">
                  {brightness}%
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <SunDim className="h-4 w-4 shrink-0 text-white/40" />
                <input
                  type="range"
                  min={30}
                  max={150}
                  step={5}
                  value={brightness}
                  onChange={(e) => updateBrightness(parseInt(e.target.value, 10))}
                  className="reader-range w-full"
                  style={{ accentColor: theme.primaryHex }}
                />
                <Sun className="h-4 w-4 shrink-0 text-white/60" />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[50, 75, 100, 125].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateBrightness(preset)}
                    className={`rounded-lg px-2 py-1 text-[10px] font-black transition-colors ${
                      brightness === preset
                        ? "bg-white/20 text-white"
                        : "bg-white/[0.05] text-white/50 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {readerMode === "webtoon" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/40">
                    Page width
                  </p>
                  <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-black text-white/70">
                    {webtoonWidth}%
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-black text-white/40">Narrow</span>
                  <input
                    type="range"
                    min={60}
                    max={150}
                    step={10}
                    value={webtoonWidth}
                    onChange={(e) => updateWebtoonWidth(parseInt(e.target.value, 10))}
                    className="reader-range w-full"
                    style={{ accentColor: theme.primaryHex }}
                  />
                  <span className="text-[10px] font-black text-white/40">Wide</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateWebtoonWidth(100)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 text-[10px] font-black text-white/60 hover:bg-white/[0.09] hover:text-white"
                >
                  Reset to fit width
                </button>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-[10px] font-bold leading-relaxed text-white/40">
                {readerMode === "webtoon"
                  ? "Tap the page to hide or show the controls. Use the page width slider to zoom the strip."
                  : isMobile
                  ? "Tap the sides to turn pages, swipe to navigate, double-tap or pinch to zoom. Tap the middle to hide the controls."
                  : "Arrow keys turn pages, wheel navigates, Ctrl + wheel zooms, F toggles fullscreen."}
              </p>
            </div>
          </div>
        </>
      )}

      {/* MAIN READING AREA */}
      {readerMode === "webtoon" ? (
        <main
          className="relative z-10 flex min-h-screen w-full flex-col items-center overflow-x-auto"
          style={{
            paddingTop: "max(3.9rem, calc(3.5rem + env(safe-area-inset-top, 0px)))",
            paddingBottom: "max(6.5rem, calc(5.5rem + env(safe-area-inset-bottom, 0px)))",
          }}
        >
          <div
            style={{
              width: `${webtoonWidth}%`,
              maxWidth: `${Math.round(980 * (webtoonWidth / 100))}px`,
            }}
            className="relative mx-auto flex shrink-0 flex-col items-center"
          >
            {pagesData.pageUrls.map((url, idx) => {
              const pageNum = idx + 1;
              const dataSaverUrl = pagesData.dataSaverUrls?.[idx] || "";
              return (
                <MangaPageItem
                  key={`${pagesData.chapterId}-${pageNum}`}
                  pageNum={pageNum}
                  totalPages={totalPages}
                  url={url}
                  dataSaverUrl={dataSaverUrl}
                  brightness={brightness}
                  onPageRef={(el) => {
                    if (el) pageRefs.current.set(pageNum, el);
                    else pageRefs.current.delete(pageNum);
                  }}
                  onTap={toggleControls}
                />
              );
            })}

            {/* END OF CHAPTER */}
            <div className="mx-auto my-8 w-[calc(100%-2rem)] max-w-xl space-y-4 rounded-3xl border border-white/10 bg-[#0a0a0d] p-5 text-center shadow-2xl sm:p-7">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15"
                style={{ background: theme.gradient }}
              >
                <CheckCircle2 className={`h-6 w-6 ${accentText}`} />
              </div>
              <h3 className="text-xl font-black text-white">
                Finished {resolvedChapterLabel}!
              </h3>
              <p className="text-xs font-semibold text-white/45">
                {totalPages} pages · {theme.label}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {prevChapter && (
                  <Link
                    href={headerChapterHref(prevChapter)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/[0.12] active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Ch. {prevChapter.chapterNumber}</span>
                  </Link>
                )}

                {nextChapter ? (
                  <Link
                    href={headerChapterHref(nextChapter)}
                    style={{ background: theme.gradient }}
                    className={`inline-flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-black shadow-xl transition-all hover:opacity-90 active:scale-95 ${accentText}`}
                  >
                    <span>Read Ch. {nextChapter.chapterNumber}</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <p className="w-full text-xs font-bold text-white/60">
                    You are all caught up with the latest chapter.
                  </p>
                )}
              </div>

              <Link
                href={`/manga/${mangaId}`}
                onClick={exitFullscreenIfActive}
                className="inline-flex items-center gap-1.5 pt-1 text-[11px] font-black text-white/40 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to series details
              </Link>
            </div>
          </div>
        </main>
      ) : (
        <main className="reader-stage relative z-10">
          <PagedReader
            pageUrls={pagesData.pageUrls}
            currentPage={currentPage}
            totalPages={totalPages}
            mode={readerMode}
            direction={direction}
            brightness={brightness}
            showControls={showControls}
            isMobile={isMobile}
            onPrev={goPrev}
            onNext={goNext}
            onToggleControls={toggleControls}
          />
        </main>
      )}

      {/* END-OF-CHAPTER ACTION (paged modes) */}
      {readerMode !== "webtoon" && totalPages > 0 && atChapterEnd && (
        <div
          className={`fixed bottom-24 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/15 bg-black/85 p-3 shadow-2xl backdrop-blur-xl transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/40">
                Chapter complete
              </p>
              <p className="truncate text-xs font-black text-white">
                {resolvedChapterLabel}
              </p>
            </div>
            {nextChapter ? (
              <button
                type="button"
                onClick={goToNextChapter}
                style={{ background: theme.gradient }}
                className={`flex shrink-0 items-center gap-1 rounded-xl px-4 py-2 text-xs font-black active:scale-95 ${accentText}`}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="shrink-0 text-[10px] font-bold text-white/40">
                All caught up
              </span>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM CONTROL BAR */}
      <div
        style={{
          paddingBottom: "max(0.55rem, env(safe-area-inset-bottom, 0.55rem))",
          paddingLeft: "max(0.55rem, env(safe-area-inset-left, 0.55rem))",
          paddingRight: "max(0.55rem, env(safe-area-inset-right, 0.55rem))",
        }}
        className={`fixed inset-x-0 bottom-0 z-40 transition-all duration-300 ${
          showControls
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-1.5 rounded-2xl border border-white/12 bg-black/80 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:gap-3 sm:p-2.5">
          <button
            type="button"
            onClick={goToPrevChapter}
            disabled={!prevChapter}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-25 sm:h-9 sm:w-9"
            title={prevChapter ? `Previous chapter ${prevChapter.chapterNumber}` : "No previous chapter"}
            aria-label="Previous chapter"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={goPrev}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white sm:h-9 sm:w-9"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 px-1">
            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider text-white/45 sm:text-[10px]">
              <span className="truncate">{theme.label}</span>
              <span className="shrink-0 font-mono text-white/70">
                {currentPage} / {totalPages}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.max(1, totalPages)}
              value={Math.min(currentPage, Math.max(1, totalPages))}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (readerMode === "webtoon") scrollToPage(page);
                else setCurrentPage(page);
              }}
              className="reader-range w-full"
              style={{
                accentColor: theme.primaryHex,
                background: `linear-gradient(to right, ${theme.primaryHex} 0%, ${
                  theme.accentHex
                } ${progressPercent}%, rgba(255,255,255,0.14) ${progressPercent}%)`,
              }}
              aria-label="Reading progress"
            />
          </div>

          <button
            type="button"
            onClick={goNext}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white sm:h-9 sm:w-9"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={goToNextChapter}
            disabled={!nextChapter}
            className="hidden h-9 shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 text-[10px] font-black text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-25 sm:flex"
            title={nextChapter ? `Next chapter ${nextChapter.chapterNumber}` : "No next chapter"}
          >
            <span>Next Ch.</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSettingsOpen(true);
              setChapterPickerOpen(false);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white sm:hidden"
            title="Reader settings"
            aria-label="Reader settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
