import type { ReactNode } from "react";

/**
 * The manga section is intentionally neutral at the shell level: individual
 * cards, sections and pages inject the correct identity (monochrome for manga,
 * violet → magenta for manhwa) via `mangaThemeStyle`.
 */
export default function MangaLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={
        {
          "--primary": "0 0% 100%",
          "--primary-foreground": "0 0% 4%",
          "--ring": "0 0% 100%",
          "--accent": "0 0% 72%",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
