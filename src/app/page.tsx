"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { ContinueWatching } from "@/components/ContinueWatching";
import { ChevronLeft, ChevronRight, Flame, Star, TrendingUp, Clock, Sparkles } from "lucide-react";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";
import { PROVIDERS } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";
import { AnimeRow } from "@/components/AnimeRow";
import type { AnimeItem } from "@/components/AnimeCard";
import { motion } from "framer-motion";

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

function sessionShuffle<T>(array: T[], salt: string = ""): T[] {
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
  items.slice(0, count).forEach((item) => {
    if (!item.poster_path) return;
    const url = `https://image.tmdb.org/t/p/w342${item.poster_path}`;
    const img = new Image();
    img.src = url;
  });
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
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay }}
    >
      {children}
    </motion.section>
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
  const [recommended, setRecommended] = useState<MediaItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [animeLoading, setAnimeLoading] = useState(true);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setHeroIndex((prev) => (prev + 1) % heroPool.length);
    } else if (isRightSwipe && heroPool.length > 1) {
      setHeroIndex((prev) => (prev - 1 + heroPool.length) % heroPool.length);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const data = await fetchJson<{
          trending: { results: MediaItem[] };
          popular: { results: MediaItem[] };
          topRated: { results: MediaItem[] };
          nowPlaying: { results: MediaItem[] };
          upcoming: { results: MediaItem[] };
          genres: { genres: Genre[] };
        }>("/api/tmdb/home", { cacheTtlMs: 120000 }); // 2 min cache — fresher data

        if (cancelled) return;

        // Filter each pool
        const trendingSafe = filterReleasedSafeContent(data.trending?.results || []);
        const popularSafe = filterReleasedSafeContent(data.popular?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        );
        const topSafe = filterReleasedSafeContent(data.topRated?.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        );
        const recentSafe = filterReleasedSafeContent(data.nowPlaying?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        );
        const upcomingSafe = filterReleasedSafeContent(data.upcoming?.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        );

        // Session-seeded shuffles — different every browser session, stable within
        const shuffledTrending = sessionShuffle(trendingSafe, "trending");
        const shuffledPopular = sessionShuffle(popularSafe, "popular");
        const shuffledTopRated = sessionShuffle(topSafe, "toprated");
        const shuffledRecent = sessionShuffle(
          [...recentSafe, ...upcomingSafe],
          "recent"
        );

        // Recommended: weighted random sample from all pools
        const recPool = [...popularSafe, ...topSafe, ...trendingSafe];
        // Weight by vote_average so higher-quality titles appear more often
        const weightedPool = recPool.filter((i) => (i.vote_average ?? 0) >= 7.0);
        const shuffledRec = sessionShuffle(
          weightedPool.length >= 20 ? weightedPool : recPool,
          "recommended"
        );

        setTrending(shuffledTrending);
        setPopular(shuffledPopular);
        setTopRated(shuffledTopRated);
        setRecent(shuffledRecent);
        setRecommended(shuffledRec);
        setGenres((data.genres?.genres || []).slice(0, 18));

        // Preload first 8 poster images while the hero is loading
        preloadImages(shuffledTrending);
        preloadImages(shuffledPopular, 4);

        // Fetch anime
        setAnimeLoading(true);
        try {
          const animeData = await fetchJson<{ success: boolean; data: AnimeItem[] }>(
            "/api/anime?category=trending&page=1",
            { cacheTtlMs: 300000 }
          );
          if (animeData.success && animeData.data) {
            setAnimeList(sessionShuffle(animeData.data, "anime").slice(0, 15));
          }
        } catch { /* silent fallback */ }
        finally { setAnimeLoading(false); }

      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load content");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Hero pool ─────────────────────────────────────────────────────────────
  const heroPool = useMemo(() => {
    const pool = [...trending.slice(0, 8), ...popular.slice(0, 5)];
    const unique: MediaItem[] = [];
    const seen = new Set<number>();
    for (const item of pool) {
      // Only use items with a backdrop for the hero
      if (!seen.has(item.id) && item.backdrop_path) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique.slice(0, 7);
  }, [trending, popular]);

  const hero = heroPool[heroIndex];

  useEffect(() => {
    if (heroPool.length <= 1) return;
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroPool.length);
    }, 9000);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroPool]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 bleed-header">

        {/* ─── INFO LINK ─── */}
        <Link
          href="/landing"
          className="fixed top-4 right-4 z-50 w-9 h-9 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
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
            <HeroBanner key={hero.id} item={hero} />
            {/* Hero dot indicators — sit just above the bottom edge of the hero */}
            {heroPool.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                {heroPool.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHeroIndex(i)}
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
            {/* Hero Left/Right navigation buttons — hidden on mobile (swipe handles it) */}
            {heroPool.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setHeroIndex((prev) => (prev - 1 + heroPool.length) % heroPool.length)}
                  className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 items-center justify-center text-white transition-all active:scale-90 group focus:outline-none backdrop-blur-md shadow-lg duration-300 opacity-0 group-hover/hero:opacity-100"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setHeroIndex((prev) => (prev + 1) % heroPool.length)}
                  className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 items-center justify-center text-white transition-all active:scale-90 group focus:outline-none backdrop-blur-md shadow-lg duration-300 opacity-0 group-hover/hero:opacity-100"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform text-white" />
                </button>
              </>
            )}
          </div>
        ) : (
          !loadError && (
            <div className="h-[50vh] bg-[#111844]/30 animate-pulse" />
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
