/**
 * Manga Reading History & Progress Tracker
 * 
 * Rules:
 * - Logged-in users: read, save, and delete from Database ONLY (/api/manga/history).
 * - Logged-out users: read, save, and delete from localStorage ONLY.
 * - No hybrid fallback or merging.
 */

export interface MangaReadingProgress {
  mangaId: string;
  mangaTitle: string;
  mangaCover: string;
  mangaType: "manga" | "manhwa" | "manhua";
  chapterId: string;
  chapterNumber: string;
  chapterTitle?: string | null;
  pageNumber: number;
  totalPages: number;
  nextChapterId?: string | null;
  nextChapterNumber?: string | null;
  updatedAt: number;
}

const STORAGE_KEYS = [
  "cinestream.manga_history_v4",
  "cinestream.manga_history_v3",
  "cinestream.manga_history_v2",
  "cinestream.manga_history",
];
const PRIMARY_STORAGE_KEY = "cinestream.manga_history_v4";

const READ_CHAPTERS_STORAGE_KEYS = [
  "cinestream.manga_read_chapters_v2",
  "cinestream.manga_read_chapters_v1",
  "cinestream.manga_read_chapters",
];
const PRIMARY_READ_CHAPTERS_KEY = "cinestream.manga_read_chapters_v2";

// ----------------------------------------------------
// 1. GUEST / LOCAL STORAGE OPERATIONS (Logged-out only)
// ----------------------------------------------------

/**
 * Gets all saved manga reading progress records from localStorage (for logged-out users).
 */
export function getLocalMangaHistory(): MangaReadingProgress[] {
  if (typeof window === "undefined") return [];
  try {
    for (const key of STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: MangaReadingProgress[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
        }
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Gets reading progress for a single manga ID from localStorage (for logged-out users).
 */
export function getLocalMangaProgress(mangaId: string): MangaReadingProgress | null {
  const history = getLocalMangaHistory();
  return (
    history.find(
      (item) => item.mangaId === mangaId || item.mangaId.replace(/^wc-/, "") === mangaId.replace(/^wc-/, "")
    ) || null
  );
}

/**
 * Saves reading progress to localStorage (for logged-out users).
 */
export function saveLocalMangaProgress(progress: Omit<MangaReadingProgress, "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getLocalMangaHistory();
    const existingIndex = history.findIndex(
      (item) =>
        item.mangaId === progress.mangaId ||
        item.mangaId.replace(/^wc-/, "") === progress.mangaId.replace(/^wc-/, "")
    );

    const updatedItem: MangaReadingProgress = {
      ...progress,
      updatedAt: Date.now(),
    };

    let newHistory: MangaReadingProgress[];
    if (existingIndex >= 0) {
      newHistory = [
        updatedItem,
        ...history.slice(0, existingIndex),
        ...history.slice(existingIndex + 1),
      ];
    } else {
      newHistory = [updatedItem, ...history];
    }

    const payloadStr = JSON.stringify(newHistory.slice(0, 30));
    for (const key of STORAGE_KEYS) {
      try {
        localStorage.setItem(key, payloadStr);
      } catch {}
    }

    window.dispatchEvent(new Event("cinestream:manga-history-updated"));
  } catch (err) {
    console.warn("[MangaHistory] Failed to save local reading progress:", err);
  }
}

/**
 * Clears reading progress for a specific manga from localStorage (for logged-out users).
 */
export function removeLocalMangaProgress(mangaId: string): void {
  if (typeof window === "undefined") return;
  try {
    const cleanId = mangaId.replace(/^(wc|asura)-/, "");
    const history = getLocalMangaHistory();
    const filtered = history.filter(
      (item) =>
        item.mangaId !== mangaId &&
        item.mangaId.replace(/^(wc|asura)-/, "") !== cleanId
    );
    const payloadStr = JSON.stringify(filtered);
    for (const key of STORAGE_KEYS) {
      try {
        localStorage.setItem(key, payloadStr);
      } catch {}
    }
    window.dispatchEvent(new Event("cinestream:manga-history-updated"));
  } catch (err) {
    console.warn("[MangaHistory] Failed to remove local progress:", err);
  }
}

// ----------------------------------------------------
// 2. SERVER DATABASE OPERATIONS (Logged-in only)
// ----------------------------------------------------

let serverHistoryCache: { data: MangaReadingProgress[]; timestamp: number } | null = null;
let serverHistoryInFlight: Promise<MangaReadingProgress[]> | null = null;
const SERVER_HISTORY_TTL = 30_000; // 30 seconds

const serverProgressCache = new Map<string, { data: MangaReadingProgress | null; timestamp: number }>();
let pendingServerProgressSave: { progress: Omit<MangaReadingProgress, "updatedAt">; timer: any } | null = null;

export function invalidateServerMangaHistoryCache(): void {
  serverHistoryCache = null;
  serverProgressCache.clear();
}

function mapDbRowToProgress(row: any): MangaReadingProgress {
  return {
    mangaId: row.mangaId,
    mangaTitle: row.mangaTitle,
    mangaCover: row.mangaCover,
    mangaType: row.mangaType === "manhwa" || row.mangaType === "manhua" ? row.mangaType : "manga",
    chapterId: row.chapterId,
    chapterNumber: String(row.chapterNumber),
    chapterTitle: row.chapterTitle ?? null,
    pageNumber: row.pageNumber || 1,
    totalPages: row.totalPages || 1,
    nextChapterId: row.nextChapterId ?? null,
    nextChapterNumber: row.nextChapterNumber ? String(row.nextChapterNumber) : null,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : new Date(row.updatedAt).getTime(),
  };
}

/**
 * Fetches user's reading history from server database (for logged-in users).
 * Includes 30s in-memory caching and in-flight request deduplication.
 */
export async function fetchServerMangaHistory(force = false): Promise<MangaReadingProgress[]> {
  if (typeof window === "undefined") return [];

  const now = Date.now();
  if (!force && serverHistoryCache && now - serverHistoryCache.timestamp < SERVER_HISTORY_TTL) {
    return serverHistoryCache.data;
  }

  if (serverHistoryInFlight) {
    return serverHistoryInFlight;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch("/api/manga/history", { cache: "no-store" });
      if (!res.ok) return serverHistoryCache?.data || [];
      const data = await res.json();
      if (!Array.isArray(data.items)) return serverHistoryCache?.data || [];
      const items = data.items.map(mapDbRowToProgress).sort((a: MangaReadingProgress, b: MangaReadingProgress) => b.updatedAt - a.updatedAt);
      serverHistoryCache = { data: items, timestamp: Date.now() };
      return items;
    } catch (err) {
      console.warn("[MangaHistory] Failed to fetch server history:", err);
      return serverHistoryCache?.data || [];
    } finally {
      serverHistoryInFlight = null;
    }
  })();

  serverHistoryInFlight = fetchPromise;
  return fetchPromise;
}

