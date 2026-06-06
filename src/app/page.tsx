"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { ContinueWatching } from "@/components/ContinueWatching";
import { ChevronRight } from "lucide-react";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";
import { PROVIDERS } from "@/lib/providers";

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

const FRANCHISES = [
  "Marvel", "DC", "Star Wars", "Harry Potter",
  "Fast & Furious", "Transformers", "John Wick",
  "Mission Impossible", "Disney", "Pixar",
];

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      const rngPage = (max: number) => Math.floor(Math.random() * max) + 1;
      try {
        const [tr, pm, pt, np, gm] = await Promise.all([
          fetchJson<{ results: MediaItem[] }>(
            `/api/tmdb/trending?type=all&timeWindow=week&page=${rngPage(5)}`,
            { cacheTtlMs: 180000 }
          ),
          fetchJson<{ results: MediaItem[] }>(
            `/api/tmdb/movies/popular?page=${rngPage(5)}`,
            { cacheTtlMs: 180000 }
          ),
          fetchJson<{ results: MediaItem[] }>(
            `/api/tmdb/tv/top-rated?page=${rngPage(5)}`,
            { cacheTtlMs: 180000 }
          ),
          fetchJson<{ results: MediaItem[] }>(
            `/api/tmdb/movies/now-playing?page=${rngPage(3)}`,
            { cacheTtlMs: 180000 }
          ),
          fetchJson<{ genres: Genre[] }>(
            "/api/tmdb/genres/movies",
            { cacheTtlMs: 86400000 }
          ),
        ]);

        if (cancelled) return;

        const trendingSafe = filterReleasedSafeContent(tr.results || []);
        const popularSafe = filterReleasedSafeContent(pm.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        );
        const topSafe = filterReleasedSafeContent(pt.results || []).map(
          (i) => ({ ...i, media_type: "tv" as const })
        );
        const recentSafe = filterReleasedSafeContent(np.results || []).map(
          (i) => ({ ...i, media_type: "movie" as const })
        );

        setTrending(shuffleArray(trendingSafe));
        setPopular(shuffleArray(popularSafe));
        setTopRated(shuffleArray(topSafe));
        setRecent(shuffleArray(recentSafe));
        setRecommended(shuffleArray([
          ...popularSafe.slice(0, 10),
          ...topSafe.slice(0, 10),
        ]));
        setGenres((gm.genres || []).slice(0, 18));
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load content"
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const heroPool = useMemo(() => {
    const pool = [...trending.slice(0, 5), ...popular.slice(0, 5)];
    const unique: MediaItem[] = [];
    const seen = new Set<number>();
    for (const item of pool) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique.slice(0, 5);
  }, [trending, popular]);

  const hero = heroPool[heroIndex];

  useEffect(() => {
    if (heroPool.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroPool.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroPool]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 bleed-header">

        {/* ─── HERO BANNER ─── */}
        {hero ? (
          <HeroBanner key={hero.id} item={hero} />
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

        {/* ─── CONTINUE WATCHING (logged-in users only) ─── */}
        <ContinueWatching />

        <div className="px-5 md:px-10 lg:px-12 max-w-screen-2xl mx-auto py-12 space-y-12">

          {/* ─── GENRE UNIVERSE ─── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-[2px] bg-gradient-to-r from-[#7288AE] to-transparent rounded-full" />
              <div>
                <h2 className="text-lg font-black text-[#EAE0CF] tracking-tight">Genre Universe</h2>
                <p className="text-[9px] text-[#7288AE]/50 font-semibold tracking-[0.15em] uppercase">Browse by category</p>
              </div>
            </div>
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
          </section>

          {/* ─── CONTENT ROWS ─── */}
          <section className="relative">
            <MediaRow
              title="Popular Now"
              items={popular}
              isLoading={isLoading}
              seeAllHref="/browse/movies/popular"
            />
          </section>

          <MediaRow
            title="Top Rated"
            items={topRated}
            isLoading={isLoading}
            seeAllHref="/browse/tv/top-rated"
          />

          <MediaRow
            title="Trending Now"
            items={trending}
            isLoading={isLoading}
            seeAllHref="/browse/trending"
          />

          {/* ─── STREAMING SERVICE UNIVERSE ─── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-[2px] bg-gradient-to-r from-[#7288AE] to-transparent rounded-full" />
              <div>
                <h2 className="text-lg font-black text-[#EAE0CF] tracking-tight">View Media From</h2>
                <p className="text-[9px] text-[#7288AE]/50 font-semibold tracking-[0.15em] uppercase">Pick a streaming service</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
              {PROVIDERS.map((p) => (
                <Link
                  key={p.slug}
                  href={`/browse/provider/${p.slug}`}
                  className="group relative overflow-hidden rounded-xl border border-white/10 p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-white/20"
                  style={{
                    background: `linear-gradient(135deg, ${p.color}30 0%, ${p.color}10 100%)`,
                    boxShadow: `inset 0 0 0 1px ${p.color}20`,
                  }}
                >
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                    style={{ background: p.color }}
                  />
                  <div className="relative flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center font-black text-base shrink-0 border border-white/10 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: p.color, color: p.textColor }}
                    >
                      {p.short}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white group-hover:text-white transition-colors truncate">
                        {p.name}
                      </span>
                      <span className="block text-[10px] text-white/40 font-medium tracking-wide uppercase">
                        View titles
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ─── FRANCHISE UNIVERSE ─── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-[2px] bg-gradient-to-r from-[#7288AE] to-transparent rounded-full" />
              <div>
                <h2 className="text-lg font-black text-[#EAE0CF] tracking-tight">Franchise Universe</h2>
                <p className="text-[9px] text-[#7288AE]/50 font-semibold tracking-[0.15em] uppercase">Curated collections</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {FRANCHISES.map((name) => (
                <Link
                  key={name}
                  href={`/browse/franchise/${encodeURIComponent(name)}`}
                  className="group relative overflow-hidden rounded-xl border border-[#7288AE]/10 bg-gradient-to-br from-[#111844]/80 to-[#1a2268]/30 p-4 hover:border-[#7288AE]/25 hover:shadow-lg hover:shadow-[#4B5694]/10 transition-all duration-300"
                >
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[#7288AE]/5 rounded-full blur-2xl group-hover:bg-[#4B5694]/10 transition-all" />
                  <span className="text-sm font-bold text-[#EAE0CF]/70 group-hover:text-[#EAE0CF] transition-colors">{name}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ─── ANIME SPOTLIGHT ─── */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-[2px] bg-gradient-to-r from-[#7288AE] to-transparent rounded-full" />
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-black text-[#EAE0CF] tracking-tight">Anime Universe</h2>
                  <p className="text-[9px] text-[#7288AE]/50 font-semibold tracking-[0.15em] uppercase">Japanese audio with English subtitles</p>
                </div>
                <Link
                  href="/anime"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-[#EAE0CF] text-xs font-bold hover:shadow-lg hover:shadow-[#4B5694]/30 transition-all flex items-center gap-2"
                >
                  Browse Anime <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </section>

          <MediaRow
            title="Recently Added"
            items={recent}
            isLoading={isLoading}
            seeAllHref="/browse/movies"
          />

          <MediaRow
            title="Recommended For You"
            items={recommended}
            isLoading={isLoading}
          />

          {/* ─── FOOTER TAG ─── */}
          <footer className="border-t border-[#7288AE]/10 pt-8 pb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <img src="/logo-icon.svg" alt="CineVault" className="w-6 h-6 opacity-50" />
              <span className="text-sm font-bold tracking-wider text-[#7288AE]/40">
                CINE<span className="text-[#EAE0CF]/40">VAULT</span>
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
