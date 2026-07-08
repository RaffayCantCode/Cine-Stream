"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";

export type ContentMode = "all" | "movies" | "tv" | "anime" | "people";

interface ContentModeContextProps {
  mode: ContentMode;
  setMode: (mode: ContentMode) => void;
}

const ContentModeContext = createContext<ContentModeContextProps | undefined>(undefined);

export function ContentModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ContentMode>("all");
  const pathname = usePathname();

  // Sync with pathname: If user navigates manually via URL
  useEffect(() => {
    if (!pathname) return;
    
    if (pathname === "/" || pathname.startsWith("/browse/trending")) {
      setModeState("all");
    } else if (pathname.startsWith("/browse/movies") || pathname.startsWith("/movie/")) {
      setModeState("movies");
    } else if (pathname.startsWith("/browse/tv") || pathname.startsWith("/tv/")) {
      setModeState("tv");
    } else if (pathname.startsWith("/anime")) {
      setModeState("anime");
    }
  }, [pathname]);

  const setMode = (newMode: ContentMode) => {
    setModeState(newMode);
  };

  // Apply theme classes to document element
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("mode-movies", "mode-tv", "mode-anime", "mode-all");
    html.classList.add(`mode-${mode}`);
  }, [mode]);

  return (
    <ContentModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ContentModeContext.Provider>
  );
}

export function useContentMode() {
  const context = useContext(ContentModeContext);
  if (context === undefined) {
    throw new Error("useContentMode must be used within a ContentModeProvider");
  }
  return context;
}
