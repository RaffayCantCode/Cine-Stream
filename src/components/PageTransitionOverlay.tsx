"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { getTheme } from "@/lib/themes";

/**
 * Theme-aware page transition veil.
 *
 * On every REAL pathname change (client navigation AND browser back/forward),
 * a soft full-screen wash built from the ACTIVE theme's tokens fades in and
 * out, so page switches always feel connected to the selected theme.
 * It never blocks interaction and never plays for hydration/theme-sync
 * re-renders — only for actual navigations.
 */
export function PageTransitionOverlay() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const prevPathnameRef = useRef(pathname);
  const [animKey, setAnimKey] = useState<string | null>(null);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setAnimKey(pathname);
    }
  }, [pathname]);

  if (animKey === null) return null;

  const accent = getTheme(theme).accent;

  return (
    <motion.div
      key={animKey}
      aria-hidden="true"
      className="fixed inset-0 z-[45] pointer-events-none select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.45, 0.4, 0] }}
      transition={{ duration: 0.5, times: [0, 0.12, 0.4, 1], ease: "easeOut" }}
      onAnimationComplete={() => setAnimKey(null)}
      style={{
        background: `radial-gradient(120% 90% at 50% 32%, ${accent}30 0%, ${accent}14 42%, transparent 70%), hsl(var(--background))`,
      }}
    />
  );
}
