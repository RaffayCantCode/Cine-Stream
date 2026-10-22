import { fetchJson } from "@/lib/utils";

export type BrowseKind = "movies" | "tv";

/**
 * Movie/TV browse pages randomise their starting TMDB page so visitors see a
 * different slice of the catalogue. Picking a *new* page on every mount made
 * every visit a guaranteed cold TMDB request (and a cache miss), which is what
 * made repeated navigation feel slow.
 *
 * Keeping the chosen page for the lifetime of the tab keeps the product
 * behaviour (a fresh random slice per session) while letting the normal
 * fetchJson session cache serve the page instantly on every later visit.
 */
const START_PAGE_KEY_PREFIX = "cinestream_browse_start_page_";
const MAX_START_PAGE = 100;

export function getBrowseStartPage(kind: BrowseKind): number {
  if (typeof window === "undefined") return 1;

  const key = `${START_PAGE_KEY_PREFIX}${kind}`;
  try {
    const saved = Number(window.sessionStorage.getItem(key));
    if (Number.isInteger(saved) && saved >= 1 && saved <= MAX_START_PAGE) {
      return saved;
    }
    const next = Math.floor(Math.random() * MAX_START_PAGE) + 1;
    window.sessionStorage.setItem(key, String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * MAX_START_PAGE) + 1;
  }
}

/** URL used for the default first request of each browse page. */
export function getBrowsePageUrl(kind: BrowseKind, page: number): string {
  const endpoint =
    kind === "movies"
      ? "/api/tmdb/discover/movies"
      : "/api/tmdb/discover/tv";
  return `${endpoint}?sortBy=popularity.desc&page=${page}`;
}

/**
 * Warm the exact request the browse page is about to make. Called on
 * hover/focus/touch of the Movies and TV nav links so the response is usually
 * already cached by the time the route mounts.
 */
export function prefetchBrowse(kind: BrowseKind): void {
  if (typeof window === "undefined") return;
  const page = getBrowseStartPage(kind);
  // fetchJson dedupes in-flight requests and stores the result in its
  // session cache, so repeated hovers cost nothing.
  void fetchJson(getBrowsePageUrl(kind, page)).catch(() => {});
  // Warm the genre chips as well; this endpoint is cached for 24h.
  void fetchJson(
    kind === "movies" ? "/api/tmdb/genres/movies" : "/api/tmdb/genres/tv"
  ).catch(() => {});
}

export function prefetchBrowseRoute(href: string): void {
  if (href === "/browse/movies") {
    prefetchBrowse("movies");
  } else if (href === "/browse/tv") {
    prefetchBrowse("tv");
  }
}

type RoutePrefetch = (href: string) => void;

let primaryRoutePrefetchScheduled = false;

/**
 * Warm the actual routes (RSC payload + page JS) for Movies and TV once per
 * session.
 *
 * The desktop nav links only mount while the menu capsule is open, so Next's
 * automatic <Link> prefetch never sees them — every first click used to wait
 * for the route payload before the page could open. Prefetching on mount
 * removes that wait and lets the browse pages paint immediately.
 *
 * Skipped on save-data / 2G connections, where the extra downloads would cost
 * more than they save.
 */
export function prefetchPrimaryBrowseRoutes(prefetch: RoutePrefetch): void {
  if (typeof window === "undefined" || primaryRoutePrefetchScheduled) return;

  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData) return;
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) {
    return;
  }

  primaryRoutePrefetchScheduled = true;

  const run = () => {
    prefetch("/browse/movies");
    prefetch("/browse/tv");
  };

  // Give the current page's own chunks a moment to settle first.
  window.setTimeout(run, 400);
}

let primaryPrefetchScheduled = false;

/**
 * Warm the primary Movies/TV browse data once per browser session, shortly
 * after the first page settles. Those destinations are the main navigation
 * targets, so having their first page ready makes them open instantly even
 * when the visitor goes straight from the home page without hovering.
 *
 * Skipped entirely for save-data / 2G connections, where the extra requests
 * would cost more than they save.
 */
export function prefetchPrimaryBrowse(pathname?: string | null): void {
  if (typeof window === "undefined" || primaryPrefetchScheduled) return;

  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData) return;
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) {
    return;
  }

  primaryPrefetchScheduled = true;

  const run = () => {
    if (!pathname?.startsWith("/browse/movies")) prefetchBrowse("movies");
    if (!pathname?.startsWith("/browse/tv")) prefetchBrowse("tv");
  };

  // Let the current page's critical content and images start first.
  window.setTimeout(run, 1200);
}
