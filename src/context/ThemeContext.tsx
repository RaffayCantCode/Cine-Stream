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
  CUSTOM_THEMES_STORAGE_KEY,
  ThemeId,
  ThemeDefinition,
  hexToHsl,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  synced: boolean;
  customThemes: ThemeDefinition[];
  refreshCustomThemes: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readLocalTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {}
  return DEFAULT_THEME;
}

function readLocalCustomThemes(): ThemeDefinition[] {
  try {
    const stored = window.localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function purgeAllThemeClasses() {
  const el = document.documentElement;
  THEMES.forEach((t) => el.classList.remove(`theme-${t.id}`));
}

function clearCustomInlineStyles() {
  const root = document.documentElement;
  root.style.removeProperty("--background");
  root.style.removeProperty("--card");
  root.style.removeProperty("--popover");
  root.style.removeProperty("--primary");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--accent");
  root.style.removeProperty("--foreground");
  root.style.removeProperty("--card-foreground");
  root.style.removeProperty("--border");
}

function applyCustomThemeStyles(custom: ThemeDefinition) {
  const root = document.documentElement;
  if (custom.background) root.style.setProperty("--background", hexToHsl(custom.background));
  if (custom.card) {
    root.style.setProperty("--card", hexToHsl(custom.card));
    root.style.setProperty("--popover", hexToHsl(custom.card));
    root.style.setProperty("--border", hexToHsl(custom.card));
  }
  if (custom.primary) {
    root.style.setProperty("--primary", hexToHsl(custom.primary));
    root.style.setProperty("--ring", hexToHsl(custom.primary));
  }
  if (custom.accent) root.style.setProperty("--accent", hexToHsl(custom.accent));
  if (custom.foreground) {
    root.style.setProperty("--foreground", hexToHsl(custom.foreground));
    root.style.setProperty("--card-foreground", hexToHsl(custom.foreground));
  }
}

const THEME_META_COLORS: Record<string, string> = {
  global: "#090F15",
  glass: "#090B12",
  oled: "#000000",
  cinema: "#20060B",
  wisteria: "#120C24",
  solaris: "#14160A",
};

function syncThemeMetaColor(color: string) {
  try {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color || THEME_META_COLORS.global;
  } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(
    () => (typeof window === "undefined" ? DEFAULT_THEME : readLocalTheme())
  );
  const [customThemes, setCustomThemes] = useState<ThemeDefinition[]>(
    () => (typeof window === "undefined" ? [] : readLocalCustomThemes())
  );
  const [synced, setSynced] = useState(true);
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const userId = session?.user?.id ?? null;

  const refreshCustomThemes = useCallback(async () => {
    try {
      const res = await fetch("/api/themes");
      if (res.ok) {
        const json = await res.json();
        if (json.themes && Array.isArray(json.themes)) {
          const list: ThemeDefinition[] = json.themes.map((t: any) => ({
            id: t.id,
            label: t.label,
            tagline: t.tagline || "Custom",
            description: t.description || "",
            preview: t.preview || `linear-gradient(135deg, ${t.background} 0%, ${t.card} 45%, ${t.primary} 100%)`,
            accent: t.primary,
            isCustom: true,
            background: t.background,
            card: t.card,
            primary: t.primary,
            foreground: t.foreground,
          }));
          setCustomThemes(list);
          try {
            window.localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(list));
          } catch {}
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshCustomThemes();
  }, [refreshCustomThemes]);

  // Apply theme to <html>
  useEffect(() => {
    purgeAllThemeClasses();
    if (theme.startsWith("custom_")) {
      const custom = customThemes.find((t) => t.id === theme) || readLocalCustomThemes().find((t) => t.id === theme);
      if (custom) {
        applyCustomThemeStyles(custom);
        syncThemeMetaColor(custom.background || "#090F15");
      }
    } else {
      clearCustomInlineStyles();
      document.documentElement.classList.add(`theme-${theme}`);
      syncThemeMetaColor(THEME_META_COLORS[theme] || THEME_META_COLORS.global);
    }
  }, [theme, customThemes]);

  // Sync preference with server
  const syncWithServer = useCallback(
    async (current: ThemeId, uid: string) => {
      try {
        const res = await fetch("/api/preferences/theme", { cache: "no-store" });
        if (!res.ok) return;
        const data: { theme?: string } = await res.json();
        const server = isThemeId(data.theme) ? data.theme : null;

        if (server) {
          if (server !== current) setThemeState(server);
          try {
            window.localStorage.setItem(THEME_STORAGE_KEY, server);
          } catch {}
        } else if (current !== DEFAULT_THEME) {
          await fetch("/api/preferences/theme", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ theme: current }),
          });
        }
      } catch {} finally {
        setSynced(true);
      }
    },
    []
  );

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    setSynced(false);
    syncWithServer(theme, userId);
  }, [status, userId, syncWithServer, theme]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}

      if (isAuthed && userId) {
        fetch("/api/preferences/theme", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: next }),
        }).catch(() => {});
      }
    },
    [isAuthed, userId]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, synced, customThemes, refreshCustomThemes }}>
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