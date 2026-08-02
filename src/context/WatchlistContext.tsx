"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import {
  clearLocalWatchlist,
  readLocalWatchlist,
  watchlistKey,
  writeLocalWatchlist,
  WatchlistItem,
} from "@/lib/watchlist";

interface SaveableInput {
  mediaId: number;
  mediaType: WatchlistItem["mediaType"];
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
}

interface WatchlistContextValue {
  items: WatchlistItem[];
  loading: boolean;
  isSaved: (mediaId: number, mediaType: string) => boolean;
  toggle: (item: SaveableInput) => void;
  remove: (mediaId: number, mediaType: string) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | undefined>(undefined);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { status, data: session } = useSession();
  const isAuthed = status === "authenticated" && !!session?.user?.id;

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const itemsRef = useRef<WatchlistItem[]>([]);
  const setItemsSafe = (next: WatchlistItem[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  // Keep the lookup map in sync with the item list.
  const keySetRef = useRef<Set<string>>(new Set());
  const rebuildKeys = (list: WatchlistItem[]) => {
    const s = new Set<string>();
    list.forEach((i) => s.add(watchlistKey(i.mediaId, i.mediaType)));
    keySetRef.current = s;
  };

  // Load when auth state resolves.
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user?.id) {
      let cancelled = false;
      setLoading(true);
      (async () => {
        const local = readLocalWatchlist();
        try {
          let list: WatchlistItem[] = [];
          if (local.length > 0) {
            // Merge guest items into the user's DB watchlist (dedupes server-side).
            const res = await fetch("/api/watchlist/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: local }),
            });
            if (!res.ok) throw new Error("Sync failed");
            list = (await res.json()).items ?? [];
            clearLocalWatchlist();
          } else {
            // Try fetch with one retry on failure.
            let res = await fetch("/api/watchlist", { cache: "no-store" });
            if (!res.ok) {
              await new Promise((r) => setTimeout(r, 800));
              res = await fetch("/api/watchlist", { cache: "no-store" });
            }
            if (!res.ok) throw new Error("Fetch failed");
            list = (await res.json()).items ?? [];
          }
          if (!cancelled) {
            rebuildKeys(list);
            setItemsSafe(list);
            setLoading(false);
          }
        } catch {
          // Offline / persistent server error — keep whatever the guest had locally.
          // For authenticated users with empty local, this stays [] but loading finishes
          // so the user sees the empty state rather than infinite skeleton.
          if (!cancelled) {
            rebuildKeys(local);
            setItemsSafe(local);
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Guest / signed out — serve from localStorage.
    const local = readLocalWatchlist();
    rebuildKeys(local);
    setItemsSafe(local);
    setLoading(false);
  }, [status, session?.user?.id]);

  const toggle = (input: SaveableInput) => {
    const key = watchlistKey(input.mediaId, input.mediaType);
    const exists = keySetRef.current.has(key);
    const prev = itemsRef.current;

    let next: WatchlistItem[];
    if (exists) {
      next = prev.filter((i) => watchlistKey(i.mediaId, i.mediaType) !== key);
    } else {
      next = [
        {
          mediaId: input.mediaId,
          mediaType: input.mediaType,
          title: input.title,
          posterPath: input.posterPath ?? null,
          backdropPath: input.backdropPath ?? null,
          savedAt: Date.now(),
        },
        ...prev,
      ];
    }

    // Optimistic update.
    rebuildKeys(next);
    setItemsSafe(next);
    if (!isAuthed) writeLocalWatchlist(next);

    if (isAuthed) {
      const url = exists
        ? `/api/watchlist/${input.mediaId}?mediaType=${input.mediaType}`
        : "/api/watchlist";
      const opts: RequestInit = exists
        ? { method: "DELETE" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId: input.mediaId,
              mediaType: input.mediaType,
              title: input.title,
              posterPath: input.posterPath ?? null,
              backdropPath: input.backdropPath ?? null,
            }),
          };

      fetch(url, opts).then((res) => {
        if (!res.ok) throw new Error("Watchlist API failed");
      }).catch(() => {
        // Roll back the optimistic update on failure.
        rebuildKeys(prev);
        setItemsSafe(prev);
      });
    }
  };

  const remove = (mediaId: number, mediaType: string) => {
    const key = watchlistKey(mediaId, mediaType);
    const prev = itemsRef.current;
    const next = prev.filter((i) => watchlistKey(i.mediaId, i.mediaType) !== key);

    // Optimistic update.
    rebuildKeys(next);
    setItemsSafe(next);
    if (!isAuthed) writeLocalWatchlist(next);

    if (isAuthed) {
      fetch(`/api/watchlist/${mediaId}?mediaType=${mediaType}`, { method: "DELETE" })
        .then((res) => {
          if (!res.ok) throw new Error("Watchlist delete failed");
        })
        .catch(() => {
          // Roll back on failure.
          rebuildKeys(prev);
          setItemsSafe(prev);
        });
    }
  };

  const isSaved = (mediaId: number, mediaType: string) =>
    keySetRef.current.has(watchlistKey(mediaId, mediaType));

  const value = useMemo(
    () => ({ items, loading, isSaved, toggle, remove }),
    // Reflect the live item list; isSaved reads a ref so it is always current.
    [items, loading]
  );

  return (
    <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return ctx;
}