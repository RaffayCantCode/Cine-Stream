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
            {children}
          </ContentModeProvider>
        </WatchlistProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
