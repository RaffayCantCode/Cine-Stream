"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

interface AmbientBackdropGlowProps {
  backdropUrl?: string | null;
  opacity?: number;
  overlayClassName?: string;
}

export function AmbientBackdropGlow({
  backdropUrl,
  opacity = 0.78,
  overlayClassName = "bg-[#07080d]/25",
}: AmbientBackdropGlowProps) {
  let activeTheme = "global";
  try {
    const themeContext = useTheme();
    if (themeContext?.theme) activeTheme = themeContext.theme;
  } catch {}

  const [ambientBackdrop, setAmbientBackdrop] = useState<{
    current: string | null;
    previous: string | null;
  }>({
    current: backdropUrl || null,
    previous: null,
  });

  useEffect(() => {
    if (backdropUrl && backdropUrl !== ambientBackdrop.current) {
      setAmbientBackdrop((prev) => ({
        current: backdropUrl,
        previous: prev.current,
      }));
      const t = setTimeout(() => {
        setAmbientBackdrop((prev) => ({ ...prev, previous: null }));
      }, 1100);
      return () => clearTimeout(t);
    }
  }, [backdropUrl, ambientBackdrop.current]);

  // Dynamic ambient backdrop is ONLY active for the "global" theme!
  if (activeTheme !== "global") {
    return null;
  }

  if (!ambientBackdrop.current && !ambientBackdrop.previous) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      style={{
        transform: "translate3d(0, 0, 0)",
        willChange: "transform",
        contain: "strict",
        backfaceVisibility: "hidden",
      }}
    >
      {ambientBackdrop.previous && (
        <img
          src={ambientBackdrop.previous}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-[90px] opacity-0 scale-140 saturate-[2.2] brightness-[1.02] transition-opacity duration-1000 ease-in-out pointer-events-none"
          style={{ transform: "translate3d(0, 0, 0)", backfaceVisibility: "hidden" }}
          aria-hidden
        />
      )}
      {ambientBackdrop.current && (
        <img
          key={ambientBackdrop.current}
          src={ambientBackdrop.current}
          alt=""
          style={{ opacity, transform: "translate3d(0, 0, 0)", backfaceVisibility: "hidden" }}
          className="absolute inset-0 w-full h-full object-cover blur-[90px] scale-140 saturate-[2.2] brightness-[1.02] transition-opacity duration-1000 ease-in-out pointer-events-none animate-in fade-in duration-1000"
          aria-hidden
        />
      )}
      {/* Subtle overlay allowing light and vibrant banner colors to authentically shine through */}
      <div className={`absolute inset-0 ${overlayClassName} transition-colors duration-1000`} />
    </div>
  );
}
