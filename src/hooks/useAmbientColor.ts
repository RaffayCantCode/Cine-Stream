"use client";

import { useState, useEffect } from "react";
import { extractDominantColor, buildAmbientPalette, type AmbientPalette } from "@/lib/colorExtractor";
import { useTheme } from "@/context/ThemeContext";

const cache = new Map<string, AmbientPalette>();

const EMPTY_PALETTE: AmbientPalette = {
  r: 99,
  g: 102,
  b: 241,
  hex: "#6366f1",
  cssVars: {},
};

export function useAmbientColor(imageUrl?: string | null): AmbientPalette {
  const [palette, setPalette] = useState<AmbientPalette>(() => {
    if (!imageUrl) return buildAmbientPalette(99, 102, 241);
    if (cache.has(imageUrl)) return cache.get(imageUrl)!;
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`amb_${imageUrl}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          const p = buildAmbientPalette(parsed.r, parsed.g, parsed.b);
          cache.set(imageUrl, p);
          return p;
        }
      } catch {}
    }
    return buildAmbientPalette(99, 102, 241);
  });

  useEffect(() => {
    if (!imageUrl) return;

    if (cache.has(imageUrl)) {
      setPalette(cache.get(imageUrl)!);
      return;
    }

    let isMounted = true;

    extractDominantColor(imageUrl).then((p) => {
      if (!isMounted) return;
      cache.set(imageUrl, p);
      setPalette(p);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`amb_${imageUrl}`, JSON.stringify({ r: p.r, g: p.g, b: p.b }));
        } catch {}
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return palette;
}
