"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface AnnouncementData {
  message: string | null;
  updatedAt: string | null;
}

// Global in-memory cache to share across components without extra fetch
let globalAnnouncementCache: AnnouncementData | null = null;
let lastAnnouncementFetchAt = 0;
const listeners = new Set<(data: AnnouncementData) => void>();

function notifyListeners(data: AnnouncementData) {
  globalAnnouncementCache = data;
  lastAnnouncementFetchAt = Date.now();
  listeners.forEach((listener) => listener(data));
}

export function useAnnouncement() {
  const [data, setData] = useState<AnnouncementData>(() => globalAnnouncementCache || {
    message: null,
    updatedAt: null,
  });
  const [isLoading, setIsLoading] = useState(() => !globalAnnouncementCache);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const fetchAnnouncement = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const newData = {
            message: json.data.message || null,
            updatedAt: json.data.updatedAt || null,
          };
          notifyListeners(newData);
        }
      }
    } catch (err) {
      console.warn("[useAnnouncement] Failed to fetch:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Throttled fetch — only fires if cache is older than 5 minutes
  const ANNOUNCEMENT_REFETCH_TTL = 5 * 60_000;
  const fetchAnnouncementThrottled = useCallback(async () => {
    if (Date.now() - lastAnnouncementFetchAt < ANNOUNCEMENT_REFETCH_TTL) return;
    await fetchAnnouncement();
  }, [fetchAnnouncement]);

  useEffect(() => {
    // Register listener for shared state updates
    const handleUpdate = (newData: AnnouncementData) => {
      setData(newData);
      setIsLoading(false);
    };
    listeners.add(handleUpdate);

    // Initial fetch if cache is empty
    if (!globalAnnouncementCache) {
      fetchAnnouncement();
    } else {
      setData(globalAnnouncementCache);
      setIsLoading(false);
    }

    // Set up browser BroadcastChannel for instant cross-tab sync
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const bc = new BroadcastChannel("site-announcements-channel");
        broadcastChannelRef.current = bc;
        bc.onmessage = (event) => {
          if (event.data && typeof event.data === "object") {
            const payload = event.data;
            notifyListeners({
              message: payload.message || null,
              updatedAt: payload.updatedAt || null,
            });
          }
        };
      } catch {}
    }

    // Subscribe to Supabase Realtime channel
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel("site-announcements", {
        config: { broadcast: { self: true } },
      });

      channel
        .on("broadcast", { event: "announcement_update" }, (event: any) => {
          const payload = event.payload;
          if (payload && typeof payload === "object") {
            notifyListeners({
              message: payload.message || null,
              updatedAt: payload.updatedAt || null,
            });
          }
        })
        .subscribe();
    } catch (realtimeErr) {
      console.warn("[useAnnouncement] Realtime subscription error:", realtimeErr);
    }

    // Re-validate on window focus / visibility change — throttled to 5 minutes
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAnnouncementThrottled();
      }
    };
    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", fetchAnnouncementThrottled);

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", fetchAnnouncementThrottled);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchAnnouncement, fetchAnnouncementThrottled]);

  const saveAnnouncement = useCallback(async (newMessage: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Failed to update announcement" };
      }

      const updated = {
        message: json.data?.message || null,
        updatedAt: json.data?.updatedAt || new Date().toISOString(),
      };
      notifyListeners(updated);

      // Broadcast across tabs
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(updated);
        } catch {}
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }, []);

  const clearAnnouncement = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Failed to clear announcement" };
      }

      const cleared = {
        message: null,
        updatedAt: json.data?.updatedAt || new Date().toISOString(),
      };
      notifyListeners(cleared);

      // Broadcast across tabs
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(cleared);
        } catch {}
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }, []);

  return {
    message: data.message,
    updatedAt: data.updatedAt,
    isLoading,
    saveAnnouncement,
    clearAnnouncement,
    refresh: fetchAnnouncement,
  };
}
