import type { ReactNode } from "react";

export default function MangaLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={
        {
          "--primary": "42 75% 65%",
          "--primary-foreground": "210 30% 6%",
          "--ring": "42 75% 65%",
          "--accent": "42 75% 65%",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}