/**
 * Fetches user's reading progress for a single manga from server database (for logged-in users).
 * Uses in-memory caching with a 30s TTL.
 */
export async function fetchServerMangaProgress(mangaId: string, force = false): Promise<MangaReadingProgress | null> {
  if (typeof window === "undefined" || !mangaId) return null;

  const now = Date.now();
  const cached = serverProgressCache.get(mangaId);
  if (!force && cached && now - cached.timestamp < SERVER_HISTORY_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(`/api/manga/history?mangaId=${encodeURIComponent(mangaId)}`, { cache: "no-store" });
    if (!res.ok) return cached?.data || null;
    const data = await res.json();
    if (!data.item) {
      serverProgressCache.set(mangaId, { data: null, timestamp: now });
      return null;
    }
    const mapped = mapDbRowToProgress(data.item);
    serverProgressCache.set(mangaId, { data: mapped, timestamp: now });
    return mapped;
  } catch (err) {
    console.warn("[MangaHistory] Failed to fetch server progress:", err);
    return cached?.data || null;
  }
}

async function executeServerSave(progress: Omit<MangaReadingProgress, "updatedAt">): Promise<boolean> {
  try {
    const res = await fetch("/api/manga/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progress),
    });
    if (res.ok) {
      // Update local memory cache with latest save
      const fullItem: MangaReadingProgress = { ...progress, updatedAt: Date.now() };
      serverProgressCache.set(progress.mangaId, { data: fullItem, timestamp: Date.now() });

      if (serverHistoryCache) {
        const filtered = serverHistoryCache.data.filter((i) => i.mangaId !== progress.mangaId);
        serverHistoryCache = { data: [fullItem, ...filtered], timestamp: Date.now() };
      }

      window.dispatchEvent(new Event("cinestream:manga-history-updated"));
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[MangaHistory] Failed to save server progress:", err);
    return false;
  }
}

/**
 * Flushes any pending debounced progress save immediately (e.g. before unmount or chapter change).
 */
export async function flushPendingServerMangaProgress(): Promise<void> {
  if (pendingServerProgressSave) {
    clearTimeout(pendingServerProgressSave.timer);
    const p = pendingServerProgressSave.progress;
    pendingServerProgressSave = null;
    await executeServerSave(p);
  }
}

/**
 * Saves or updates user's reading progress in the server database (for logged-in users).
 * By default, debounces by 8 seconds during active reading to eliminate redundant scroll POSTs.
 * Set immediate = true on chapter transitions or finish events to save instantly.
 */
export async function saveServerMangaProgress(
  progress: Omit<MangaReadingProgress, "updatedAt">,
  immediate = false
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Update in-memory progress cache immediately so synchronous reads reflect current position
  serverProgressCache.set(progress.mangaId, {
    data: { ...progress, updatedAt: Date.now() },
    timestamp: Date.now(),
  });

  if (immediate) {
    if (pendingServerProgressSave) {
      clearTimeout(pendingServerProgressSave.timer);
      pendingServerProgressSave = null;
    }
    return executeServerSave(progress);
  }

  // Debounce saving: replace existing pending save timer
  if (pendingServerProgressSave) {
    clearTimeout(pendingServerProgressSave.timer);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      pendingServerProgressSave = null;
      const ok = await executeServerSave(progress);
      resolve(ok);
    }, 8000); // 8s debounce window for continuous scrolling

    pendingServerProgressSave = { progress, timer };
  });
}

