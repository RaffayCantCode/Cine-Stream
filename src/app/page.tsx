"use client";
export const runtime = 'edge';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame, Star, TrendingUp, Clock, Sparkles, Layers, Film, Tv, Heart, Trophy, Bookmark, Play, Clapperboard, Compass, Zap, Award } from "lucide-react";
import { fetchJson, filterReleasedSafeContent, isTmdbAnime, filterExcludeAnime } from "@/lib/utils";
import { PROVIDERS } from "@/lib/providers";
import type { AnimeItem } from "@/components/AnimeCard";
import { fetchClientAnime } from "@/lib/anilist-client";
import { HeroBanner } from "@/components/HeroBanner";
import { HeroSkeleton } from "@/components/HeroSkeleton";
import { HeroAnnouncement } from "@/components/HeroAnnouncement";
import { MediaRow } from "@/components/MediaRow";
import { AnimeRow } from "@/components/AnimeRow";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ContinueWatching } from "@/components/ContinueWatching";
import { Sidebar } from "@/components/Sidebar";
import { TrendingProvidersHub } from "@/components/TrendingProvidersHub";
import { FRANCHISES } from "@/lib/franchises";
import { usePageContentReady } from "@/lib/pageLoad";
import { useTheme } from "@/context/ThemeContext";

const INITIAL_COLLECTIONS = FRANCHISES.map(f => ({
  id: f.id,
  name: f.name,
  overview: f.overview,
  poster_path: f.poster_path,
  backdrop_path: f.backdrop_path,
}));

// Languages to exclude from home page (Indian content — most don't have working sources)
const EXCLUDED_LANGS = new Set(["hi", "te", "ta", "ml", "kn", "bn", "mr", "gu", "pa", "ur"]);

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  media_type?: string;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  genre_ids?: number[];
}

interface Genre {
  id: number;
  name: string;
}

// ─── Global Home Cache (persists in memory across client-side page navigations) ──
let globalHomeCache: {
  trending: MediaItem[];
  popular: MediaItem[];
  topRated: MediaItem[];
  topRatedMovies: MediaItem[];
  topRatedTv: MediaItem[];
  recent: MediaItem[];
  trendingMoviesToday: MediaItem[];
  trendingTvToday: MediaItem[];
  heroTrendingFeed: MediaItem[];
  heroPopularFeed: MediaItem[];
  heroTopRatedFeed: MediaItem[];
  heroFeed: MediaItem[];
  heroPool: MediaItem[];
  recommended: MediaItem[];
  genres: Genre[];
  animeList: AnimeItem[];
  collections: any[];
  spotlightBanner?: any | null;
  customSections?: any[];
} | null = null;

let globalCustomSectionsCache: any[] | null = null;
let globalCustomSectionsCachedAt = 0;
let globalSpotlightCachedAt = 0;
const SESSION_CUSTOM_SECTIONS_KEY = "sv_custom_sections_v2";

function saveCustomSectionsToSession(sections: any[]): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SESSION_CUSTOM_SECTIONS_KEY, JSON.stringify(sections)); } catch {}
}

function loadCustomSectionsFromSession(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_CUSTOM_SECTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

let globalSpotlightCache: { fetched: boolean; spotlight: any | null } | null = null;
const SESSION_SPOTLIGHT_KEY = "sv_spotlight_banner_v2";

function saveSpotlightToSession(spotlight: any | null): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(SESSION_SPOTLIGHT_KEY, JSON.stringify({ fetched: true, spotlight })); } catch {}
}

function loadSpotlightFromSession(): { fetched: boolean; spotlight: any | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_SPOTLIGHT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "fetched" in parsed) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

const SESSION_HERO_POOL_KEY = "sv_home_hero_pool_v4";
const HERO_CACHE_TTL = 5 * 60 * 1000; // 5-minute TTL: instant load from cache, fresh entries after 5 minutes
const ANILIST_CACHE_KEY = "sv_home_anilist_items_v2";

function saveCachedAniListItems(items: AnimeItem[]): void {
  if (typeof window === "undefined" || !Array.isArray(items) || items.length === 0) return;
  try {
    const valid = items.filter((i) => i && i.id && i.name);
    if (valid.length > 0) {
      localStorage.setItem(ANILIST_CACHE_KEY, JSON.stringify(valid.slice(0, 50)));
    }
  } catch {}
}

function loadCachedAniListItems(): AnimeItem[] {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(ANILIST_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return [];
}

function saveHeroPoolToSession(pool: MediaItem[]): void {
  if (typeof window === "undefined" || !Array.isArray(pool) || pool.length === 0) return;
  try {
    // Keep exactly 3 slides (Movie, TV, Anime)
    localStorage.setItem(
      SESSION_HERO_POOL_KEY,
      JSON.stringify({ pool: pool.slice(0, 3), timestamp: Date.now() })
    );
  } catch {}
}

function loadHeroPoolFromSession(): MediaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSION_HERO_POOL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.pool) && parsed.pool.length > 0) {
        return parsed.pool.slice(0, 3);
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3);
      }
    }
  } catch {}
  return [];
}

function isHeroSessionStale(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(SESSION_HERO_POOL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.timestamp === "number") {
        return Date.now() - parsed.timestamp > HERO_CACHE_TTL;
      }
    }
  } catch {}
  return true;
}

// Persist seen hero IDs in localStorage (not sessionStorage) so no repeats across multiple visits.
// Keeps the last 120 seen IDs with a 30-day expiry.
const SEEN_HERO_KEY = "sv_seen_hero_v2";
function loadSeenHeroIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_HERO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.ids)) {
        const age = Date.now() - (parsed.ts || 0);
        if (age < 30 * 24 * 60 * 60 * 1000) {
          return new Set(parsed.ids.map(String));
        }
      }
    }
  } catch {}
  return new Set();
}
function saveSeenHeroIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(ids).slice(-120);
    localStorage.setItem(SEEN_HERO_KEY, JSON.stringify({ ids: arr, ts: Date.now() }));
  } catch {}
}

// Quality score: weighted rating × log10(vote count) to favour acclaimed + well-known entries
function heroQualityScore(item: MediaItem): number {
  const rating = item.vote_average || 0;
  const votes = item.vote_count || 0;
  if (votes < 50) return 0;
  return rating * Math.log10(Math.max(votes, 10));
}

