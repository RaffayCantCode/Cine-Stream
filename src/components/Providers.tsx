"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ReactNode, useEffect, useRef } from "react";
import { ContentModeProvider } from "@/context/ContentModeContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WatchlistProvider } from "@/context/WatchlistContext";

import { usePathname } from "next/navigation";

interface ProvidersProps {
  children: ReactNode;
}

const ACTIVITY_STORAGE_KEY = "cinestream_activity_ping";
const ACTIVITY_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Keeps `lastActiveAt` current without a DB write on every request. The server
 * uses it to clear manga reading history after 30 days of inactivity.
 */
function UserActivityHeartbeat() {
  const { status, data: session } = useSession();
  const sentRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      sentRef.current = false;
      return;
    }
    if (sentRef.current) return;

    const storageKey = session?.user?.id
      ? `${ACTIVITY_STORAGE_KEY}_${session.user.id}`
      : ACTIVITY_STORAGE_KEY;
    let lastPing = 0;
    try {
      lastPing = Number(localStorage.getItem(storageKey) || 0);
    } catch {}
    if (Date.now() - lastPing < ACTIVITY_INTERVAL_MS) return;

    sentRef.current = true;
    fetch("/api/user/activity", { method: "POST", keepalive: true })
      .then((res) => {
        if (!res.ok) {
          sentRef.current = false;
          return;
        }
        try {
          localStorage.setItem(storageKey, String(Date.now()));
        } catch {}
      })
      .catch(() => {
        sentRef.current = false;
      });
  }, [status, session?.user?.id]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const isWatchPage = pathname?.startsWith("/watch/") || pathname === "/watch";

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Development rebuilds keep the same /_next/static URLs, so the production
    // cache-first service worker would keep serving old chunks and hide code
    // changes (including the page's data-loading effects). Never run it locally.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches.keys()
          .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cinestream-")).map((k) => caches.delete(k))))
          .catch(() => {});
      }
      return;
    }

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      try {
        const hasReloaded = sessionStorage.getItem("cs_sw_reloaded");
        if (hasReloaded) return;
        if (document.visibilityState === "visible") {
          refreshing = true;
          sessionStorage.setItem("cs_sw_reloaded", "1");
          window.location.reload();
        }
      } catch {}
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let handleVisibilityChange: (() => void) | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Immediate check for SW updates on load
        registration.update().catch(() => {});

        // Listen for new worker installs
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Tell new SW to skip waiting so update applies immediately
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });

        // Check for updates whenever user returns to the app or tab
        handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
      })
      .catch((err) => console.warn("[PWA] Service Worker registration failed:", err));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (handleVisibilityChange) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, []);
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <UserActivityHeartbeat />
      <ThemeProvider>
        <WatchlistProvider>
          <ContentModeProvider>
            {children}
          </ContentModeProvider>
        </WatchlistProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
