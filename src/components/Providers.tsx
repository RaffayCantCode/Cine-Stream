"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { ContentModeProvider } from "@/context/ContentModeContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WatchlistProvider } from "@/context/WatchlistContext";
import { ThemeButton } from "@/components/ThemeButton";
import { WatchlistLink } from "@/components/WatchlistLink";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[PWA] Service Worker registration failed:", err));
    }
  }, []);
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider>
        <WatchlistProvider>
          <ContentModeProvider>
            {/* Global desktop theme switcher + watchlist library (top-right corner) */}
            <div className="hidden md:flex fixed top-4 right-16 z-40 items-center gap-2">
              <WatchlistLink />
              <ThemeButton className="h-10 w-10 shadow-lg shadow-black/30" />
            </div>
            {children}
          </ContentModeProvider>
        </WatchlistProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
