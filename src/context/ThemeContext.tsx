"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import {
  DEFAULT_THEME,
  isThemeId,
  THEMES,
  THEME_STORAGE_KEY,
  ThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  synced: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readLocalTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function purgeAllThemeClasses() {
  const el = document.documentElement;
  THEMES.forEach((t) => el.classList.remove(`theme-${t.id}`));
}

function applyThemeClass(theme: ThemeId) {
  purgeAllThemeClasses();
  document.documentElement.classList.add(`theme-${theme}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize lazily so we read localStorage only on the client (never SSR).
  const [theme, setThemeState] = useState<ThemeId>(
    () => (typeof window === "undefined" ? DEFAULT_THEME : readLocalTheme())
  );
  const [synced, setSynced] = useState(true);
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const userId = session?.user?.id ?? null;

  const lastApplied = useRef<ThemeId | null>(null);

  // Apply the class to <html> whenever the committed theme changes.
  useEffect(() => {
    if (lastApplied.current === theme) return;
    lastApplied.current = theme;
    applyThemeClass(theme);
  }, [theme]);

  // Keep the theme synced with the logged-in user's preference.
  // Priority: logged-in saved preference > localStorage > default (initial state above).
  const syncWithServer = useCallback(
    async (current: ThemeId, uid: string) => {
      try {
        const res = await fetch("/api/preferences/theme", { cache: "no-store" });
        if (!res.ok) return;
        const data: { theme?: string } = await res.json();
        const server = isThemeId(data.theme) ? (data.theme as ThemeId) : null;

        if (server) {
          if (server !== current) setThemeState(server);
          try {
            window.localStorage.setItem(THEME_STORAGE_KEY, server);
          } catch { /* ignore */ }
        } else if (current !== DEFAULT_THEME) {
          // No saved preference yet — persist the current (local) choice.
          await fetch("/api/preferences/theme", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme: current }),
          });
        }
      } catch {
        /* offline / errors fall back to local only */
      } finally {
        setSynced(true);
      }
    },
    []
  );

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    setSynced(false);
    syncWithServer(themeRef.current, userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userId]);

  const themeRef = useRef(theme);
  themeRef.current = theme;

  const setTheme = useCallback(
    (next: ThemeId) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch { /* ignore */ }

      if (isAuthedRef.current) {
        // Save the logged-in user's preference to the server.
        fetch("/api/preferences/theme", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: next }),
        }).catch(() => {});
      }
    },
    []
  );

  const isAuthedRef = useRef(false);
  isAuthedRef.current = isAuthed && !!userId;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, synced }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}