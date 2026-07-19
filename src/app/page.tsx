"use client";
export const runtime = 'edge';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Flame, Star, TrendingUp, Clock, Sparkles } from "lucide-react";
import { fetchJson, filterReleasedSafeContent, isTmdbAnime } from "@/lib/utils";
import { PROVIDERS } from "@/lib/providers";
import type { AnimeItem } from "@/components/AnimeCard";
import { fetchClientAnime } from "@/lib/anilist-client";

const HeroBanner = dynamic(() => import("@/components/HeroBanner").then((m) => m.HeroBanner), { ssr: false });
const MediaRow = dynamic(() => import("@/components/MediaRow").then((m) => m.MediaRow), { ssr: false });
const AnimeRow = dynamic(() => import("@/components/AnimeRow").then((m) => m.AnimeRow), { ssr: false });
const ProviderIcon = dynamic(() => import("@/components/ProviderIcon").then((m) => m.ProviderIcon), { ssr: false });
const ContinueWatching = dynamic(
  () => import("@/components/ContinueWatching").then((m) => m.ContinueWatching),
  { ssr: false }
);
import { Sidebar } from "@/components/Sidebar";
import { TrendingProvidersHub } from "@/components/TrendingProvidersHub";

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
  recent: MediaItem[];
  trendingMoviesToday: MediaItem[];
  trendingTvToday: MediaItem[];
  heroTrendingFeed: MediaItem[];
  heroPopularFeed: MediaItem[];
  heroTopRatedFeed: MediaItem[];
  heroFeed: MediaItem[];
  recommended: MediaItem[];
  genres: Genre[];
  animeList: AnimeItem[];
  collections: any[];
} | null = null;

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
    <section className="animate-fade-in-up opacity-0" style={{ animationFillMode: "forwards" }}>
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
  const [recent, setRecent] = useState<MediaItem[]>(() => globalHomeCache?.recent || []);
  const [trendingMoviesToday, setTrendingMoviesToday] = useState<MediaItem[]>(() => globalHomeCache?.trendingMoviesToday || []);
  const [trendingTvToday, setTrendingTvToday] = useState<MediaItem[]>(() => globalHomeCache?.trendingTvToday || []);
  const [heroTrendingFeed, setHeroTrendingFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroTrendingFeed || []);
  const [heroPopularFeed, setHeroPopularFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroPopularFeed || []);
  const [heroTopRatedFeed, setHeroTopRatedFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroTopRatedFeed || []);
  const [heroFeed, setHeroFeed] = useState<MediaItem[]>(() => globalHomeCache?.heroFeed || []);
  const [recommended, setRecommended] = useState<MediaItem[]>(() => globalHomeCache?.recommended || []);
  const [genres, setGenres] = useState<Genre[]>(() => globalHomeCache?.genres || []);
  const [isLoading, setIsLoading] = useState(() => !globalHomeCache);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [animeList, setAnimeList] = useState<AnimeItem[]>(() => globalHomeCache?.animeList || []);
  const [collections, setCollections] = useState<any[]>(() => globalHomeCache?.collections || []);
  const [animeLoading, setAnimeLoading] = useState(() => !globalHomeCache);
  const [revealedSections, setRevealedSections] = useState(() => globalHomeCache ? 8 : 0);
  const [moodSeed, setMoodSeed] = useState("");
  useEffect(() => {
    if (isLoading) return;
    if (revealedSections >= 8) return;
    const t = setTimeout(() => setRevealedSections((r) => Math.min(r + 1, 8)), revealedSections === 0 ? 0 : 200);
    return () => clearTimeout(t);
  }, [isLoading, revealedSections]);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerReset, setTimerReset] = useState(0);
  const heroPoolLengthRef = useRef(0);

  useEffect(() => {
    setMoodSeed(`${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`);
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

  const heroPreloadLinksRef = useRef<HTMLLinkElement[]>([]);

  useEffect(() => {
    if (globalHomeCache) return; // Use in-memory globalHomeCache on back navigation

    let cancelled = false;
    heroPreloadLinksRef.current.forEach(link => link.remove());
    heroPreloadLinksRef.current = [];

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        // 1) Fire hero + anime + full rows in PARALLEL
        const heroPromise = fetchJson<{
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
        }>("/api/tmdb/home-hero", { cacheTtlMs: 180000 });

        const rowsPromise = fetchJson<{
          trending: { results: MediaItem[] };
          popular: { results: MediaItem[] };
          topRated: { results: MediaItem[] };
          nowPlaying: { results: MediaItem[] };
          genres: { genres: Genre[] };
        }>("/api/tmdb/home", { cacheTtlMs: 180000 });

        const animePromise = fetchClientAnime("trending", 1).catch(() => null);

        const collectionsPromise = fetchJson<{ collections: any[] }>("/api/tmdb/collections", { cacheTtlMs: 3600000 }).catch(() => ({ collections: [] }));

        // ── Hero data arrives FAST (only 2 TMDB calls) ─────────────────
        const heroData = await heroPromise;
        if (cancelled) return;

        const trendingSafe = filterReleasedSafeContent(heroData.trending?.results || [])
          .filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const popularSafe = filterReleasedSafeContent(heroData.popularMovies?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const heroTopSafe = filterReleasedSafeContent(heroData.topRatedTv?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const heroRecentSafe = filterReleasedSafeContent(heroData.nowPlaying?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));

        const topRatedMovieSafe = filterReleasedSafeContent(heroData.topRatedMovies?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const popularTvSafe = filterReleasedSafeContent(heroData.popularTv?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const onTheAirSafe = filterReleasedSafeContent(heroData.onTheAir?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const animeMovieSafe = filterReleasedSafeContent(heroData.animeMovies?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const, genre_ids: i.genre_ids || [16], original_language: "ja" })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const animeTvSafe = filterReleasedSafeContent(heroData.animeTv?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const, genre_ids: i.genre_ids || [16], original_language: "ja" })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const trendingMoviesTodaySafe = filterReleasedSafeContent(heroData.trendingMoviesToday?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const trendingTvTodaySafe = filterReleasedSafeContent(heroData.trendingTvToday?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || "") && i.original_language !== "ja");

        const initialAnimeItems: AnimeItem[] = [...animeTvSafe, ...animeMovieSafe].slice(0, 10).map((item) => ({
          id: String(item.id),
          name: item.name || item.title || "Anime",
          poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
          type: item.media_type === "movie" ? "MOVIE" : "TV",
          rating: item.vote_average ? String(item.vote_average.toFixed(1)) : null,
          description: item.overview || "",
          genres: ["Animation", "Anime"],
          episodes: { sub: null, dub: null },
        }));

        setTrending(trendingSafe);
        setPopular(sessionShuffle(popularSafe, "popular"));
        setTopRated(sessionShuffle(heroTopSafe, "toprated"));
        setRecent(heroRecentSafe);
        setTrendingMoviesToday(trendingMoviesTodaySafe);
        setTrendingTvToday(trendingTvTodaySafe);
        setAnimeList(initialAnimeItems);
        setAnimeLoading(false);

        setHeroTrendingFeed([...trendingSafe, ...trendingMoviesTodaySafe, ...trendingTvTodaySafe]);
        setHeroPopularFeed([...popularSafe, ...popularTvSafe, ...heroRecentSafe]);
        setHeroTopRatedFeed([...heroTopSafe, ...topRatedMovieSafe]);

        setHeroFeed([
          ...trendingSafe,
          ...popularSafe,
          ...heroTopSafe,
          ...heroRecentSafe,
          ...topRatedMovieSafe,
          ...popularTvSafe,
          ...onTheAirSafe,
          ...animeMovieSafe,
          ...animeTvSafe,
        ]);
        setIsLoading(false);

        // ── Full rows data arrives (more TMDB pages) ────────────────────
        const [rowsData, animeResponse, collectionsData] = await Promise.all([rowsPromise, animePromise, collectionsPromise]);
        if (cancelled) return;

        const fullTrending = filterReleasedSafeContent(rowsData.trending?.results || [])
          .filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const fullPopular = filterReleasedSafeContent(rowsData.popular?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const topSafe = filterReleasedSafeContent(rowsData.topRated?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const recentSafe = filterReleasedSafeContent(rowsData.nowPlaying?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));

        // Eagerly preload hero backdrops from the expanded pool BEFORE state update
        const heroCandidates = [...fullTrending, ...fullPopular, ...topSafe, ...recentSafe];
        const heroBackdrops = heroCandidates.filter((i) => i.backdrop_path).slice(0, 6);
        for (const item of heroBackdrops) {
          const link = document.createElement("link");
          link.rel = "preload"; link.as = "image";
          link.href = `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`;
          link.fetchPriority = "high";
          document.head.appendChild(link);
          heroPreloadLinksRef.current.push(link);
        }

        setTrending(fullTrending);
        setPopular(sessionShuffle(fullPopular, "popular"));
        setTopRated(sessionShuffle(topSafe, "toprated"));
        setRecent(recentSafe);

        const recPool = [...fullPopular, ...topSafe, ...fullTrending, ...recentSafe];
        const daySalt = Math.floor(Date.now() / 86400000).toString();

        try {
          const historyRes = await fetchJson<{ history: any[] }>("/api/watch-history", { skipCache: true }).catch(() => null);
          const historyItems = historyRes?.history || [];
          if (historyItems.length > 0) {
            const lastWatched = historyItems[0];
            const recRes = await fetchJson<{ results: any[] }>(`/api/tmdb/recommendations?mediaId=${lastWatched.mediaId}&mediaType=${lastWatched.mediaType}`, { skipCache: true }).catch(() => null);
            if (recRes?.results && recRes.results.length > 0) {
              setRecommended(recRes.results);
            } else {
              setRecommended(sessionShuffle(recPool, `recommended-${daySalt}`));
            }
          } else {
            setRecommended(sessionShuffle(recPool, `recommended-${daySalt}`));
          }
        } catch {
          setRecommended(sessionShuffle(recPool, `recommended-${daySalt}`));
        }
        setGenres((rowsData.genres?.genres || []).slice(0, 18));
        const finalAnimeList = (animeResponse?.items && animeResponse.items.length > 0)
          ? animeResponse.items.slice(0, 10)
          : initialAnimeItems;

        setAnimeList(finalAnimeList);
        setAnimeLoading(false);

        globalHomeCache = {
          trending: fullTrending,
          popular: sessionShuffle(fullPopular, "popular"),
          topRated: sessionShuffle(topSafe, "toprated"),
          recent: recentSafe,
          trendingMoviesToday: trendingMoviesTodaySafe,
          trendingTvToday: trendingTvTodaySafe,
          heroTrendingFeed: [...trendingSafe, ...trendingMoviesTodaySafe, ...trendingTvTodaySafe],
          heroPopularFeed: [...popularSafe, ...popularTvSafe, ...heroRecentSafe],
          heroTopRatedFeed: [...heroTopSafe, ...topRatedMovieSafe],
          heroFeed: [
            ...trendingSafe,
            ...popularSafe,
            ...heroTopSafe,
            ...heroRecentSafe,
            ...topRatedMovieSafe,
            ...popularTvSafe,
            ...onTheAirSafe,
            ...animeMovieSafe,
            ...animeTvSafe,
          ],
          recommended: recPool,
          genres: (rowsData.genres?.genres || []).slice(0, 18),
          animeList: finalAnimeList,
          collections: collectionsData?.collections || [],
        };
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load content");
          if (!cancelled) setIsLoading(false);
          setAnimeLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      heroPreloadLinksRef.current.forEach(link => link.remove());
    };
  }, []);

  function pickRandom<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ─── Hero pool: 3 cards — 1 Movie, 1 TV Show, 1 Anime ──────────────────
  const heroPool = useMemo(() => {
    const isQualityItem = (i: MediaItem) => {
      if (!i.backdrop_path || !i.poster_path) return false;
      if (!i.overview || i.overview.trim().length < 25) return false;
      const rating = i.vote_average ?? 0;
      const votes = i.vote_count ?? 0;
      // Filter out obscure, low-rated, or unreviewed noise
      if (rating < 6.2) return false;
      if (votes < 30) return false;
      return true;
    };

    const qualityFeed = heroFeed.filter(isQualityItem);

    // Card 1: Movie (non-anime)
    const movies = qualityFeed.filter((i) => (i.media_type === "movie" || !!i.title) && !isTmdbAnime(i));
    // Card 2: TV Show (non-anime)
    const shows = qualityFeed.filter((i) => !(i.media_type === "movie" || !!i.title) && !isTmdbAnime(i));
    // Card 3: Anime (movies or TV)
    const animeItems = qualityFeed.filter((i) => isTmdbAnime(i));

    // Track recently seen hero IDs in sessionStorage to prevent repetitions across page visits
    const seenIds = new Set<number>();
    try {
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem("sv_seen_hero_ids");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: number) => seenIds.add(id));
          }
        }
      }
    } catch {}

    const pickFresh = (candidates: MediaItem[]): MediaItem | null => {
      if (candidates.length === 0) return null;
      // Prefer items that haven't been shown in recent session visits
      const unseen = candidates.filter((c) => !seenIds.has(c.id));
      const pool = unseen.length > 0 ? unseen : candidates;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      if (picked) {
        seenIds.add(picked.id);
      }
      return picked || null;
    };

    const m = pickFresh(movies);
    const s = pickFresh(shows);
    const a = pickFresh(animeItems);

    try {
      if (typeof window !== "undefined") {
        const arr = Array.from(seenIds).slice(-50);
        sessionStorage.setItem("sv_seen_hero_ids", JSON.stringify(arr));
      }
    } catch {}

    return [m, s, a].filter(Boolean) as MediaItem[];
  }, [heroFeed]);

  const hero = heroPool[heroIndex] || heroPool[0] || null;

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
      if (!item.backdrop_path) return;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`;
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
    <div className="relative min-h-screen bg-[#070B14] text-[#EAE0CF] pb-20 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(180deg,rgba(114,136,174,0.10),rgba(7,11,20,0)_72%)] pointer-events-none" />
      <div className="absolute inset-x-0 top-[42rem] h-px bg-gradient-to-r from-transparent via-[#7288AE]/20 to-transparent pointer-events-none" />

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
            <HeroBanner key={hero?.id || "empty"} item={hero} />
            {/* Hero dot indicators — sit just above the bottom edge of the hero */}
            {heroPool.length > 1 && (
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
            {/* Hero Left/Right navigation buttons — hidden on mobile (swipe handles it), always visible on md, hover-only on lg+ */}
            {heroPool.length > 1 && (
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
              items={popular}
              isLoading={isLoading}
              seeAllHref="/browse/movies/top-rated"
              accentIcon={<Star className="w-4 h-4 text-amber-400" />}
            />
          </LazySection>

          {/* ─── 3. TOP RATED ─── */}
          <LazySection show={revealedSections >= 3} placeholderHeight={360}>
            <MediaRow
              title="Top Rated TV"
              items={topRated}
              isLoading={isLoading}
              seeAllHref="/browse/tv/top-rated"
              accentIcon={<Star className="w-4 h-4 text-amber-400" />}
            />
          </LazySection>

          {/* ─── STREAMING SERVICES HUB ─── */}
          <LazySection show={revealedSections >= 4} placeholderHeight={380}>
            <TrendingProvidersHub />
          </LazySection>

          {/* ─── EPIC FRANCHISES ─── */}
          {collections.length > 0 && (
            <LazySection show={revealedSections >= 4} placeholderHeight={260}>
              <SectionHeading
                title="Epic Franchises"
                subtitle="Binge your favorite universes"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3 md:gap-4">
                {collections.slice(0, 7).map((col) => {
                  const posterUrl = col.poster_path ? `https://image.tmdb.org/t/p/w342${col.poster_path}` : null;
                  return (
                    <Link
                      key={col.id}
                      href={`/browse/franchise/${col.id}`}
                      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#4B5694]/5 aspect-[2/3] hover:border-[#7288AE]/45 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/25 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              {collections.length > 7 && (
                <div className="mt-6 flex justify-center">
                  <Link
                    href="/browse/franchises"
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/30 text-sm font-semibold transition-all duration-300 group"
                  >
                    View More Franchises
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              )}
            </LazySection>
          )}

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
                    className="absolute bottom-[-8px] right-[-8px] w-[62px] h-[62px] rounded-lg shadow-2xl flex items-center justify-center text-3xl rotate-[20deg] group-hover:rotate-[15deg] group-hover:scale-110 transition-all duration-500"
                    style={{ backgroundColor: g.iconBg, boxShadow: `0 8px 24px rgba(0,0,0,0.5)` }}
                  >
                    {g.icon}
                  </div>
                </Link>
              ))}
            </div>
          </LazySection>


          {/* ─── RECENTLY ADDED ─── */}
          <LazySection show={revealedSections >= 7} placeholderHeight={360}>
            <MediaRow
              title="Recently Added"
              items={recent}
              isLoading={isLoading}
              seeAllHref="/browse/movies"
              accentIcon={<Clock className="w-4 h-4 text-[#7288AE]" />}
            />
          </LazySection>

          {/* ─── RECOMMENDED FOR YOU ─── */}
          <LazySection show={revealedSections >= 8} placeholderHeight={360}>
            <MediaRow
              title="Recommended For You"
              items={recommended}
              isLoading={isLoading}
              accentIcon={<Sparkles className="w-4 h-4 text-violet-400" />}
            />
          </LazySection>

          {/* ─── FOOTER TAG ─── */}
          <footer className="border-t border-[#7288AE]/20 pt-10 pb-8 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo-icon.svg" alt="CineStream" className="w-7 h-7 opacity-90" />
              <span className="text-base font-black tracking-widest text-white/90">
                CINE<span className="text-primary">STREAM</span>
              </span>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <p className="text-xs sm:text-sm text-white/70 font-semibold tracking-wide">
                Movies. TV. Anime. All in one place.
              </p>
              <p className="text-[10px] sm:text-xs text-[#7288AE]/80 max-w-md px-4 font-medium leading-relaxed">
                CineStream does not host any media, it only provides media from open sources!
              </p>
            </div>
          </footer>

        </div>
      </main>
    </div>
  );
}
