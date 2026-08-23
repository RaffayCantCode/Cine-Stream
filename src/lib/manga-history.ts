/**
 * Manga Reading History & Progress Tracker
 * Persists reading position, chapter, and page in browser localStorage and database.
 * Syncs seamlessly across all user devices when logged into your account.
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

const STORAGE_KEY = "cinestream.manga_history_v2";
const READ_CHAPTERS_STORAGE_KEY = "cinestream.manga_read_chapters_v1";

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

/**
 * Gets all saved manga reading progress records from localStorage.
 */
export function getMangaHistory(): MangaReadingProgress[] {
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
 * Gets reading progress for a single manga ID from localStorage.
 */
export function getMangaProgress(mangaId: string): MangaReadingProgress | null {
  const history = getMangaHistory();
  return history.find((item) => item.mangaId === mangaId) || null;
}

/**
 * Saves or updates reading progress for a manga in localStorage & user account database.
 */
export function saveMangaProgress(progress: Omit<MangaReadingProgress, "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getMangaHistory();
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

    // Keep up to 30 recent titles in local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory.slice(0, 30)));
    // Dispatch reactive event
    window.dispatchEvent(new Event("cinestream:manga-history-updated"));

    // Async sync to user account database
    fetch("/api/manga/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedItem),
    }).catch(() => {});
  } catch (err) {
    console.warn("[MangaHistory] Failed to save reading progress:", err);
  }
}

/**
 * Clears reading progress for a specific manga from localStorage & user account database.
 */
export function removeMangaProgress(mangaId: string): void {
  if (typeof window === "undefined") return;
  try {
    const history = getMangaHistory();
    const filtered = history.filter((item) => item.mangaId !== mangaId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("cinestream:manga-history-updated"));

    // Async delete from database
    fetch(`/api/manga/history?mangaId=${encodeURIComponent(mangaId)}`, {
      method: "DELETE",
    }).catch(() => {});
  } catch (err) {
    console.warn("[MangaHistory] Failed to remove progress:", err);
  }
}

/**
 * Synchronizes history from server database on load and merges with localStorage.
 * Ensures cross-device continuity across phones, laptops, and tablets.
 */
export async function syncMangaHistoryFromServer(): Promise<MangaReadingProgress[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch("/api/manga/history", { cache: "no-store" });
    if (!res.ok) return getMangaHistory();
    const data = await res.json();
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return getMangaHistory();
    }

    const local = getMangaHistory();
    const localMap = new Map(local.map((item) => [item.mangaId, item]));

    for (const serverItem of data.items) {
      const serverUpdated = new Date(serverItem.updatedAt).getTime();
      const existing = localMap.get(serverItem.mangaId);
      if (!existing || serverUpdated > existing.updatedAt) {
        localMap.set(serverItem.mangaId, {
          mangaId: serverItem.mangaId,
          mangaTitle: serverItem.mangaTitle,
          mangaCover: serverItem.mangaCover,
          mangaType: serverItem.mangaType || "manga",
          chapterId: serverItem.chapterId,
          chapterNumber: serverItem.chapterNumber,
          chapterTitle: serverItem.chapterTitle,
          pageNumber: serverItem.pageNumber || 1,
          totalPages: serverItem.totalPages || 1,
          nextChapterId: serverItem.nextChapterId,
          nextChapterNumber: serverItem.nextChapterNumber,
          updatedAt: serverUpdated,
        });
      }
    }

    const merged = Array.from(localMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, 30)));
    window.dispatchEvent(new Event("cinestream:manga-history-updated"));
    return merged;
  } catch {
    return getMangaHistory();
  }
}