function buildHeroPool(feed: MediaItem[], animeList?: AnimeItem[]): MediaItem[] {
  if (!Array.isArray(feed) || feed.length === 0) return [];

  const isValidHeroCandidate = (i: MediaItem) => {
    if (!i || !i.id) return false;
    if ((i as any).adult) return false;
    if (!i.backdrop_path || !i.poster_path) return false;
    if (!i.overview || i.overview.trim().length < 20) return false;
    if (EXCLUDED_LANGS.has(i.original_language || "")) return false;
    return true;
  };

  const validFeed = feed.filter(isValidHeroCandidate);
  if (validFeed.length === 0) return [];

  // ── Movie candidates ──────────────────────────────────────────────────────
  // Must have explicit media_type=movie OR title-but-no-name. Require ≥200 votes for legitimacy.
  const movieCandidates = Array.from(
    new Map(
      validFeed
        .filter(
          (i) =>
            !isTmdbAnime(i) &&
            !(i.genre_ids?.includes(16) && i.original_language === "ja") &&
            (i.media_type === "movie" || (!!i.title && !i.name)) &&
            (i.vote_count || 0) >= 50
        )
        .sort((a, b) => heroQualityScore(b) - heroQualityScore(a))
        .map((m) => [m.id, m])
    ).values()
  );

  // ── TV candidates ─────────────────────────────────────────────────────────
  const tvCandidates = Array.from(
    new Map(
      validFeed
        .filter(
          (i) =>
            !isTmdbAnime(i) &&
            !(i.genre_ids?.includes(16) && i.original_language === "ja") &&
            (i.media_type === "tv" || (!!i.name && !i.title)) &&
            (i.vote_count || 0) >= 50
        )
        .sort((a, b) => heroQualityScore(b) - heroQualityScore(a))
        .map((t) => [t.id, t])
    ).values()
  );

  // ── Anime candidates ──────────────────────────────────────────────────────
  // AniList items dynamically fetched from AniList (trending + popular)
  const rawAnimePool = (Array.isArray(animeList) && animeList.length > 0)
    ? animeList
    : loadCachedAniListItems();

  const validAnime = rawAnimePool.filter(
    (a) =>
      a && a.id && a.name &&
      ((typeof a.poster === "string" && a.poster.startsWith("http")) ||
        (typeof a.bannerImage === "string" && a.bannerImage.startsWith("http")))
  );

  const animeCandidates = validAnime.map((a) => ({
    id: (Number(a.id) || a.id) as any,
    anilistId: String(a.id),
    title: a.name,
    name: a.name,
    poster_path: a.poster || a.bannerImage || "",
    backdrop_path: a.bannerImage || a.poster || "",
    media_type: "anime" as const,
    vote_average: a.rating ? parseFloat(a.rating) : 8.5,
    vote_count: 500,
    overview: (a.description || "").replace(/<[^>]*>/g, "").trim(),
    release_date: a.seasonYear ? `${a.seasonYear}-01-01` : "",
    original_language: "ja",
    genre_ids: [16],
    isTmdbAnime: false,
  })) as MediaItem[];

  // Deduplicate anime by normalised title
  const uniqueAnimeMap = new Map<string, MediaItem>();
  for (const c of animeCandidates) {
    const key = (c.name || c.title || "").toLowerCase().trim();
    if (key && !uniqueAnimeMap.has(key)) uniqueAnimeMap.set(key, c);
  }
  const uniqueAnimeCandidates = Array.from(uniqueAnimeMap.values());

  // ── Seen-ID tracking (localStorage, 30-day TTL) ───────────────────────────
  const seenIds = loadSeenHeroIds();

  // Pick from the top quality tier (top 60%) but prefer unseen entries.
  // When all candidates in a category have been seen, cycle resets for that category.
  const pickBestCandidate = (candidates: MediaItem[]): MediaItem | null => {
    if (candidates.length === 0) return null;

    // Work in the top-quality tier (top 60% by quality score, minimum 6 entries)
    const tierSize = Math.max(6, Math.ceil(candidates.length * 0.6));
    const topTier = candidates.slice(0, tierSize);

    let pool = topTier.filter((c) => !seenIds.has(String(c.id)));

    if (pool.length === 0) {
      // All top-tier seen — widen to full list for a fresh candidate
      pool = candidates.filter((c) => !seenIds.has(String(c.id)));
    }

    if (pool.length === 0) {
      // Every candidate seen — reset seen for this category and start fresh
      candidates.forEach((c) => seenIds.delete(String(c.id)));
      pool = topTier;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];
    if (picked) seenIds.add(String(picked.id));
    return picked || null;
  };

  const movieCard = pickBestCandidate(movieCandidates);
  const tvCard = pickBestCandidate(tvCandidates);
  const animeCard = pickBestCandidate(uniqueAnimeCandidates);

  saveSeenHeroIds(seenIds);

  const heroPool = [movieCard, tvCard, animeCard].filter(Boolean) as MediaItem[];
  return heroPool.slice(0, 3);
}

// ─── Session-stable shuffle ───────────────────────────────────────────────────
// We want different results every SESSION (new tab / new browser open) but
// stable within the same session (so a page reload within a tab keeps the same order).
function getSessionSeed(): number {
  if (typeof window === "undefined") return 42;
  try {
    let seedStr = sessionStorage.getItem("sv_session_seed");
    if (!seedStr) {
      seedStr = String(Math.floor(Math.random() * 1_000_000));
      sessionStorage.setItem("sv_session_seed", seedStr);
    }
    return parseInt(seedStr, 10) || 42;
  } catch {
    return 42;
  }
}

