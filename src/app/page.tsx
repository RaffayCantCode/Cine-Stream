"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { ChevronLeft, ChevronRight, Flame, Star, TrendingUp, Clock, Sparkles } from "lucide-react";
import { fetchJson, filterReleasedSafeContent, isTmdbAnime } from "@/lib/utils";
import { PROVIDERS } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";
import { AnimeRow } from "@/components/AnimeRow";
import { AnimatePresence } from "framer-motion";
import type { AnimeItem } from "@/components/AnimeCard";

const ContinueWatching = dynamic(
  () => import("@/components/ContinueWatching").then((m) => m.ContinueWatching),
  { ssr: false }
);

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
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  genre_ids?: number[];
}

interface Genre {
  id: number;
  name: string;
}



// ─── Session-stable shuffle ───────────────────────────────────────────────────
// We want different results every SESSION (new tab / new browser open) but
// stable within the same session (so a page reload within a tab keeps the same order).
function getSessionSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
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

// Preload first N poster images so they render without a flash
function preloadImages(items: MediaItem[], count = 8) {
  const fragment = document.createDocumentFragment();
  items.slice(0, count).forEach((item) => {
    if (!item.poster_path) return;
    const url = `https://image.tmdb.org/t/p/w342${item.poster_path}`;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url;
    fragment.appendChild(link);
  });
  document.head.appendChild(fragment);
}