/**
 * Clears reading progress for a manga in the server database (for logged-in users).
 */
export async function removeServerMangaProgress(mangaId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (pendingServerProgressSave && pendingServerProgressSave.progress.mangaId === mangaId) {
      clearTimeout(pendingServerProgressSave.timer);
      pendingServerProgressSave = null;
    }

    serverProgressCache.delete(mangaId);
    if (serverHistoryCache) {
      const filtered = serverHistoryCache.data.filter((i) => i.mangaId !== mangaId && i.mangaId.replace(/^(wc|asura)-/, "") !== mangaId.replace(/^(wc|asura)-/, ""));
      serverHistoryCache = { data: filtered, timestamp: Date.now() };
    }

    const res = await fetch(`/api/manga/history?mangaId=${encodeURIComponent(mangaId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      window.dispatchEvent(new Event("cinestream:manga-history-updated"));
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[MangaHistory] Failed to remove server progress:", err);
    return false;
  }
}

// ----------------------------------------------------
// 3. READ CHAPTERS TRACKER (Local helper)
// ----------------------------------------------------

/**
 * Gets all explicitly marked read chapter IDs for a manga from localStorage.
 */
export function getReadChapters(mangaId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    for (const key of READ_CHAPTERS_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const map = JSON.parse(raw);
        const list = map[mangaId] || map[mangaId.replace(/^wc-/, "")];
        if (Array.isArray(list) && list.length > 0) {
          return new Set(list);
        }
      }
    }
    return new Set();
  } catch {
    return new Set();
  }
}

/**
 * Marks a chapter as read in localStorage.
 */
export function markChapterAsRead(mangaId: string, chapterId: string, chapterNumber?: string): void {
  if (typeof window === "undefined") return;
  try {
    let existingMap: Record<string, string[]> = {};
    for (const key of READ_CHAPTERS_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          existingMap = { ...existingMap, ...JSON.parse(raw) };
        } catch {}
      }
    }

    const set = new Set<string>(Array.isArray(existingMap[mangaId]) ? existingMap[mangaId] : []);
    set.add(chapterId);
    set.add(chapterId.replace(/^wc-/, ""));
    if (chapterNumber) set.add(`num-${chapterNumber}`);
    existingMap[mangaId] = Array.from(set);

    const payload = JSON.stringify(existingMap);
    for (const key of READ_CHAPTERS_STORAGE_KEYS) {
      try {
        localStorage.setItem(key, payload);
      } catch {}
    }
    window.dispatchEvent(new Event("cinestream:manga-read-chapters-updated"));
  } catch (err) {
    console.warn("[MangaHistory] Failed to mark chapter as read:", err);
  }
}

/**
 * Toggles a chapter's read status.
 */
export function toggleChapterReadStatus(mangaId: string, chapterId: string, chapterNumber?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    let existingMap: Record<string, string[]> = {};
    for (const key of READ_CHAPTERS_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          existingMap = { ...existingMap, ...JSON.parse(raw) };
        } catch {}
      }
    }

    const set = new Set<string>(Array.isArray(existingMap[mangaId]) ? existingMap[mangaId] : []);
    
    let isNowRead = false;
    if (set.has(chapterId) || (chapterNumber && set.has(`num-${chapterNumber}`))) {
      set.delete(chapterId);
      set.delete(chapterId.replace(/^wc-/, ""));
      if (chapterNumber) set.delete(`num-${chapterNumber}`);
      isNowRead = false;
    } else {
      set.add(chapterId);
      set.add(chapterId.replace(/^wc-/, ""));
      if (chapterNumber) set.add(`num-${chapterNumber}`);
      isNowRead = true;
    }

    existingMap[mangaId] = Array.from(set);
    const payload = JSON.stringify(existingMap);
    for (const key of READ_CHAPTERS_STORAGE_KEYS) {
      try {
        localStorage.setItem(key, payload);
      } catch {}
    }
    window.dispatchEvent(new Event("cinestream:manga-read-chapters-updated"));
    return isNowRead;
  } catch {
    return false;
  }
}

/**
 * Checks if a chapter is read (either explicitly marked or past the highest read chapter).
 */
export function isChapterRead(
  mangaId: string,
  chapterId: string,
  chapterNumber?: string,
  highestReadNumber?: string
): boolean {
  const readSet = getReadChapters(mangaId);
  if (readSet.has(chapterId) || (chapterNumber && readSet.has(`num-${chapterNumber}`))) {
    return true;
  }
  if (chapterNumber && highestReadNumber) {
    const chNum = parseFloat(chapterNumber);
    const lastNum = parseFloat(highestReadNumber);
    if (!isNaN(chNum) && !isNaN(lastNum) && chNum <= lastNum) {
      return true;
    }
  }
  return false;
}