// Seeded pseudo-random number generator (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sessionShuffle<T>(array: T[] | null | undefined, salt: string = ""): T[] {
  if (!Array.isArray(array)) return [];
  const seed = getSessionSeed() ^ salt.split("").reduce((a, c) => a ^ c.charCodeAt(0), 0);
  const rng = mulberry32(seed);
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function LazySection({ children, show, placeholderHeight = 0 }: { children: React.ReactNode; show: boolean; placeholderHeight?: number }) {
  return show ? (
    <section>
      {children}
    </section>
  ) : (
    <div className="relative" style={{ height: placeholderHeight || undefined }}>
      {placeholderHeight > 0 && <div className="absolute inset-0 skeleton-pulse rounded-xl" />}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({
  title,
  subtitle,
  icon: Icon,
  href,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-[2px] bg-gradient-to-r from-[#7288AE] to-transparent rounded-full" />
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-[#7288AE]" />}
            <h2 className="text-lg font-black text-[#EAE0CF] tracking-tight">{title}</h2>
          </div>
          {subtitle && (
            <p className="text-[9px] text-[#7288AE]/50 font-semibold tracking-[0.15em] uppercase mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-semibold text-white/40 hover:text-[#7288AE] transition-colors group"
        >
          See all <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}

let lastHeroShuffleTime = Date.now();

// ─── Main component ───────────────────────────────────────────────────────────
export default function Home() {
  const { theme } = useTheme();
  const isGlobalTheme = theme === "global";

  const pageBgClass = useMemo(() => {
    switch (theme) {
      case "global":
        return "bg-[#07080d]";
      case "glass":
        return "bg-transparent";
      case "oled":
        return "bg-[#000000]";
      case "cinema":
        return "bg-[#140509]";
      case "wisteria":
        return "bg-[#0e071c]";
      case "solaris":
        return "bg-[#100b05]";
      default:
        return "bg-[#07080d]";
    }
  }, [theme]);

  const [heroIndex, setHeroIndex] = useState(0);
  const [trending, setTrending] = useState<MediaItem[]>(() => globalHomeCache?.trending || []);
  const [popular, setPopular] = useState<MediaItem[]>(() => globalHomeCache?.popular || []);
  const [topRated, setTopRated] = useState<MediaItem[]>(() => globalHomeCache?.topRated || []);
  const [topRatedMovies, setTopRatedMovies] = useState<MediaItem[]>(() => globalHomeCache?.topRatedMovies || []);
  const [topRatedTv, setTopRatedTv] = useState<MediaItem[]>(() => globalHomeCache?.topRatedTv || []);
  const [recent, setRecent] = useState<MediaItem[]>(() => globalHomeCache?.recent || []);
  const [trendingMoviesToday, setTrendingMoviesToday] = useState<MediaItem[]>(() => globalHomeCache?.trendingMoviesToday || []);
  const [trendingTvToday, setTrendingTvToday] = useState<MediaItem[]>(() => globalHomeCache?.trendingTvToday || []);
  const [heroTrendingFeed, setHeroTrendingFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroTrendingFeed || []);
  const [heroPopularFeed, setHeroPopularFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroPopularFeed || []);
  const [heroTopRatedFeed, setHeroTopRatedFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroTopRatedFeed || []);
  const [heroFeed, setHeroFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroFeed || []);
  const [heroPool, setHeroPool] = useState<MediaItem[]>(() => {
    // 1. In-memory globalHomeCache: back-navigation within the same SPA session (instant)
    if (globalHomeCache?.heroPool && globalHomeCache.heroPool.length > 0) {
      return globalHomeCache.heroPool;
    }
    // 2. sessionStorage: fresh cache (≤5 min) → instant load on hard refresh with no extra requests
    if (!isHeroSessionStale()) {
      return loadHeroPoolFromSession();
    }
    // 3. Stale or empty → will fetch fresh entries
    return [];
  });
  const [recommended, setRecommended] = useState<MediaItem[]>(() => globalHomeCache?.recommended || []);
  const [genres, setGenres] = useState<Genre[]>(() => globalHomeCache?.genres || []);
  const [isLoading, setIsLoading] = useState(() => {
    // No skeleton if we have a valid cached pool (either in-memory or fresh session)
    if (globalHomeCache?.heroPool && globalHomeCache.heroPool.length > 0) return false;
    if (!isHeroSessionStale() && loadHeroPoolFromSession().length > 0) return false;
    return true;
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [animeList, setAnimeList] = useState<AnimeItem[]>(() => globalHomeCache?.animeList || []);
  const [collections, setCollections] = useState<any[]>(() =>
    (globalHomeCache?.collections && globalHomeCache.collections.length > 0)
      ? globalHomeCache.collections
      : INITIAL_COLLECTIONS
  );
  const [animeLoading, setAnimeLoading] = useState(() => !globalHomeCache);
  const [heroArtworkReady, setHeroArtworkReady] = useState(false);
  const [revealedSections, setRevealedSections] = useState(1);
  const [moodSeed, setMoodSeed] = useState("");
  const [customSections, setCustomSections] = useState<any[]>(() => {
    if (globalCustomSectionsCache !== null) {
      return globalCustomSectionsCache;
    }
    if (globalHomeCache?.customSections && globalHomeCache.customSections.length > 0) {
      return globalHomeCache.customSections;
    }
    return loadCustomSectionsFromSession();
  });
  const [spotlightBanner, setSpotlightBanner] = useState<any | null>(() => {
    if (globalSpotlightCache !== null) {
      return globalSpotlightCache.spotlight;
    }
    if (globalHomeCache?.spotlightBanner !== undefined) {
      return globalHomeCache.spotlightBanner;
    }
    const sessionCached = loadSpotlightFromSession();
    if (sessionCached) {
      globalSpotlightCache = sessionCached;
      return sessionCached.spotlight;
    }
    return null;
  });
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerReset, setTimerReset] = useState(0);
  usePageContentReady(!isLoading);

  const heroPoolLengthRef = useRef(0);

  useEffect(() => {
    setMoodSeed(`${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`);
  }, []);

  // Listen to spotlight updates (e.g. from Admin Panel saves)
  useEffect(() => {
    const handleSpotlightUpdate = (e: any) => {
      const data = e.detail;
      if (data?.enabled && data.title) {
        const sp = {
          id: data.id || "spotlight",
          title: data.title,
          tagline: data.tagline,
          description: data.description,
          backdrop_path: data.backdropPath || data.backdrop_path,
          poster_path: data.posterPath || data.poster_path,
          target_url: data.targetUrl || data.target_url,
          media_type: data.mediaType || data.media_type || "movie",
          badge: data.badge || "Spotlight",
        };
        globalSpotlightCache = { fetched: true, spotlight: sp };
        if (globalHomeCache) globalHomeCache.spotlightBanner = sp;
        saveSpotlightToSession(sp);
        setSpotlightBanner(sp);
      } else {
        globalSpotlightCache = { fetched: true, spotlight: null };
        if (globalHomeCache) globalHomeCache.spotlightBanner = null;
        saveSpotlightToSession(null);
        setSpotlightBanner(null);
      }
    };
    window.addEventListener("sv:spotlight-updated", handleSpotlightUpdate);
    return () => window.removeEventListener("sv:spotlight-updated", handleSpotlightUpdate);
  }, []);

  // Touch swipe gesture states for mobile Hero banner
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe && heroPool.length > 1) {
      navigateHero(1);
    } else if (isRightSwipe && heroPool.length > 1) {
      navigateHero(-1);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const ADMIN_CACHE_TTL = 30 * 60_000; // 30 minutes

    // Fetch admin-curated custom homepage sections — only if cache is stale
    if (globalCustomSectionsCache === null || Date.now() - globalCustomSectionsCachedAt > ADMIN_CACHE_TTL) {
      fetchJson<{ sections?: any[] }>("/api/home-sections", { cacheTtlMs: ADMIN_CACHE_TTL })
        .then((data) => {
          if (data?.sections && Array.isArray(data.sections) && !cancelled) {
            globalCustomSectionsCache = data.sections;
            globalCustomSectionsCachedAt = Date.now();
            if (globalHomeCache) globalHomeCache.customSections = data.sections;
            saveCustomSectionsToSession(data.sections);
            setCustomSections(data.sections);
          }
        })
        .catch(() => {});
    }

    // Fetch spotlight banner — only if cache is stale
    if (!globalSpotlightCache || Date.now() - globalSpotlightCachedAt > ADMIN_CACHE_TTL) {
      fetchJson<{ enabled?: boolean; spotlight?: any }>("/api/spotlight", { cacheTtlMs: ADMIN_CACHE_TTL })
        .then((data) => {
          if (cancelled) return;
          if (data?.enabled && data.spotlight) {
            globalSpotlightCache = { fetched: true, spotlight: data.spotlight };
            globalSpotlightCachedAt = Date.now();
            if (globalHomeCache) globalHomeCache.spotlightBanner = data.spotlight;
            saveSpotlightToSession(data.spotlight);
            setSpotlightBanner(data.spotlight);
          } else {
            globalSpotlightCache = { fetched: true, spotlight: null };
            globalSpotlightCachedAt = Date.now();
            if (globalHomeCache) globalHomeCache.spotlightBanner = null;
            saveSpotlightToSession(null);
            setSpotlightBanner(null);
          }
        })
        .catch(() => {});
    }

    if (globalHomeCache && globalHomeCache.heroPool && globalHomeCache.heroPool.length > 0) {
      // Hydrate states from cache on back-navigation, even if React state
      // was not properly initialized (e.g. router cache preserved component)
      if (isLoading) setIsLoading(false);
      if (animeLoading) setAnimeLoading(false);
      if (heroPool.length === 0) {
        setHeroPool(globalHomeCache.heroPool);
      }
      if (globalHomeCache.customSections && globalHomeCache.customSections.length > 0) {
        setCustomSections(globalHomeCache.customSections);
      }
      if (loadError) setLoadError(null);

      // Only rebuild hero pool when the localStorage TTL has actually expired — same gate
      // used by fresh page loads. This prevents back-navigation from changing the hero mid-session.
      if (isHeroSessionStale() && globalHomeCache.heroFeed && globalHomeCache.heroFeed.length > 0) {
        const freshPool = buildHeroPool(globalHomeCache.heroFeed, globalHomeCache.animeList || loadCachedAniListItems());
        if (freshPool.length >= 3) {
          setHeroPool(freshPool);
          saveHeroPoolToSession(freshPool);
          globalHomeCache.heroPool = freshPool;
        }
      } else {
        // Cache is still fresh (< 5 mins)! Maintain the EXACT same 3 hero cards!
        const saved = loadHeroPoolFromSession();
        const active = saved.length >= 3 ? saved : globalHomeCache.heroPool;
        setHeroPool(active);
        globalHomeCache.heroPool = active;
      }
      return;
    }

    // Safety timeout: never let the loading skeleton show indefinitely
    const loadingTimeout = setTimeout(() => {
      if (cancelled) return;
      setIsLoading(false);
      setAnimeLoading(false);
    }, 5000);

    const load = async () => {
      if (heroPool.length === 0) {
        setIsLoading(true);
      }
      setLoadError(null);

      try {
        // Fast hero fetch — dedicated lightweight edge call that returns hero candidates in <80ms
        // Only used when heroPool is empty (stale/first load) to show something quickly before the
        // full home payload arrives. Always runs through buildHeroPool to keep exactly 3 slides.
        if (heroPool.length === 0) {
          fetchJson<{ results: MediaItem[] }>("/api/tmdb/home-hero", { cacheTtlMs: 3600000 })
            .then((heroData) => {
              if (cancelled || !heroData?.results || heroData.results.length === 0) return;
              const filtered = heroData.results.filter((i) => i && i.backdrop_path && i.poster_path);
              if (filtered.length > 0) {
                const fastPool = buildHeroPool(filtered);
                if (fastPool.length > 0) {
                  setHeroPool((current) => (current && current.length >= 3 ? current : fastPool));
                }
              }
            })
            .catch(() => {});
        }

        // Consolidated home endpoint for content rows below the hero
        const homePromise = fetchJson<{
          trending: { results: MediaItem[] };
          popularMovies: { results: MediaItem[] };
          topRatedMovies: { results: MediaItem[] };
          nowPlaying: { results: MediaItem[] };
          popularTv: { results: MediaItem[] };
          topRatedTv: { results: MediaItem[] };
          onTheAir: { results: MediaItem[] };
          animeMovies: { results: MediaItem[] };
          animeTv: { results: MediaItem[] };
          trendingMoviesToday: { results: MediaItem[] };
          trendingTvToday: { results: MediaItem[] };
          genres: { genres: Genre[] };
        }>("/api/tmdb/home?v=3", { cacheTtlMs: 3600000 }).catch(() => null);

        // Fetch both trending and all-time popular anime
        const trendingAnimePromise = fetchClientAnime("trending", 1).catch(() => ({ items: [] }));
        const popularAnimePromise = fetchClientAnime("popular", 1).catch(() => ({ items: [] }));
        const animePromise = Promise.all([
          trendingAnimePromise,
          popularAnimePromise,
        ]).then(([trendingRes, popularRes]) => {
          const combined = [...(trendingRes.items || []), ...(popularRes.items || [])];
          const uniqueMap = new Map<string, AnimeItem>();
          combined.forEach((item) => {
            if (item && item.id && !uniqueMap.has(item.id)) {
              uniqueMap.set(item.id, item);
            }
          });
          return { items: Array.from(uniqueMap.values()), trending: trendingRes.items || [], hasMore: true };
        }).catch(() => ({ items: [], trending: [] }));
        const collectionsPromise = fetchJson<{ collections: any[] }>("/api/tmdb/collections", { cacheTtlMs: 86400000 }).catch(() => ({ collections: [] }));

        // Await homeData and dynamic animePromise together in parallel
        const [homeData, animeResponse] = await Promise.all([homePromise, animePromise]);
        if (cancelled) return;

        if (homeData) {
          const trendingSafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.trending?.results || [])
              .filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );
          const popularSafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.popularMovies?.results || []).map(
              (i) => ({ ...i, media_type: "movie" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );
          const heroTopSafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.topRatedTv?.results || []).map(
              (i) => ({ ...i, media_type: "tv" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );
          const heroRecentSafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.nowPlaying?.results || []).map(
              (i) => ({ ...i, media_type: "movie" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );

          const topRatedMovieSafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.topRatedMovies?.results || []).map(
              (i) => ({ ...i, media_type: "movie" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );
          const popularTvSafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.popularTv?.results || []).map(
              (i) => ({ ...i, media_type: "tv" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );
          const onTheAirSafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.onTheAir?.results || []).map(
              (i) => ({ ...i, media_type: "tv" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );
          const animeMovieSafe = filterReleasedSafeContent(homeData.animeMovies?.results || []).map(
            (i) => ({ ...i, media_type: "movie" as const, genre_ids: i.genre_ids || [16], original_language: "ja" })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const animeTvSafe = filterReleasedSafeContent(homeData.animeTv?.results || []).map(
            (i) => ({ ...i, media_type: "tv" as const, genre_ids: i.genre_ids || [16], original_language: "ja" })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const trendingMoviesTodaySafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.trendingMoviesToday?.results || []).map(
              (i) => ({ ...i, media_type: "movie" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""))
          );
          const trendingTvTodaySafe = filterExcludeAnime(
            filterReleasedSafeContent(homeData.trendingTvToday?.results || []).map(
              (i) => ({ ...i, media_type: "tv" as const })
            ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || "") && i.original_language !== "ja")
          );

          // Dynamic AniList anime (trending & popular)
          const rawDynamicAnime = ((animeResponse as any)?.items && (animeResponse as any).items.length > 0)
            ? (animeResponse as any).items
            : ((animeResponse as any)?.trending && (animeResponse as any).trending.length > 0)
              ? (animeResponse as any).trending
              : loadCachedAniListItems();

          if (rawDynamicAnime.length > 0) {
            saveCachedAniListItems(rawDynamicAnime);
          }

          const finalAnimeList = rawDynamicAnime.slice(0, 18);
          setAnimeList(finalAnimeList);
          setAnimeLoading(false);

          const recPool = filterExcludeAnime([...popularSafe, ...heroTopSafe, ...trendingSafe, ...heroRecentSafe]);
          const daySalt = Math.floor(Date.now() / 86400000).toString();

          const fullHeroFeed = [
            ...trendingSafe,
            ...popularSafe,
            ...heroTopSafe,
            ...heroRecentSafe,
            ...topRatedMovieSafe,
            ...popularTvSafe,
            ...onTheAirSafe,
            ...animeMovieSafe,
            ...animeTvSafe,
          ];

          // Check if existing 5-minute pool in localStorage is still fresh
          const existingSaved = loadHeroPoolFromSession();
          const shouldKeepExisting = !isHeroSessionStale() && existingSaved.length >= 3;

          let chosenHeroPool: MediaItem[];
          if (shouldKeepExisting) {
            chosenHeroPool = existingSaved;
          } else {
            // Build fresh hero pool with genuine dynamic AniList anime:
            chosenHeroPool = buildHeroPool(fullHeroFeed, rawDynamicAnime);
            if (chosenHeroPool.length >= 3) {
              saveHeroPoolToSession(chosenHeroPool);
            }
          }

          setTrending(trendingSafe);
          setPopular(sessionShuffle(popularSafe, "popular"));
          setTopRated(sessionShuffle(heroTopSafe, "toprated"));
          setTopRatedMovies(topRatedMovieSafe.slice(0, 10));
          setTopRatedTv(heroTopSafe.slice(0, 10));
          setRecent(heroRecentSafe);
          setTrendingMoviesToday(trendingMoviesTodaySafe);
          setTrendingTvToday(trendingTvTodaySafe);
          setRecommended(sessionShuffle(recPool, `recommended-${daySalt}`));
          setGenres((homeData.genres?.genres || []).slice(0, 18));
          setHeroTrendingFeed([...trendingSafe, ...trendingMoviesTodaySafe, ...trendingTvTodaySafe]);
          setHeroPopularFeed([...popularSafe, ...popularTvSafe, ...heroRecentSafe]);
          setHeroTopRatedFeed([...heroTopSafe, ...topRatedMovieSafe]);
          setHeroFeed(fullHeroFeed);
          setHeroPool(chosenHeroPool);

          if (chosenHeroPool.length > 0) {
            // Preload hero slide 1 backdrop image immediately
            if (typeof document !== "undefined" && chosenHeroPool[0]?.backdrop_path) {
              const bg = chosenHeroPool[0].backdrop_path;
              const link = document.createElement("link");
              link.rel = "preload";
              link.as = "image";
              link.href = bg.startsWith("http") ? bg : `https://image.tmdb.org/t/p/w1280${bg}`;
              link.fetchPriority = "high";
              document.head.appendChild(link);
            }

            // Pre-warm logos for hero items so artwork displays first with 0 delay
            chosenHeroPool.slice(0, 3).forEach((hItem) => {
              const hTitle = hItem.title || hItem.name || "";
              const anilistId = (hItem as any)?.anilistId;
              const isAnime = hItem.media_type === "anime" || !!anilistId || isTmdbAnime(hItem);
              const isTv = hItem.media_type === "tv" || (!isAnime && !!hItem.first_air_date && !hItem.release_date);
              const isMovie = hItem.media_type === "movie" || (!isAnime && !isTv);
              const effectiveId = (hItem as any)?.tmdbId || hItem.id;
              const cacheKey = `${effectiveId || hItem.id}-${hTitle}`;

              if (typeof window !== "undefined" && !sessionStorage.getItem(`logo_v7_${cacheKey}`)) {
                fetch(`/api/tmdb/logo?id=${effectiveId}&type=${isAnime ? "anime" : isMovie ? "movie" : "tv"}&title=${encodeURIComponent(hTitle)}`)
                  .then((r) => (r.ok ? r.json() : null))
                  .then((d) => {
                    if (d?.logoUrl) {
                      try { sessionStorage.setItem(`logo_v7_${cacheKey}`, d.logoUrl); } catch {}
                      const img = new Image();
                      img.src = d.logoUrl;
                    }
                  })
                  .catch(() => {});
              }
            });
          }

          // Release hero and top rows immediately
          setIsLoading(false);

          collectionsPromise.then((collectionsData) => {
            if (cancelled) return;
            const validCollections = (collectionsData?.collections && collectionsData.collections.length > 0)
              ? collectionsData.collections
              : INITIAL_COLLECTIONS;
            setCollections(validCollections);
            if (globalHomeCache) globalHomeCache.collections = validCollections;
          }).catch(() => {});

          globalHomeCache = {
            trending: trendingSafe,
            popular: sessionShuffle(popularSafe, "popular"),
            topRated: sessionShuffle(heroTopSafe, "toprated"),
            topRatedMovies: topRatedMovieSafe.slice(0, 10),
            topRatedTv: heroTopSafe.slice(0, 10),
            recent: heroRecentSafe,
            trendingMoviesToday: trendingMoviesTodaySafe,
            trendingTvToday: trendingTvTodaySafe,
            heroTrendingFeed: [...trendingSafe, ...trendingMoviesTodaySafe, ...trendingTvTodaySafe],
            heroPopularFeed: [...popularSafe, ...popularTvSafe, ...heroRecentSafe],
            heroTopRatedFeed: [...heroTopSafe, ...topRatedMovieSafe],
            heroFeed: fullHeroFeed,
            heroPool: chosenHeroPool,
            recommended: recPool,
            genres: (homeData.genres?.genres || []).slice(0, 18),
            animeList: finalAnimeList,
            collections: INITIAL_COLLECTIONS,
            spotlightBanner: globalSpotlightCache?.spotlight ?? spotlightBanner ?? null,
            customSections: globalCustomSectionsCache ?? (customSections.length > 0 ? customSections : undefined),
          };
        } else {
          setIsLoading(false);
          setAnimeLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load content");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setAnimeLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
    };
  }, []);

  function pickRandom<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const activeHeroCandidate = heroPool[heroIndex] || heroPool[0] || null;
  const hero = spotlightBanner ? {
    id: spotlightBanner.id || "spotlight",
    title: spotlightBanner.title,
    name: spotlightBanner.title,
    overview: spotlightBanner.description || "",
    backdrop_path: spotlightBanner.backdrop_path || spotlightBanner.backdropPath || "",
    poster_path: spotlightBanner.poster_path || spotlightBanner.posterPath || "",
    media_type: spotlightBanner.media_type || spotlightBanner.mediaType || "movie",
    vote_average: 9.2,
    release_date: "",
    isSpotlight: true,
    targetUrl: spotlightBanner.target_url || spotlightBanner.targetUrl || "",
    badge: spotlightBanner.badge || "Spotlight",
  } : activeHeroCandidate;

  // Keep the ref in sync for use inside callbacks (avoids stale closure)
  useEffect(() => { heroPoolLengthRef.current = heroPool.length; }, [heroPool]);

  // ── Manual navigation helpers (reset the auto-rotation timer) ──────────────
  const goToHero = useCallback((index: number) => {
    setHeroIndex(index);
    setTimerReset((c) => c + 1);
  }, []);

  const navigateHero = useCallback((dir: 1 | -1) => {
    setHeroIndex((prev) => (prev + dir + heroPoolLengthRef.current) % heroPoolLengthRef.current);
    setTimerReset((c) => c + 1);
  }, []);

  // ── Clamp heroIndex when heroPool shrinks (safety net) ──────────────────
  useEffect(() => {
    if (heroPool.length > 0 && heroIndex >= heroPool.length) {
      setHeroIndex(0);
    }
  }, [heroPool.length, heroIndex]);

  // ── Preload hero artwork: Slide 0 immediately, and next 2 slides sequentially in background ──
  useEffect(() => {
    if (!heroPool || heroPool.length === 0) return;

    // Helper to preload a single slide's backdrop and logo
    const preloadItem = (item: MediaItem, priority: "high" | "low" = "low") => {
      const path = item.backdrop_path || item.poster_path;
      if (path) {
        const fastUrl = path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w1280${path}`;
        const img = new Image();
        if (priority === "high") {
          img.fetchPriority = "high";
        }
        img.src = fastUrl;

        if (!path.startsWith("http")) {
          const highResUrl = `https://image.tmdb.org/t/p/original${path}`;
          const origImg = new Image();
          origImg.src = highResUrl;
        }
      }

      // Preload logo artwork
      const title = item.title || item.name || "";
      const anilistId = (item as any)?.anilistId;
      const isAnime = item.media_type === "anime" || !!anilistId || isTmdbAnime(item);
      const isMovie = item.media_type === "movie" || (!isAnime && item.media_type !== "tv");
      const effectiveId = (item as any)?.tmdbId || item.id;
      const mediaType = isAnime ? "anime" : isMovie ? "movie" : "tv";
      const cacheKey = `${effectiveId || item.id}-${title}`;

      const cached = typeof window !== "undefined" ? sessionStorage.getItem(`logo_v7_${cacheKey}`) : null;
      if (cached) {
        const logoImg = new Image();
        if (priority === "high") logoImg.fetchPriority = "high";
        logoImg.src = cached;
      } else if (title) {
        fetch(`/api/tmdb/logo?id=${effectiveId}&type=${mediaType}&title=${encodeURIComponent(title)}`, {
          cache: "force-cache",
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.logoUrl) {
              try { sessionStorage.setItem(`logo_v7_${cacheKey}`, data.logoUrl); } catch {}
              const logoImg = new Image();
              logoImg.src = data.logoUrl;
            }
          })
          .catch(() => {});
      }
    };

    // Phase 1: Only fetch & preload the first slide's artwork immediately
    const currentSlide = heroPool[heroIndex] || heroPool[0];
    if (currentSlide) {
      preloadItem(currentSlide, "high");
    }

    // Phase 2: ONLY AFTER first slide artwork is ready, prefetch the next 2 slides during the 10-second idle window
    if (heroArtworkReady && heroPool.length > 1) {
      const timer = setTimeout(() => {
        const next1 = heroPool[(heroIndex + 1) % heroPool.length];
        const next2 = heroPool[(heroIndex + 2) % heroPool.length];
        if (next1) preloadItem(next1, "low");
        if (next2) preloadItem(next2, "low");
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [heroPool, heroIndex, heroArtworkReady]);

  // ── Auto-rotation timer (10 seconds, resets on manual nav) ─────────────
  useEffect(() => {
    if (heroPool.length <= 1) return;
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroPoolLengthRef.current);
    }, 10000);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroPool, timerReset]);

  const activeBackdropUrl = hero?.backdrop_path
    ? hero.backdrop_path.startsWith("http")
      ? hero.backdrop_path
      : `https://image.tmdb.org/t/p/w1280${hero.backdrop_path}`
    : hero?.poster_path
    ? hero.poster_path.startsWith("http")
      ? hero.poster_path
      : `https://image.tmdb.org/t/p/w780${hero.poster_path}`
    : null;

  // Smooth ambient backdrop & color crossfading
  const [ambientBackdrop, setAmbientBackdrop] = useState<{ current: string | null; previous: string | null }>({
    current: activeBackdropUrl,
    previous: null,
  });

  useEffect(() => {
    if (activeBackdropUrl && activeBackdropUrl !== ambientBackdrop.current) {
      setAmbientBackdrop((prev) => ({
        current: activeBackdropUrl,
        previous: prev.current,
      }));
      const t = setTimeout(() => {
        setAmbientBackdrop((prev) => ({ ...prev, previous: null }));
      }, 1100);
      return () => clearTimeout(t);
    }
  }, [activeBackdropUrl, ambientBackdrop.current]);

  // ── Artwork verification gate: Ensure artwork is decoded before revealing HeroBanner ──
  useEffect(() => {
    if (!hero) {
      setHeroArtworkReady(false);
      return;
    }

    const bg = hero.backdrop_path || hero.poster_path;
    if (!bg) {
      setHeroArtworkReady(true);
      return;
    }

    const bgUrl = bg.startsWith("http") ? bg : `https://image.tmdb.org/t/p/w1280${bg}`;
    let isCancelled = false;

    // Safety timeout: Maximum 1.5s skeleton display so slow network doesn't block indefinitely
    const timer = setTimeout(() => {
      if (!isCancelled) setHeroArtworkReady(true);
    }, 1500);

    if (typeof window !== "undefined") {
      const img = new Image();
      img.src = bgUrl;
      img.onload = () => {
        if (isCancelled) return;
        clearTimeout(timer);
        setHeroArtworkReady(true);
      };
      img.onerror = () => {
        if (isCancelled) return;
        clearTimeout(timer);
        setHeroArtworkReady(true);
      };

      if (img.complete) {
        clearTimeout(timer);
        setHeroArtworkReady(true);
      }
    } else {
      setHeroArtworkReady(true);
    }

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [hero?.id, hero?.backdrop_path]);

  // ── Modular Progressive Hydration of Sections Below the Hero ─────────
  useEffect(() => {
    if (heroArtworkReady) {
      const t1 = setTimeout(() => setRevealedSections(2), 150);
      const t2 = setTimeout(() => setRevealedSections(3), 350);
      const t3 = setTimeout(() => setRevealedSections(5), 600);
      const t4 = setTimeout(() => setRevealedSections(8), 900);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [heroArtworkReady]);

  return (
    <div className={`relative min-h-screen ${pageBgClass} text-foreground pb-20 overflow-x-clip transition-colors duration-500`}>
      {/* Ambient Hero Backdrop Glow — ONLY active for the "global" theme! */}
      {isGlobalTheme && (ambientBackdrop.current || ambientBackdrop.previous) && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {ambientBackdrop.previous && (
            <img
              src={ambientBackdrop.previous}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-[120px] opacity-0 scale-140 saturate-[2.2] brightness-[1.02] transition-opacity duration-1000 ease-in-out pointer-events-none"
              aria-hidden
            />
          )}
          {ambientBackdrop.current && (
            <img
              key={ambientBackdrop.current}
              src={ambientBackdrop.current}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-[120px] opacity-[0.78] scale-140 saturate-[2.2] brightness-[1.02] transition-opacity duration-1000 ease-in-out pointer-events-none animate-in fade-in duration-1000"
              aria-hidden
            />
          )}
          {/* Subtle uniform overlay allowing light and vibrant hero colors to permeate the entire home page */}
          <div className="absolute inset-0 bg-[#07080d]/25 transition-colors duration-1000" />
        </div>
      )}



      <style jsx global>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      <Sidebar />
      <main className="relative z-10 w-full bleed-header">

        {/* ─── HERO BANNER ─── */}
        {hero && heroArtworkReady ? (
          <div
            className="relative group/hero select-none animate-in fade-in duration-500"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Top-Left Fixed Live Announcement */}
            <HeroAnnouncement />

            <HeroBanner key={`${hero.id}-${(hero as any).anilistId || ''}-${heroIndex}`} item={hero} />
            {/* Hero dot / progress pill timer indicators */}
            {!spotlightBanner && heroPool.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                {heroPool.map((_, i) => {
                  const isActive = i === heroIndex;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToHero(i)}
                      className={`transition-all duration-300 rounded-full cursor-pointer relative overflow-hidden flex items-center ${
                        isActive
                          ? "w-11 h-2.5 bg-white/20 shadow-lg ring-1 ring-white/30"
                          : "w-2 h-2 bg-white/30 hover:bg-white/60"
                      }`}
                      aria-label={`Go to slide ${i + 1}`}
                    >
                      {isActive && (
                        <span
                          key={`timer-${heroIndex}-${timerReset}`}
                          className="absolute inset-y-0 left-0 bg-white rounded-full"
                          style={{
                            animation: "heroProgress 10s linear forwards",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Hero Left/Right navigation buttons — ONLY show in normal auto-rotation mode */}
            {!spotlightBanner && heroPool.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => navigateHero(-1)}
                  className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-30 w-10 lg:w-12 h-10 lg:h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 items-center justify-center text-white transition-all active:scale-90 group focus:outline-none backdrop-blur-md shadow-lg duration-300 opacity-70 lg:opacity-0 lg:group-hover/hero:opacity-100"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-5 lg:w-6 h-5 lg:h-6 group-hover:-translate-x-0.5 transition-transform text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateHero(1)}
                  className="hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-30 w-10 lg:w-12 h-10 lg:h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 items-center justify-center text-white transition-all active:scale-90 group focus:outline-none backdrop-blur-md shadow-lg duration-300 opacity-70 lg:opacity-0 lg:group-hover/hero:opacity-100"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-5 lg:w-6 h-5 lg:h-6 group-hover:translate-x-0.5 transition-transform text-white" />
                </button>
              </>
            )}
          </div>
        ) : (
          !loadError && (
            <HeroSkeleton />
          )
        )}

        {loadError && (
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 pt-6">
            <div className="rounded-2xl border border-[#7288AE]/20 bg-[#4B5694]/10 p-4 text-sm text-[#7288AE]">
              {loadError}
            </div>
          </div>
        )}

        {/* ─── CONTINUE WATCHING ─── */}
        <ContinueWatching />

        <div className="w-full px-3 md:px-6 lg:px-8 xl:px-10 py-6 space-y-7">

          {/* ─── TOP 10 MOVIES TODAY ─── */}
          <LazySection show={revealedSections >= 1} placeholderHeight={380}>
            <MediaRow
              title="Top 10 Movies Today"
              items={trendingMoviesToday}
              isLoading={isLoading}
              isTop10={true}
              accentIcon={<TrendingUp className="w-5 h-5 text-red-500" />}
            />
          </LazySection>

          {/* ─── TOP 10 SHOWS TODAY ─── */}
          <LazySection show={revealedSections >= 1} placeholderHeight={380}>
            <MediaRow
              title="Top 10 Shows Today"
              items={trendingTvToday}
              isLoading={isLoading}
              isTop10={true}
              accentIcon={<TrendingUp className="w-5 h-5 text-red-500" />}
            />
          </LazySection>

          {/* ─── TOP 10 ANIME TODAY ─── */}
          <LazySection show={revealedSections >= 1} placeholderHeight={380}>
            <AnimeRow
              title="Top 10 Anime Today"
              items={animeList}
              isLoading={animeLoading}
              isTop10={true}
              seeAllHref="/anime"
            />
          </LazySection>



          {/* ─── 2. TOP RATED MOVIES ─── */}
          <LazySection show={revealedSections >= 2} placeholderHeight={360}>
            <MediaRow
              title="Top Rated Movies"
              items={topRatedMovies}
              isLoading={isLoading}
              largeTitle={true}
              seeAllHref="/browse/movies/top-rated"
              accentIcon={<Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
            />
          </LazySection>

          {/* ─── 3. TOP RATED TV ─── */}
          <LazySection show={revealedSections >= 3} placeholderHeight={360}>
            <MediaRow
              title="Top Rated TV"
              items={topRatedTv}
              isLoading={isLoading}
              largeTitle={true}
              seeAllHref="/browse/tv/top-rated"
              accentIcon={<Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
            />
          </LazySection>

          {/* ─── STREAMING SERVICES HUB ─── */}
          <LazySection show={revealedSections >= 4} placeholderHeight={380}>
            <TrendingProvidersHub />
          </LazySection>

          {/* ─── THEMATIC UNIVERSE ─── */}
          <LazySection show={revealedSections >= 5} placeholderHeight={220}>
            <SectionHeading title="Browse by Mood" subtitle="Pick your vibe" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-10 gap-2.5 md:gap-3">
              {[
                { id: 'k-dramas',        name: 'K-Dramas',       color: '#C4006E', icon: '🌸', iconBg: '#E91E8C' },
                { id: 'superhero',       name: 'Superheroes',    color: '#1565C0', icon: '⚡', iconBg: '#2979FF' },
                { id: 'action-packed',   name: 'Adrenaline',     color: '#B74300', icon: '💥', iconBg: '#F4511E' },
                { id: 'horror-thriller', name: 'Horror',         color: '#6A0000', icon: '👁️', iconBg: '#B71C1C' },
                { id: 'sci-fi-fantasy',  name: 'Sci-Fi',         color: '#00607A', icon: '🛸', iconBg: '#0097A7' },
                { id: 'rom-com',         name: 'Romance',        color: '#880037', icon: '💋', iconBg: '#E91E63' },
                { id: 'fantasy-magic',   name: 'Fantasy',        color: '#1B5E20', icon: '🧙', iconBg: '#2E7D32' },
                { id: 'feel-good-comedy',name: 'Comedy',         color: '#E65100', icon: '😂', iconBg: '#FF9800' },
                { id: 'true-crime',      name: 'True Crime',     color: '#1A237E', icon: '🔪', iconBg: '#283593' },
                { id: 'documentary',     name: 'Documentary',    color: '#4E342E', icon: '🎥', iconBg: '#6D4C41' },
              ].map((g) => (
                <Link
                  key={g.id}
                  href={`/browse/theme/${g.id}?shuffle=1${moodSeed ? `&seed=${encodeURIComponent(moodSeed)}` : ""}`}
                  className="group relative overflow-hidden rounded-xl flex flex-col justify-between p-3.5 h-[92px] transition-all duration-300 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] ring-1 ring-white/[0.06] shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                  style={{ backgroundColor: g.color }}
                >
                  {/* Title */}
                  <span className="text-white font-black text-base leading-tight tracking-tight drop-shadow-sm z-10 relative">
                    {g.name}
                  </span>

                  {/* Rotated poster-card element — Spotify style */}
                  <div
                    className="absolute bottom-[-8px] right-[-8px] w-[62px] h-[62px] rounded-lg shadow-2xl flex items-center justify-center text-3xl rotate-[20deg] transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundColor: g.iconBg, boxShadow: `0 8px 24px rgba(0,0,0,0.5)` }}
                  >
                    {g.icon}
                  </div>
                </Link>
              ))}
            </div>
          </LazySection>

          {/* ─── EPIC FRANCHISES ─── */}
          {collections.length > 0 && (
            <LazySection show={revealedSections >= 6} placeholderHeight={300}>
              <SectionHeading
                title="Epic Franchises"
                subtitle="Binge your favorite universes in order"
                href="/browse/franchises"
              />
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9 3xl:grid-cols-10 gap-2 sm:gap-2.5">
                {collections.slice(0, 20).map((col, idx) => {
                  const posterUrl = col.poster_path
                    ? col.poster_path.startsWith("http")
                      ? col.poster_path
                      : `https://image.tmdb.org/t/p/w780${col.poster_path}`
                    : null;

                  const visibilityClass =
                    idx < 8
                      ? "block"
                      : idx < 10
                      ? "hidden sm:block"
                      : idx < 12
                      ? "hidden md:block"
                      : idx < 14
                      ? "hidden lg:block"
                      : idx < 16
                      ? "hidden xl:block"
                      : idx < 18
                      ? "hidden 2xl:block"
                      : "hidden 3xl:block";

                  return (
                    <Link
                      key={col.id}
                      href={`/browse/franchise/${col.id}`}
                      prefetch={false}
                      className={`${visibilityClass} group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#4B5694]/5 aspect-[2/3] hover:border-white/40 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 focus:outline-none`}
                    >
                      {posterUrl ? (
                        <>
                          <img
                            src={posterUrl}
                            alt={col.name}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-muted">
                          <span className="text-center font-bold text-white text-xs">{col.name}</span>
                        </div>
                      )}

                      {posterUrl && (
                        <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 translate-y-1 group-hover:translate-y-0 transition-transform">
                          <h4 className="text-white font-bold text-xs sm:text-[13px] tracking-tight line-clamp-2 drop-shadow-md leading-tight mb-0.5">
                            {col.name}
                          </h4>
                          <span className="text-[9px] uppercase tracking-wider text-white/50 font-black drop-shadow-md">
                            Collection
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
                                {collections.length > 0 && (
                <div className="mt-8 flex justify-center">
                  <Link
                    href="/browse/franchises"
                    className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-[#262E36] hover:bg-white/15 backdrop-blur-xl border border-white/20 text-[#D3D1CE] hover:text-white text-sm font-extrabold tracking-wide shadow-xl shadow-black/50 hover:shadow-black/70 hover:border-white/35 hover:scale-[1.03] active:scale-95 transition-all duration-300 overflow-hidden sheen-wrapper cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#D3D1CE] transition-transform duration-300" />
                    <span>View More Franchises</span>
                    <ChevronRight className="w-4 h-4 text-[#D3D1CE] group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </div>
              )}
            </LazySection>
          )}

          {/* ─── DYNAMIC CUSTOM HOMEPAGE SECTIONS (Admin Controlled) ─── */}
          {customSections.map((sec, secIdx) => {
            let IconComponent = Film;
            if (sec.icon === "Sparkles") IconComponent = Sparkles;
            else if (sec.icon === "Flame") IconComponent = Flame;
            else if (sec.icon === "Tv") IconComponent = Tv;
            else if (sec.icon === "Star") IconComponent = Star;
            else if (sec.icon === "Heart") IconComponent = Heart;
            else if (sec.icon === "Trophy") IconComponent = Trophy;
            else if (sec.icon === "Bookmark") IconComponent = Bookmark;
            else if (sec.icon === "Play") IconComponent = Play;
            else if (sec.icon === "Clapperboard") IconComponent = Clapperboard;
            else if (sec.icon === "Compass") IconComponent = Compass;
            else if (sec.icon === "Zap") IconComponent = Zap;
            else if (sec.icon === "Award") IconComponent = Award;

            return (
              <LazySection key={sec.id || secIdx} show={true} placeholderHeight={360}>
                <MediaRow
                  title={sec.title}
                  items={sec.items || []}
                  isLoading={false}
                  accentIcon={<IconComponent className="w-4 h-4 text-primary" />}
                />
              </LazySection>
            );
          })}

          {/* ─── FOOTER TAG ─── */}
          <footer className="border-t border-white/10 pt-10 pb-8 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo-icon.svg" alt="CineStream" className="w-7 h-7 opacity-90" />
              <span className="text-base font-black tracking-widest text-[#D3D1CE]">
                CINE<span className="text-[#B3B7BA]">STREAM</span>
              </span>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <p className="text-xs sm:text-sm text-white/70 font-semibold tracking-wide">
                Movies. TV. Anime. All in one place.
              </p>
              <p className="text-[10px] sm:text-xs text-white/40 max-w-md px-4 font-medium leading-relaxed">
                CineStream does not host any media, it only provides media from open sources!
              </p>
            </div>
          </footer>

        </div>
      </main>
    </div>
  );
}
