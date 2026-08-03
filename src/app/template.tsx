"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

/**
 * Theme-aware page transition wrapper.
 *
 * Every route change (client navigation, browser back/forward, hard loads)
 * remounts this template, so the enter animation below plays consistently
 * and smoothly fades + slides the incoming page in over the active theme's
 * background. No hardcoded colors — everything resolves through the theme.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [pathname, searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        opacity: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] },
        y: { type: "spring", stiffness: 320, damping: 32, mass: 0.9 },
        scale: { type: "spring", stiffness: 320, damping: 32, mass: 0.9 },
      }}
      onAnimationComplete={() => {
        /* The incoming page is now fully painted — lets the NavigationLoader
           end its screen exactly when the page is ready. */
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("sv:route-enter-complete"));
        }
      }}
      className="flex-1 flex flex-col min-h-[100dvh]"
    >
      {children}
    </motion.div>
  );
}
