import { useEffect, useRef } from "react";

/** Dispatched by pages that load async content so the NavigationLoader
    knows to wait for that content before ending its screen. */
export const PAGE_LOADING_EVENT = "sv:content-loading";
/** Dispatched when a page's primary content has finished loading. */
export const PAGE_READY_EVENT = "sv:content-ready";

let loadingPath: string | null = null;

const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

export function declarePageLoading(): void {
  loadingPath =
    typeof window !== "undefined" ? normalizePath(window.location.pathname) : null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PAGE_LOADING_EVENT));
  }
}

export function declarePageReady(): void {
  loadingPath = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PAGE_READY_EVENT));
  }
}

export function isPageContentLoading(): boolean {
  if (!loadingPath) return false;
  if (typeof window === "undefined") return true;
  // A loading flag left behind by a route the visitor already left must not
  // hold the loader on the new page.
  return loadingPath === normalizePath(window.location.pathname);
}

/**
 * Announces to the NavigationLoader that this page loads async content and
 * reports once it is ready. Pass `ready` true once the primary content has
 * rendered (or failed) — the loading screen then ends instead of hiding
 * while the page still shows skeletons.
 */
export function usePageContentReady(ready: boolean): void {
  const announced = useRef(false);

  useEffect(() => {
    if (!ready) {
      declarePageLoading();
      announced.current = false;
    }
  }, []);

  useEffect(() => {
    if (ready && !announced.current) {
      announced.current = true;
      declarePageReady();
    } else if (!ready) {
      announced.current = false;
      declarePageLoading();
    }
  }, [ready]);
}

