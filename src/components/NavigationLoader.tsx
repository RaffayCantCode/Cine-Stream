"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  PAGE_LOADING_EVENT,
  PAGE_READY_EVENT,
  declarePageLoading,
  isPageContentLoading,
} from "@/lib/pageLoad";

/** Route-enter completion event dispatched by the app template. */
const ROUTE_ENTER_COMPLETE = "sv:route-enter-complete";
/** Minimum time the loader stays on screen so it reads as a real page load. */
const MIN_HOLD_MS = 500;
/** Fallback: hide this long after the route commits if the enter event never fires. */
const ENTER_FALLBACK_MS = 1600;
/** Fallback when a page announced async content but never reported ready. */
const CONTENT_FALLBACK_MS = 8000;
/** Hard cap so a stuck state can never leave the loader on screen. */
const SAFETY_MS = 12000;

interface NavTimers {
  minHold?: number;
  enterFallback?: number;
  contentFallback?: number;
  safety?: number;
}

const normalizePath = (p: string) => p.replace(/\/+$/, "") || "/";

/**
 * Client-side navigation loader.
 *
 * The loader only appears the moment the new page actually shows up: while a
 * route is fetching, the current page stays fully visible and interactive
 * (no instant block on click). When the new route commits, the themed
 * `LoadingScreen` covers the swap in the same paint, holds until the incoming
 * page is fully painted, then fades out revealing it.
 *
 * Pages that load async content can opt in via `usePageContentReady`: while
 * they are loading, the loader keeps playing past the enter animation and
 * only ends once their content is ready (no more skeletons underneath).
 *
 * It is pointer-events-none, so it never swallows clicks — a second click
 * always lands on a real link. Back/forward and param-only updates (e.g.
 * live search) never trigger it.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const awaitingContentRef = useRef(false);
  const timersRef = useRef<NavTimers>({});

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

  const clearTimers = useCallback(() => {
    const timers = timersRef.current;
    Object.values(timers).forEach((t) => window.clearTimeout(t));
    timersRef.current = {};
  }, []);

  const hide = useCallback(() => {
    clearTimers();
    awaitingContentRef.current = false;
    shownAtRef.current = null;
    setVisible(false);
  }, [clearTimers]);

  /* End the loader, but never before the minimum hold time has elapsed. */
  const requestHide = useCallback(() => {
    if (shownAtRef.current === null) return;
    const wait = Math.max(
      0,
      MIN_HOLD_MS - (Date.now() - shownAtRef.current)
    );
    if (wait === 0) {
      hide();
    } else {
      timersRef.current.minHold = window.setTimeout(hide, wait);
    }
  }, [hide]);

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
      pendingNavRef.current = targetPath;

      // When navigating to media pages like /anime/ or /watch/, trigger the loader immediately for instant feedback
      if (
        targetPath.startsWith("/anime/") ||
        targetPath.startsWith("/watch/") ||
        targetPath.startsWith("/movie/") ||
        targetPath.startsWith("/tv/") ||
        targetPath.startsWith("/manga/")
      ) {
        declarePageLoading();
        awaitingContentRef.current = true;
        if (shownAtRef.current === null) {
          shownAtRef.current = Date.now();
        }
        setVisible(true);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  /* Navigation API: cover programmatic router.push/replace and history traversal,
     so clicking an episode, going to watch page, and returning back triggers proper loader */
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
        if (url.pathname === window.location.pathname && !url.search) return;
        const targetPath = normalizePath(url.pathname);
        pendingNavRef.current = targetPath;
        if (
          targetPath.startsWith("/anime/") ||
          targetPath.startsWith("/watch/") ||
          targetPath.startsWith("/movie/") ||
          targetPath.startsWith("/tv/") ||
          targetPath.startsWith("/manga/")
        ) {
          declarePageLoading();
          awaitingContentRef.current = true;
          if (shownAtRef.current === null) {
            shownAtRef.current = Date.now();
          }
          setVisible(true);
        }
      } catch {
        return;
      }
    };

    const navigation = (window as unknown as { navigation?: EventTarget })
      .navigation;
    navigation?.addEventListener("navigate", onNavigate);
    return () => navigation?.removeEventListener("navigate", onNavigate);
  }, []);

  /* Popstate (browser back/forward button): catch transitions back to anime or media pages */
  useEffect(() => {
    const onPopState = () => {
      const currentPath = normalizePath(window.location.pathname);
      pendingNavRef.current = currentPath;
      if (
        currentPath.startsWith("/anime/") ||
        currentPath.startsWith("/watch/") ||
        currentPath.startsWith("/movie/") ||
        currentPath.startsWith("/tv/") ||
        currentPath.startsWith("/manga/")
      ) {
        declarePageLoading();
        awaitingContentRef.current = true;
        if (shownAtRef.current === null) {
          shownAtRef.current = Date.now();
        }
        setVisible(true);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* End signals from the page:
     - route enter complete -> end unless the page is still loading content
     - page content loading  -> wait for the page's own content, not just the shell
     - page content ready    -> content is on screen, end the loader */
  useEffect(() => {
    const onEnterComplete = () => {
      if (!awaitingContentRef.current && !isPageContentLoading()) {
        requestHide();
      }
    };
    const onContentLoading = () => {
      awaitingContentRef.current = true;
      if (shownAtRef.current === null) {
        shownAtRef.current = Date.now();
      }
      setVisible(true);
      if (timersRef.current.enterFallback) {
        window.clearTimeout(timersRef.current.enterFallback);
        timersRef.current.enterFallback = undefined;
      }
      if (timersRef.current.contentFallback) {
        window.clearTimeout(timersRef.current.contentFallback);
      }
      timersRef.current.contentFallback = window.setTimeout(
        hide,
        CONTENT_FALLBACK_MS
      );
    };
    const onContentReady = () => {
      awaitingContentRef.current = false;
      requestHide();
    };

    window.addEventListener(ROUTE_ENTER_COMPLETE, onEnterComplete);
    window.addEventListener(PAGE_LOADING_EVENT, onContentLoading);
    window.addEventListener(PAGE_READY_EVENT, onContentReady);
    return () => {
      window.removeEventListener(ROUTE_ENTER_COMPLETE, onEnterComplete);
      window.removeEventListener(PAGE_LOADING_EVENT, onContentLoading);
      window.removeEventListener(PAGE_READY_EVENT, onContentReady);
    };
  }, [requestHide, hide]);

  /* Consume the pending mark and arm the fallback timers for this route. */
  useEffect(() => {
    pendingNavRef.current = null;
    if (!visible) return;
    if (shownAtRef.current === null) {
      shownAtRef.current = Date.now();
    }

    const isAwaiting = awaitingContentRef.current || isPageContentLoading();
    awaitingContentRef.current = isAwaiting;

    if (!isAwaiting) {
      timersRef.current.enterFallback = window.setTimeout(hide, ENTER_FALLBACK_MS);
    } else {
      if (timersRef.current.enterFallback) {
        window.clearTimeout(timersRef.current.enterFallback);
        timersRef.current.enterFallback = undefined;
      }
      if (!timersRef.current.contentFallback) {
        timersRef.current.contentFallback = window.setTimeout(
          hide,
          CONTENT_FALLBACK_MS
        );
      }
    }
    if (!timersRef.current.safety) {
      timersRef.current.safety = window.setTimeout(hide, SAFETY_MS);
    }
  }, [pathname, visible, hide]);

  /* Cleanup all pending timers on unmount. */
  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="navigation-loader"
          className="fixed inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeInOut" } }}
          transition={{
            opacity: { duration: 0.18, ease: "easeOut" },
          }}
        >
          <LoadingScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
