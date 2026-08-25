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

const STORAGE_KEY = "cinestream.manga_history_v3";
const READ_CHAPTERS_STORAGE_KEY = "cinestream.manga_read_chapters_v2";

// ----------------------------------------------------
// 1. GUEST / LOCAL STORAGE OPERATIONS (Logged-out only)
// ----------------------------------------------------

/**
 * Gets all saved manga reading progress records from localStorage (for logged-out users).
 */
export function getLocalMangaHistory(): MangaReadingProgress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: MangaReadingProgress[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

/**
 * Gets reading progress for a single manga ID from localStorage (for logged-out users).
 */
export function getLocalMangaProgress(mangaId: string): MangaReadingProgress | null {
  const history = getLocalMangaHistory();
  return history.find((item) => item.mangaId === mangaId) || null;
}

/**
 * Saves reading progress to localStorage (for logged-out users).
 */
export function saveLocalMangaProgress(progress: Omit<MangaReadingProgress, "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getLocalMangaHistory();
    const existingIndex = history.findIndex((item) => item.mangaId === progress.mangaId);

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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory.slice(0, 30)));
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
    const history = getLocalMangaHistory();
    const filtered = history.filter((item) => item.mangaId !== mangaId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("cinestream:manga-history-updated"));
  } catch (err) {
    console.warn("[MangaHistory] Failed to remove local progress:", err);
  }
}

// ----------------------------------------------------
// 2. SERVER DATABASE OPERATIONS (Logged-in only)
// ----------------------------------------------------

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
 */
export async function fetchServerMangaHistory(): Promise<MangaReadingProgress[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch("/api/manga/history", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.items)) return [];
    return data.items.map(mapDbRowToProgress).sort((a: MangaReadingProgress, b: MangaReadingProgress) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn("[MangaHistory] Failed to fetch server history:", err);
    return [];
  }
}

/**
 * Fetches user's reading progress for a single manga from server database (for logged-in users).
 */
export async function fetchServerMangaProgress(mangaId: string): Promise<MangaReadingProgress | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`/api/manga/history?mangaId=${encodeURIComponent(mangaId)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.item) return null;
    return mapDbRowToProgress(data.item);
  } catch (err) {
    console.warn("[MangaHistory] Failed to fetch server progress:", err);
    return null;
  }
}

/**
 * Saves or updates user's reading progress in the server database (for logged-in users).
 */
export async function saveServerMangaProgress(progress: Omit<MangaReadingProgress, "updatedAt">): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/manga/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progress),
    });
    if (res.ok) {
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
 * Clears reading progress for a manga in the server database (for logged-in users).
 */
export async function removeServerMangaProgress(mangaId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
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
    const raw = localStorage.getItem(READ_CHAPTERS_STORAGE_KEY);
    if (!raw) return new Set();
    const map = JSON.parse(raw);
    const list = map[mangaId];
    return Array.isArray(list) ? new Set(list) : new Set();
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
    const raw = localStorage.getItem(READ_CHAPTERS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const set = new Set<string>(Array.isArray(map[mangaId]) ? map[mangaId] : []);
    set.add(chapterId);
    if (chapterNumber) set.add(`num-${chapterNumber}`);
    map[mangaId] = Array.from(set);
    localStorage.setItem(READ_CHAPTERS_STORAGE_KEY, JSON.stringify(map));
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
    const raw = localStorage.getItem(READ_CHAPTERS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const set = new Set<string>(Array.isArray(map[mangaId]) ? map[mangaId] : []);
    
    let isNowRead = false;
    if (set.has(chapterId) || (chapterNumber && set.has(`num-${chapterNumber}`))) {
      set.delete(chapterId);
      if (chapterNumber) set.delete(`num-${chapterNumber}`);
      isNowRead = false;
    } else {
      set.add(chapterId);
      if (chapterNumber) set.add(`num-${chapterNumber}`);
      isNowRead = true;
    }

    map[mangaId] = Array.from(set);
    localStorage.setItem(READ_CHAPTERS_STORAGE_KEY, JSON.stringify(map));
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