// ─── Section entrance animation ───────────────────────────────────────────────
function Section({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <section
      className="animate-fade-in-up opacity-0"
      style={{ animationDelay: `${delay}s`, animationFillMode: "forwards" }}
    >
      {children}
    </section>
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
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popular, setPopular] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [recent, setRecent] = useState<MediaItem[]>([]);
  const [heroFeed, setHeroFeed] = useState<MediaItem[]>([]);
  const [recommended, setRecommended] = useState<MediaItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [animeLoading, setAnimeLoading] = useState(true);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerReset, setTimerReset] = useState(0);
  const heroPoolLengthRef = useRef(0);

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

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        // 1) Fire hero + anime + full rows in PARALLEL
        const heroPromise = fetchJson<{
          trending: { results: MediaItem[] };
          popular: { results: MediaItem[] };
          topRated: { results: MediaItem[] };
          nowPlaying: { results: MediaItem[] };
        }>("/api/tmdb/home-hero", { cacheTtlMs: 180000 });

        const rowsPromise = fetchJson<{
          trending: { results: MediaItem[] };
          popular: { results: MediaItem[] };
          topRated: { results: MediaItem[] };
          nowPlaying: { results: MediaItem[] };
          genres: { genres: Genre[] };
        }>("/api/tmdb/home", { cacheTtlMs: 180000 });

        const animePromise = fetchJson<{ success: boolean; data: { items: AnimeItem[] } } | null>(
          "/api/anime?category=trending&page=1",
          { cacheTtlMs: 300000 }
        ).catch(() => null);

        // ── Hero data arrives FAST (only 2 TMDB calls) ─────────────────
        const heroData = await heroPromise;
        if (cancelled) return;

        const trendingSafe = filterReleasedSafeContent(heroData.trending?.results || [])
          .filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const popularSafe = filterReleasedSafeContent(heroData.popular?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const heroTopSafe = filterReleasedSafeContent(heroData.topRated?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const heroRecentSafe = filterReleasedSafeContent(heroData.nowPlaying?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        ).filter((i) => !EXCLUDED_LANGS.has(i.original_language || ""));
        const shuffledTrending = sessionShuffle(trendingSafe, "trending");
        const shuffledPopular = sessionShuffle(popularSafe, "popular");

        // Early hero backdrop preload
        const heroCandidate = [...trendingSafe, ...popularSafe].find((i) => i.backdrop_path);
        if (heroCandidate?.backdrop_path) {
          const preloadLink = document.createElement("link");
          preloadLink.rel = "preload";
          preloadLink.as = "image";
          preloadLink.href = `https://image.tmdb.org/t/p/original${heroCandidate.backdrop_path}`;
          preloadLink.fetchPriority = "high";
          document.head.appendChild(preloadLink);
        }

        setTrending(shuffledTrending);
        setPopular(shuffledPopular);
        setTopRated(sessionShuffle(heroTopSafe, "toprated"));
        setRecent(sessionShuffle(heroRecentSafe, "recent"));
        setHeroFeed([...shuffledTrending, ...shuffledPopular, ...heroTopSafe, ...heroRecentSafe]);
        preloadImages(shuffledTrending, 6);
        preloadImages(shuffledPopular, 4);

        // ── Full rows data arrives (more TMDB pages) ────────────────────
        const [rowsData, animeResponse] = await Promise.all([rowsPromise, animePromise]);
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
          link.href = `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
          link.fetchPriority = "high";
          document.head.appendChild(link);
        }

        setTrending(sessionShuffle(fullTrending, "trending"));
        setPopular(sessionShuffle(fullPopular, "popular"));
        setTopRated(sessionShuffle(topSafe, "toprated"));
        setRecent(sessionShuffle(recentSafe, "recent"));

        const recPool = [...fullPopular, ...topSafe, ...fullTrending, ...recentSafe];
        const daySalt = Math.floor(Date.now() / 86400000).toString();
        setRecommended(sessionShuffle(recPool, `recommended-${daySalt}`));
        setGenres((rowsData.genres?.genres || []).slice(0, 18));

        if (animeResponse?.success && animeResponse.data?.items) {
          setAnimeList(sessionShuffle(animeResponse.data.items, "anime").slice(0, 15));
        }
        setIsLoading(false);
        setAnimeLoading(false);

      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load content");
          if (!cancelled) setIsLoading(false);
          setAnimeLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  function pickRandom<T>(arr: T[]): T | null {
    return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
  }

  // ─── Hero pool ─────────────────────────────────────────────────────────────
  const heroPool = useMemo(() => {
    const eligible = heroFeed.filter((i) => i.backdrop_path);
    const movies = eligible.filter((i) => (i.media_type === "movie" || !!i.title) && !isTmdbAnime(i));
    const shows = eligible.filter((i) => !(i.media_type === "movie" || !!i.title) && !isTmdbAnime(i));
    const animeItems = eligible.filter((i) => isTmdbAnime(i));

    const result: MediaItem[] = [];
    const m = pickRandom(movies);
    if (m) result.push(m);
    const s = pickRandom(shows);
    if (s) result.push(s);
    const a = pickRandom(animeItems);
    if (a) result.push(a);

    // Fill up to 3 with random unique items
    if (result.length < 3) {
      const seen = new Set(result.map((r) => r.id));
      const shuffled = [...eligible].sort(() => Math.random() - 0.5);
      for (const item of shuffled) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          result.push(item);
          if (result.length >= 3) break;
        }
      }
    }

    return result;
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
    heroPool.forEach((item) => {
      if (!item.backdrop_path) return;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
      link.fetchPriority = "high";
      document.head.appendChild(link);
    });
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
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 bleed-header">

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
            <AnimatePresence mode="wait">
              <HeroBanner key={hero?.id || "empty"} item={hero} />
            </AnimatePresence>
            {/* Hero dot indicators — sit just above the bottom edge of the hero */}
            {heroPool.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                {heroPool.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToHero(i)}
                    className={`transition-all duration-300 rounded-full ${
                      i === heroIndex
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
            <div className="relative w-full h-[85svh] min-h-[500px] max-h-[750px] sm:h-[60vw] sm:max-h-[640px] md:h-[75vh] flex items-end overflow-hidden bg-[#0d1233]">
              <div className="absolute inset-0 skeleton-pulse" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
              <div className="relative z-10 w-full px-4 sm:px-6 md:px-12 pb-12 sm:pb-12 md:pb-14 max-w-screen-2xl mx-auto">
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

        {/* ─── CONTINUE WATCHING ─── */}
        <ContinueWatching />

        <div className="px-5 md:px-10 lg:px-12 max-w-screen-2xl mx-auto py-8 space-y-10">

          {/* ─── 1. TRENDING NOW ─── */}
          <Section>
            <MediaRow
              title="Trending Now"
              items={trending}
              isLoading={isLoading}
              seeAllHref="/browse/trending"
              accentIcon={<TrendingUp className="w-4 h-4 text-[#7288AE]" />}
            />
          </Section>

          {/* ─── 2. POPULAR NOW ─── */}
          <Section>
            <MediaRow
              title="Popular Movies"
              items={popular}
              isLoading={isLoading}
              seeAllHref="/browse/movies/popular"
              accentIcon={<Flame className="w-4 h-4 text-orange-400" />}
            />
          </Section>

          {/* ─── 3. TOP RATED ─── */}
          <Section>
            <MediaRow
              title="Top Rated TV"
              items={topRated}
              isLoading={isLoading}
              seeAllHref="/browse/tv/top-rated"
              accentIcon={<Star className="w-4 h-4 text-amber-400" />}
            />
          </Section>

          {/* ─── STREAMING SERVICES ─── */}
          <Section>
            <SectionHeading
              title="Streaming Services"
              subtitle="Browse by platform"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {PROVIDERS.map((p) => (
                <Link
                  key={p.slug}
                  href={`/browse/provider/${p.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.07] transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1 focus:outline-none"
                  style={{
                    background: `linear-gradient(145deg, ${p.color}22 0%, ${p.color}08 60%, transparent 100%)`,
                    boxShadow: `0 0 0 1px ${p.color}18, 0 8px 32px ${p.color}10`,
                  }}
                >
                  {/* Animated background glow blob */}
                  <div
                    className="absolute -inset-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl"
                    style={{ background: `radial-gradient(circle at 60% 40%, ${p.color}30, transparent 70%)` }}
                  />
                  {/* Top accent stripe */}
                  <div
                    className="absolute top-0 inset-x-0 h-[2px] rounded-t-2xl opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(to right, transparent, ${p.color}, transparent)` }}
                  />

                  <div className="relative p-5 flex flex-col gap-4 h-full min-h-[110px]">
                    {/* Logo + glow */}
                    <div className="flex items-start justify-between">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                        style={{
                          background: p.color,
                          color: p.textColor,
                          boxShadow: `0 4px 16px ${p.color}50`,
                        }}
                      >
                        <ProviderIcon slug={p.slug} className="w-6 h-6" />
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all mt-1"
                      />
                    </div>

                    {/* Name + tagline */}
                    <div>
                      <span className="block text-base font-black text-white tracking-tight group-hover:text-white transition-colors">
                        {p.name}
                      </span>
                      <span
                        className="block text-[10px] font-bold tracking-[0.18em] uppercase mt-0.5 transition-colors"
                        style={{ color: `${p.color}99` }}
                      >
                        Browse library
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          {/* ─── GENRE UNIVERSE ─── */}
          <Section>
            <SectionHeading
              title="Genre Universe"
              subtitle="Browse by category"
              href="/browse/movies"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {genres.slice(0, 12).map((genre) => (
                <Link
                  key={genre.id}
                  href={`/browse/genre/${genre.id}`}
                  className="group relative overflow-hidden rounded-xl border border-[#7288AE]/10 bg-gradient-to-br from-[#111844]/80 to-[#1a2268]/40 p-4 hover:border-[#7288AE]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#4B5694]/10"
                >
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-[#4B5694]/10 rounded-full blur-xl group-hover:bg-[#7288AE]/20 transition-all" />
                  <span className="text-sm font-bold text-[#EAE0CF]/80 group-hover:text-[#EAE0CF] transition-colors">{genre.name}</span>
                </Link>
              ))}
              <Link
                href="/browse/movies"
                className="group relative overflow-hidden rounded-xl border border-[#4B5694]/20 bg-[#4B5694]/10 p-4 flex items-center justify-center gap-2 hover:bg-[#4B5694]/20 transition-all"
              >
                <span className="text-xs font-bold text-[#7288AE]">View All</span>
                <ChevronRight className="w-3 h-3 text-[#7288AE]" />
              </Link>
            </div>
          </Section>



          {/* ─── ANIME SPOTLIGHT ─── */}
          <Section>
            <AnimeRow
              title="Trending Anime"
              items={animeList}
              isLoading={animeLoading}
              seeAllHref="/anime"
            />
          </Section>

          {/* ─── RECENTLY ADDED ─── */}
          <Section>
            <MediaRow
              title="Recently Added"
              items={recent}
              isLoading={isLoading}
              seeAllHref="/browse/movies"
              accentIcon={<Clock className="w-4 h-4 text-[#7288AE]" />}
            />
          </Section>

          {/* ─── RECOMMENDED FOR YOU ─── */}
          <Section>
            <MediaRow
              title="Recommended For You"
              items={recommended}
              isLoading={isLoading}
              accentIcon={<Sparkles className="w-4 h-4 text-violet-400" />}
            />
          </Section>

          {/* ─── FOOTER TAG ─── */}
          <footer className="border-t border-[#7288AE]/10 pt-8 pb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <img src="/logo-icon.svg" alt="CineStream" className="w-6 h-6 opacity-50" />
              <span className="text-sm font-bold tracking-wider text-[#7288AE]/40">
                CINE<span className="text-[#EAE0CF]/40">STREAM</span>
              </span>
            </div>
            <p className="text-[10px] text-[#7288AE]/30 font-medium tracking-wider">
              Movies. TV. Anime. All in one place.
            </p>
          </footer>

        </div>
      </main>
    </div>
  );
}
