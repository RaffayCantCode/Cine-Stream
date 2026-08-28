import type { ReactNode } from "react";

export default function MangaLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={
        {
          "--primary": "48 100% 50%",
          "--primary-foreground": "0 0% 0%",
          "--ring": "48 100% 50%",
          "--accent": "48 100% 50%",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}


