/**
 * Manga Reading History & Progress Tracker
 * Persists reading position, chapter, and page in browser localStorage and database.
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
 * Gets reading progress for a single manga ID.
 */
export function getMangaProgress(mangaId: string): MangaReadingProgress | null {
  const history = getMangaHistory();
  return history.find((item) => item.mangaId === mangaId) || null;
}

/**
 * Saves or updates reading progress for a manga in localStorage & database.
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

    // Keep up to 30 recent titles
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory.slice(0, 30)));
    // Dispatch reactive event
    window.dispatchEvent(new Event("cinestream:manga-history-updated"));

    // Async sync to database
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
 * Clears reading progress for a specific manga from localStorage & database.
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
 */
export async function syncMangaHistoryFromServer(): Promise<MangaReadingProgress[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch("/api/manga/history");
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
