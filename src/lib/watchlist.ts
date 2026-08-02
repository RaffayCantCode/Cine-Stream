export type MediaType = "movie" | "tv" | "anime";

export interface WatchlistItem {
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  savedAt: number;
}

export const WATCHLIST_STORAGE_KEY = "cinestream.watchlist";

export function watchlistKey(mediaId: number, mediaType: string): string {
  return `${mediaType}:${mediaId}`;
}

export function readLocalWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i) =>
        i &&
        typeof i.mediaId === "number" &&
        (i.mediaType === "movie" || i.mediaType === "tv" || i.mediaType === "anime")
    );
  } catch {
    return [];
  }
}

export function writeLocalWatchlist(items: WatchlistItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota/private-mode errors */
  }
}

export function clearLocalWatchlist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}