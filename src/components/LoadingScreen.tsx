"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { getTheme } from "@/lib/themes";

/**
 * Theme-aware branded loading screen.
 *
 * Shared by the route-level `app/loading.tsx` (slow route fetches) and the
 * client-side `NavigationLoader` (every link/router navigation), so every
 * page switch shows the same themed logo animation and never flashes the
 * default palette.
 */
export function LoadingScreen() {
  const { theme } = useTheme();
  const accent = getTheme(theme).accent;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground p-6 select-none">
      {/* Theme-tinted ambient glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${accent}14 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Animated logo */}
        <div className="relative w-24 h-24">
          {/* Pulsing theme ring */}
          <motion.div
            className="absolute inset-0 rounded-[26px]"
            style={{ boxShadow: `0 0 0 1px ${accent}33, 0 0 44px ${accent}3d` }}
            animate={{
              boxShadow: [
                `0 0 0 1px ${accent}33, 0 0 44px ${accent}3d`,
                `0 0 0 4px ${accent}22, 0 0 72px ${accent}59`,
                `0 0 0 1px ${accent}33, 0 0 44px ${accent}3d`,
              ],
            }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          />

          {/* Logo mark */}
          <motion.img
            src="/logo-icon.svg?v=22"
            alt="CineStream"
            className="relative w-full h-full drop-shadow-lg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: [0.8, 1.04, 1] }}
            transition={{
              opacity: { duration: 0.35, ease: "easeOut" },
              scale: { duration: 0.9, times: [0, 0.6, 1], ease: "easeOut" },
            }}
          />

          {/* Soft breathe on the whole mark */}
          <motion.div
            className="absolute inset-0"
            animate={{ scale: [1, 1.045, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          />
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="font-black text-xl tracking-wider">
            <span className="text-foreground">CINE</span>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              STREAM
            </span>
          </h2>
          <p className="text-xs text-muted-foreground font-medium tracking-wide animate-pulse">
            Loading page...
          </p>
        </div>
      </div>
    </div>
  );
}
