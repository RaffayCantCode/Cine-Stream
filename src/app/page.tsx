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
import { HeroAnnouncement } from "@/components/HeroAnnouncement";
import { MediaRow } from "@/components/MediaRow";
import { AnimeRow } from "@/components/AnimeRow";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ContinueWatching } from "@/components/ContinueWatching";
import { Sidebar } from "@/components/Sidebar";
import { TrendingProvidersHub } from "@/components/TrendingProvidersHub";
import { FRANCHISES } from "@/lib/franchises";
import { usePageContentReady } from "@/lib/pageLoad";

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

const SESSION_HERO_POOL_KEY = "sv_home_hero_pool_v2";
function saveHeroPoolToSession(pool: MediaItem[]): void {
  if (typeof window === "undefined" || pool.length === 0) return;
  try { sessionStorage.setItem(SESSION_HERO_POOL_KEY, JSON.stringify(pool)); } catch {}
}
function loadHeroPoolFromSession(): MediaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_HERO_POOL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

function buildHeroPool(feed: MediaItem[], animeList?: AnimeItem[]): MediaItem[] {
  if (!Array.isArray(feed) || feed.length === 0) return [];

  const isValidHeroCandidate = (i: MediaItem) => {
    if (!i || !i.id) return false;
    if ((i as any).adult) return false; // Exclude adult content
    if (!i.backdrop_path || !i.poster_path) return false;
    if (!i.overview || i.overview.trim().length < 10) return false;
    if (EXCLUDED_LANGS.has(i.original_language || "")) return false;
    return true;
  };

  const validFeed = feed.filter(isValidHeroCandidate);
  if (validFeed.length === 0) return [];

  const movieCandidates = validFeed.filter(
    (i) => (i.media_type === "movie" || !!i.title) && !isTmdbAnime(i) && !(i.genre_ids?.includes(16) && i.original_language === "ja")
  );
  const tvCandidates = validFeed.filter(
    (i) => (i.media_type === "tv" || !!i.name) && !isTmdbAnime(i) && !(i.genre_ids?.includes(16) && i.original_language === "ja")
  );

  // Build anime candidates strictly from AniList anime items first, fallback to TMDB
  let animeCandidates: MediaItem[] = [];

  if (Array.isArray(animeList) && animeList.length > 0) {
    const buildAnimeCard = (a: AnimeItem) => ({
      id: a.id as any,
      anilistId: a.id,
      title: a.name,
      name: a.name,
      poster_path: a.poster || a.bannerImage || "",
      backdrop_path: a.bannerImage || a.poster,
      media_type: "anime",
      vote_average: a.rating ? parseFloat(a.rating) : 8.5,
      vote_count: 500,
      overview: a.description || "",
      release_date: a.seasonYear ? `${a.seasonYear}-01-01` : "",
      original_language: "ja",
      genre_ids: [16],
      isTmdbAnime: false,
    });

    const validAnime = animeList.filter(
      (a) => a && a.id && a.name && a.description && a.description.trim().length >= 10 && (
        (typeof a.poster === "string" && a.poster.startsWith("http")) ||
        (typeof a.bannerImage === "string" && a.bannerImage.startsWith("http"))
      )
    );

    const bannerAnime = validAnime.filter((a) => typeof a.bannerImage === "string" && a.bannerImage.startsWith("http"));
    const heroQualityAnime = (bannerAnime.length > 0 ? bannerAnime : validAnime)
      .filter((a) => (a.name || "").length < 65);

    const aniListCards = (heroQualityAnime.length > 0 ? heroQualityAnime : validAnime).map(buildAnimeCard);
    animeCandidates.push(...aniListCards);
  }

  // Fallback: If no AniList items are loaded yet, use high-quality TMDB anime items
  if (animeCandidates.length === 0) {
    const tmdbAnimeFeed = validFeed
      .filter((i) => isTmdbAnime(i) || (i.genre_ids?.includes(16) && i.original_language === "ja"))
      .map((i) => ({ ...i, media_type: "anime" as const, isTmdbAnime: true }));
    animeCandidates.push(...tmdbAnimeFeed);
  }

  // Deduplicate anime candidates by normalized title so we don't repeat titles
  const uniqueAnimeMap = new Map<string, MediaItem>();
  for (const candidate of animeCandidates) {
    const normTitle = (candidate.name || candidate.title || "").toLowerCase().trim();
    if (normTitle && !uniqueAnimeMap.has(normTitle)) {
      uniqueAnimeMap.set(normTitle, candidate);
    }
  }
  animeCandidates = Array.from(uniqueAnimeMap.values());

  const seenIds = new Set<number | string>();
  try {
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("sv_seen_hero_ids");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: number | string) => seenIds.add(id));
        }
      }
    }
  } catch {}

  const pickBestCandidate = (candidates: MediaItem[]): MediaItem | null => {
    if (candidates.length === 0) return null;

    const unseen = candidates.filter((c) => !seenIds.has(c.id));
    const pool = unseen.length > 0 ? unseen : candidates;

    const picked = pool[Math.floor(Math.random() * pool.length)];
    if (picked) {
      seenIds.add(picked.id);
    }
    return picked || null;
  };

  const movieCard = pickBestCandidate(movieCandidates);
  const tvCard = pickBestCandidate(tvCandidates);
  const animeCard = pickBestCandidate(animeCandidates);

  try {
    if (typeof window !== "undefined") {
      const arr = Array.from(seenIds).slice(-50);
      sessionStorage.setItem("sv_seen_hero_ids", JSON.stringify(arr));
    }
  } catch {}

  const heroPool = [movieCard, tvCard, animeCard].filter(Boolean) as MediaItem[];

  if (heroPool.length < 3) {
    const heroIds = new Set(heroPool.map((h) => h.id));
    for (const item of validFeed) {
      if (!heroIds.has(item.id)) {
        heroPool.push(item);
        heroIds.add(item.id);
        if (heroPool.length >= 3) break;
      }
    }
  }

  return heroPool;
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function Home() {
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
    if (globalHomeCache?.heroPool && globalHomeCache.heroPool.length > 0) {
      return globalHomeCache.heroPool;
    }
    return loadHeroPoolFromSession();
  });
  const [recommended, setRecommended] = useState<MediaItem[]>(() => globalHomeCache?.recommended || []);
  const [genres, setGenres] = useState<Genre[]>(() => globalHomeCache?.genres || []);
  const [isLoading, setIsLoading] = useState(() => {
    if (globalHomeCache && globalHomeCache.heroPool && globalHomeCache.heroPool.length > 0) {
      return false;
    }
    const saved = loadHeroPoolFromSession();
    return saved.length > 0 ? false : true;
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [animeList, setAnimeList] = useState<AnimeItem[]>(() => globalHomeCache?.animeList || []);
  const [collections, setCollections] = useState<any[]>(() =>
    (globalHomeCache?.collections && globalHomeCache.collections.length > 0)
      ? globalHomeCache.collections
      : INITIAL_COLLECTIONS
  );
  const [animeLoading, setAnimeLoading] = useState(() => !globalHomeCache);
  const [revealedSections] = useState(8);
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
    const ADMIN_CACHE_TTL = 5 * 60_000; // 5 minutes

    // Fetch admin-curated custom homepage sections — only if cache is stale
    if (globalCustomSectionsCache === null || Date.now() - globalCustomSectionsCachedAt > ADMIN_CACHE_TTL) {
      fetch("/api/home-sections")
        .then((res) => (res.ok ? res.json() : null))
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
      fetch("/api/spotlight")
        .then((res) => (res.ok ? res.json() : null))
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
      return;
    }

    // Try sessionStorage fallback — covers the case where module-level
    // cache was reset (hard back-nav, full page reload, etc.)
    if (heroPool.length === 0) {
      const saved = loadHeroPoolFromSession();
      if (saved.length > 0) {
        setHeroPool(saved);
        setIsLoading(false);
        setAnimeLoading(false);
      }
    }

    // Safety timeout: never let the loading skeleton show indefinitely
    const loadingTimeout = setTimeout(() => {
      if (cancelled) return;
      setIsLoading(false);
      setAnimeLoading(false);
      setHeroPool((current) => {
        if (current.length > 0) return current;
        const saved = loadHeroPoolFromSession();
        return saved.length > 0 ? saved : current;
      });
    }, 5000);

    const load = async () => {
      if (heroPool.length === 0) {
        setIsLoading(true);
      }
      setLoadError(null);

      try {
        // Single consolidated home endpoint — returns identical data to home-hero
        // plus genre list. Eliminates the duplicate 15-TMDB-call home-hero fetch.
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

        // Await all data together — home endpoint is fast (CDN-cached after first hit)
        const [homeData, animeResponse, collectionsData] = await Promise.all([homePromise, animePromise, collectionsPromise]);
        if (cancelled) return;

        if (homeData) {
          const trendingSafe = filterReleasedSafeContent(homeData.trending?.results || [])
            .filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const popularSafe = filterReleasedSafeContent(homeData.popularMovies?.results || []).map(
            (i) => ({ ...i, media_type: "movie" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const heroTopSafe = filterReleasedSafeContent(homeData.topRatedTv?.results || []).map(
            (i) => ({ ...i, media_type: "tv" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const heroRecentSafe = filterReleasedSafeContent(homeData.nowPlaying?.results || []).map(
            (i) => ({ ...i, media_type: "movie" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));

          const topRatedMovieSafe = filterReleasedSafeContent(homeData.topRatedMovies?.results || []).map(
            (i) => ({ ...i, media_type: "movie" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const popularTvSafe = filterReleasedSafeContent(homeData.popularTv?.results || []).map(
            (i) => ({ ...i, media_type: "tv" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const onTheAirSafe = filterReleasedSafeContent(homeData.onTheAir?.results || []).map(
            (i) => ({ ...i, media_type: "tv" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const animeMovieSafe = filterReleasedSafeContent(homeData.animeMovies?.results || []).map(
            (i) => ({ ...i, media_type: "movie" as const, genre_ids: i.genre_ids || [16], original_language: "ja" })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const animeTvSafe = filterReleasedSafeContent(homeData.animeTv?.results || []).map(
            (i) => ({ ...i, media_type: "tv" as const, genre_ids: i.genre_ids || [16], original_language: "ja" })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const trendingMoviesTodaySafe = filterReleasedSafeContent(homeData.trendingMoviesToday?.results || []).map(
            (i) => ({ ...i, media_type: "movie" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
          const trendingTvTodaySafe = filterReleasedSafeContent(homeData.trendingTvToday?.results || []).map(
            (i) => ({ ...i, media_type: "tv" as const })
          ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || "") && i.original_language !== "ja");

          const initialAnimeItems: AnimeItem[] = [...animeTvSafe, ...animeMovieSafe].slice(0, 10).map((item) => ({
            id: String(item.id),
            name: item.name || item.title || "Anime",
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : "",
            type: item.media_type === "movie" ? "MOVIE" : "TV",
            rating: item.vote_average ? String(item.vote_average.toFixed(1)) : null,
            description: item.overview || "",
            genres: ["Animation", "Anime"],
            episodes: { sub: null, dub: null },
          }));

          const finalAnimeList = ((animeResponse as any)?.trending && (animeResponse as any).trending.length > 0)
            ? (animeResponse as any).trending.slice(0, 10)
            : (animeResponse?.items && animeResponse.items.length > 0)
              ? animeResponse.items.slice(0, 10)
              : initialAnimeItems;

          const validCollections = (collectionsData?.collections && collectionsData.collections.length > 0)
            ? collectionsData.collections
            : INITIAL_COLLECTIONS;

          // Build recommended pool excluding anime — Recommended For You is a
          // Movies + TV row and should not surface anime titles.
          const recPool = filterExcludeAnime([...popularSafe, ...heroTopSafe, ...trendingSafe, ...heroRecentSafe]);
          const daySalt = Math.floor(Date.now() / 86400000).toString();

          setTrending(trendingSafe);
          setPopular(sessionShuffle(popularSafe, "popular"));
          setTopRated(sessionShuffle(heroTopSafe, "toprated"));
          setTopRatedMovies(topRatedMovieSafe.slice(0, 10));
          setTopRatedTv(heroTopSafe.slice(0, 10));
          setRecent(heroRecentSafe);
          setTrendingMoviesToday(trendingMoviesTodaySafe);
          setTrendingTvToday(trendingTvTodaySafe);
          setAnimeList(finalAnimeList);
          setCollections(validCollections);
          setRecommended(sessionShuffle(recPool, `recommended-${daySalt}`));
          setGenres((homeData.genres?.genres || []).slice(0, 18));
          setHeroTrendingFeed([...trendingSafe, ...trendingMoviesTodaySafe, ...trendingTvTodaySafe]);
          setHeroPopularFeed([...popularSafe, ...popularTvSafe, ...heroRecentSafe]);
          setHeroTopRatedFeed([...heroTopSafe, ...topRatedMovieSafe]);

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

          setHeroFeed(fullHeroFeed);

          const fullHeroPool = buildHeroPool(fullHeroFeed, finalAnimeList);
          if (fullHeroPool.length > 0) {
            setHeroPool((current) => (current && current.length >= 3 ? current : fullHeroPool));
            saveHeroPoolToSession(fullHeroPool);

            // Preload hero slide 1 backdrop image immediately
            if (typeof document !== "undefined" && fullHeroPool[0]?.backdrop_path) {
              const bg = fullHeroPool[0].backdrop_path;
              const link = document.createElement("link");
              link.rel = "preload";
              link.as = "image";
              link.href = bg.startsWith("http") ? bg : `https://image.tmdb.org/t/p/w1280${bg}`;
              link.fetchPriority = "high";
              document.head.appendChild(link);
            }
          }

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
            heroPool: fullHeroPool,
            recommended: recPool,
            genres: (homeData.genres?.genres || []).slice(0, 18),
            animeList: finalAnimeList,
            collections: validCollections,
            spotlightBanner: globalSpotlightCache?.spotlight ?? spotlightBanner ?? null,
            customSections: globalCustomSectionsCache ?? (customSections.length > 0 ? customSections : undefined),
          };
        }
        setAnimeLoading(false);
        setIsLoading(false);
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

  // ── Preload all hero backdrop images for instant transitions ────────────
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    heroPool.forEach((item) => {
      const path = item.backdrop_path || item.poster_path;
      if (!path) return;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w1280${path}`;
      link.fetchPriority = "high";
      document.head.appendChild(link);
      links.push(link);
    });
    return () => links.forEach(l => l.remove());
  }, [heroPool]);

  // ── Auto-rotation timer (resets on manual nav) ─────────────────────────
  useEffect(() => {
    if (heroPool.length <= 1) return;
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroPoolLengthRef.current);
    }, 9000);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroPool, timerReset]);

  return (
    <div className="relative min-h-screen bg-background text-foreground pb-20 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_72%)] pointer-events-none" />
      <div className="absolute inset-x-0 top-[42rem] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

      <Sidebar />
      <main className="relative z-10 md:pl-56 lg:pl-64 bleed-header">

        {/* ─── INFO LINK ─── */}
        <Link
          href="/landing"
          className="fixed z-50 w-9 h-9 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all md:top-4 md:right-4 max-md:top-1/2 max-md:right-3 max-md:-translate-y-1/2"
          title="About this site"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
        </Link>

        {/* ─── HERO BANNER ─── */}
        {hero ? (
          <div
            className="relative group/hero select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Top-Left Fixed Live Announcement */}
            <HeroAnnouncement />

            <HeroBanner key={hero?.id || "empty"} item={hero} />
            {/* Hero dot indicators — ONLY show in normal auto-rotation mode (not when Spotlight Hero is active) */}
            {!spotlightBanner && heroPool.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                {heroPool.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToHero(i)}
                    className={`transition-all duration-300 rounded-full ${i === heroIndex
                      ? "w-6 h-1.5 bg-white shadow-md"
                      : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
                      }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
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
          (!loadError && isLoading) && (
            <div className="relative w-full h-[85svh] min-h-[500px] max-h-[750px] sm:h-[60vw] sm:max-h-[640px] md:h-[75vh] flex items-end overflow-hidden bg-background">
              <div className="absolute inset-0 skeleton-pulse" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
              <div className="relative z-10 w-full px-5 md:px-16 lg:px-20 xl:px-24 pb-12 sm:pb-12 md:pb-14 max-w-screen-2xl mx-auto">
                <div className="max-w-full sm:max-w-lg md:max-w-2xl">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="h-5 w-20 rounded-md skeleton-pulse" />
                    <div className="h-5 w-16 rounded-md skeleton-pulse" />
                    <div className="h-5 w-14 rounded-md skeleton-pulse" />
                  </div>
                  <div className="h-10 sm:h-12 md:h-14 w-3/4 rounded-lg skeleton-pulse mb-3" />
                  <div className="h-4 w-full rounded skeleton-pulse mb-1.5" />
                  <div className="h-4 w-2/3 rounded skeleton-pulse mb-5 sm:mb-6" />
                  <div className="flex gap-2.5 sm:gap-4">
                    <div className="h-12 sm:h-14 w-32 sm:w-36 rounded-xl skeleton-pulse" />
                    <div className="h-12 sm:h-14 w-32 sm:w-36 rounded-xl skeleton-pulse" />
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {loadError && (
          <div className="px-5 md:px-10 lg:px-12 max-w-screen-2xl mx-auto pt-6">
            <div className="rounded-2xl border border-[#7288AE]/20 bg-[#4B5694]/10 p-4 text-sm text-[#7288AE]">
              {loadError}
            </div>
          </div>
        )}

        {/* ─── Bottom-edge dissolve (sits right below hero, bleeds upward) ─── */}
        <div
          className="relative pointer-events-none z-20"
          style={{ marginTop: "-8rem", height: "8rem", background: "linear-gradient(to bottom, transparent, var(--background))" }}
        />

        {/* ─── CONTINUE WATCHING ─── */}
        <ContinueWatching />

        <div className="px-3 md:px-8 lg:px-10 max-w-screen-2xl mx-auto py-6 space-y-7">

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
              seeAllHref="/browse/movies/top-rated"
              accentIcon={<Star className="w-4 h-4 text-amber-400" />}
            />
          </LazySection>

          {/* ─── 3. TOP RATED TV ─── */}
          <LazySection show={revealedSections >= 3} placeholderHeight={360}>
            <MediaRow
              title="Top Rated TV"
              items={topRatedTv}
              isLoading={isLoading}
              seeAllHref="/browse/tv/top-rated"
              accentIcon={<Star className="w-4 h-4 text-amber-400" />}
            />
          </LazySection>

          {/* ─── STREAMING SERVICES HUB ─── */}
          <LazySection show={revealedSections >= 4} placeholderHeight={380}>
            <TrendingProvidersHub />
          </LazySection>

          {/* ─── THEMATIC UNIVERSE ─── */}
          <LazySection show={revealedSections >= 5} placeholderHeight={220}>
            <SectionHeading title="Browse by Mood" subtitle="Pick your vibe" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 md:gap-3">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-6 gap-4 md:gap-5">
                {collections.slice(0, 12).map((col, idx) => {
                  const posterUrl = col.poster_path
                    ? col.poster_path.startsWith("http")
                      ? col.poster_path
                      : `https://image.tmdb.org/t/p/w342${col.poster_path}`
                    : null;

                  const visibilityClass =
                    idx < 4
                      ? "block"
                      : idx < 6
                      ? "hidden sm:block"
                      : idx < 8
                      ? "hidden md:block"
                      : idx < 10
                      ? "hidden lg:block"
                      : "hidden 3xl:block";

                  return (
                    <Link
                      key={col.id}
                      href={`/browse/franchise/${col.id}`}
                      className={`${visibilityClass} group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#4B5694]/5 aspect-[2/3] hover:border-[#7288AE]/45 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/25 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                    >
                      {posterUrl ? (
                        <>
                          <img
                            src={posterUrl}
                            alt={col.name}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-muted">
                          <span className="text-center font-bold text-white text-sm">{col.name}</span>
                        </div>
                      )}

                      {posterUrl && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform">
                          <h4 className="text-white font-bold text-sm tracking-wide line-clamp-2 drop-shadow-md">
                            {col.name}
                          </h4>
                          <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold drop-shadow-md">
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
