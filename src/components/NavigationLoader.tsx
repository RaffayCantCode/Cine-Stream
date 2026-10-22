"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LoadingScreen } from "@/components/LoadingScreen";

/** Minimum time the loader stays fully opaque once a route has committed. */
const DEFAULT_MIN_HOLD_MS = 350;
/**
 * Browse list routes render a complete shell (header, filters, skeleton grid)
 * on their very first paint and fill the grid in place. Holding the branded
 * overlay over them made a cold/slow TMDB request block the whole screen for
 * seconds, so they get a much shorter hold.
 */
const BROWSE_MIN_HOLD_MS = 160;
/** Detail routes already render their own loading shell — keep it brief. */
const MEDIA_MIN_HOLD_MS = 200;
/** Watch routes render the player immediately. */
const WATCH_MIN_HOLD_MS = 0;
/** Duration of the overlay fade-out. */
const FADE_MS = 240;

const normalizePath = (p: string) => p.replace(/\/+$/, "") || "/";

/** List routes that paint their own full shell and load data in place. */
const isBrowseRoute = (p: string) => p.startsWith("/browse/");

const minHoldFor = (pathname: string): number => {
  if (pathname.startsWith("/watch/")) return WATCH_MIN_HOLD_MS;
  if (isBrowseRoute(pathname)) return BROWSE_MIN_HOLD_MS;
  if (/^\/(movie|tv|anime|manga|person)\//.test(pathname)) return MEDIA_MIN_HOLD_MS;
  return DEFAULT_MIN_HOLD_MS;
};

/**
 * Client-side navigation loader.
 *
 * While a route is fetching, the current page stays fully visible and
 * interactive (no instant block on click). When the new route commits, the
 * themed `LoadingScreen` covers the swap in the same paint, holds for a short
 * route-specific beat, then fades out revealing the incoming page.
 *
 * It deliberately does NOT wait for the incoming page's async data: every page
 * already renders its own skeleton/loading shell, and gating navigation on
 * data fetches was what made Movies/TV feel like they took seconds to open.
 *
 * It is pointer-events-none, so it never swallows clicks — a second click
 * always lands on a real link. Back/forward and param-only updates (e.g.
 * live search) never trigger it.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  /**
   * Keeps the overlay mounted for the exit fade. This is handled manually
   * instead of with AnimatePresence: the logo's infinite animations prevent
   * AnimatePresence from ever completing the exit, which left a stuck,
   * invisible overlay in the DOM that also stopped later navigations from
   * showing the loader again.
   */
  const [mounted, setMounted] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  /* Derived state read during render: if the committed route matches a
     user-initiated navigation, mount the loader in the SAME commit as the
     page swap (render-phase update), so the swap is never left uncovered. */
  const pendingTarget = pendingNavRef.current;
  const shouldShow =
    visible ||
    (pendingTarget !== null && pendingTarget === normalizePath(pathname));
  if (shouldShow !== visible) {
    setVisible(shouldShow);
  }

  /* Link clicks: remember the target of every internal <a> leading to a
     different pathname, so the loader can reveal when it commits. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const link = (e.target as Element | null)?.closest?.(
        "a[href]"
      ) as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(link.getAttribute("href") ?? "", window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      const targetPath = normalizePath(url.pathname);
      const currentPath = normalizePath(window.location.pathname);

      // Do NOT trigger loader on episode/media transitions within the media player
      if (currentPath.startsWith("/watch/") && targetPath.startsWith("/watch/")) {
        return;
      }

      pendingNavRef.current = targetPath;
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  /* Navigation API: cover programmatic router.push/replace and history traversal,
     so clicking an episode, going to a watch page, and returning back triggers
     the loader at commit. */
  useEffect(() => {
    if (typeof window === "undefined" || !("navigation" in window)) return;

    const onNavigate = (e: Event) => {
      const nav = e as unknown as {
        hashChange?: boolean;
        navigationType?: string;
        destination?: { url?: string };
      };
      if (nav.hashChange) return;
      try {
        const url = new URL(nav.destination?.url ?? "");
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
        const targetPath = normalizePath(url.pathname);
        const currentPath = normalizePath(window.location.pathname);

        // Do NOT trigger loader on episode/media transitions within the media player
        if (currentPath.startsWith("/watch/") && targetPath.startsWith("/watch/")) {
          return;
        }

        pendingNavRef.current = targetPath;
      } catch {
        return;
      }
    };

    const navigation = (window as unknown as { navigation?: EventTarget })
      .navigation;
    navigation?.addEventListener("navigate", onNavigate);
    return () => navigation?.removeEventListener("navigate", onNavigate);
  }, []);

  /* Popstate (browser back/forward button): catch transitions back to media pages. */
  useEffect(() => {
    const onPopState = () => {
      pendingNavRef.current = normalizePath(window.location.pathname);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* The route has committed: consume the pending mark and keep the overlay up
     for the route's short hold, then reveal the incoming page (which has
     already painted its own shell/skeleton). */
  useEffect(() => {
    pendingNavRef.current = null;
    if (!visible) return;

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const hold = minHoldFor(pathname);
    if (hold <= 0) {
      setVisible(false);
      return;
    }

    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setVisible(false);
    }, hold);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [pathname, visible]);

  /* Hold the overlay for the duration of its exit fade, then unmount it. */
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), FADE_MS + 20);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible && !mounted) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[999999] pointer-events-none"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: FADE_MS / 1000, ease: "easeInOut" }}
    >
      <LoadingScreen />
    </motion.div>
  );
}
