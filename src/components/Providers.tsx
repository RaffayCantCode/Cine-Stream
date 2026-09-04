"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { ContentModeProvider } from "@/context/ContentModeContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WatchlistProvider } from "@/context/WatchlistContext";

import { usePathname } from "next/navigation";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const isWatchPage = pathname?.startsWith("/watch/") || pathname === "/watch";

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

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
      if (handleVisibilityChange) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, []);
  return (
    <SessionProvider refetchOnWindowFocus={false}>
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
