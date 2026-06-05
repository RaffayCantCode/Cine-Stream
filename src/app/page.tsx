"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";

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
        {hero ? (
          <HeroBanner key={hero.id} item={hero} />
        ) : (
          !loadError && (
            <div className="h-[56vh] bg-muted/30 animate-pulse" />
          )
        )}

        {loadError && (
          <div className="px-5 md:px-10 lg:px-12 max-w-screen-2xl mx-auto pt-6">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
              {loadError}
            </div>
          </div>
        )}

        <div className="px-5 md:px-10 lg:px-12 max-w-screen-2xl mx-auto py-10 space-y-10">
          <section className="space-y-4">
            <div className="flex items-center gap-3 group">
              <div className="w-1.5 h-7 bg-gradient-to-b from-[#D552A3] to-[#831C91] rounded-full shadow-lg shadow-[#D552A3]/20 group-hover:shadow-[#D552A3]/40 transition-shadow" />
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Genres</h2>
                <p className="text-[10px] text-white/30 font-medium tracking-wider uppercase">Browse by category</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <Link
                  key={genre.id}
                  href={`/browse/genre/${genre.id}`}
                  className="hover-lift premium-glass px-4 py-2.5 rounded-xl text-sm text-white/70 hover:text-[#D552A3] transition-all"
                >
                  {genre.name}
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 group">
              <div className="w-1.5 h-7 bg-gradient-to-b from-[#D552A3] to-[#831C91] rounded-full shadow-lg shadow-[#D552A3]/20 group-hover:shadow-[#D552A3]/40 transition-shadow" />
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Franchise Collections</h2>
                <p className="text-[10px] text-white/30 font-medium tracking-wider uppercase">Curated universes</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {FRANCHISES.map((name) => (
                <Link
                  key={name}
                  href={`/browse/franchise/${encodeURIComponent(name)}`}
                  className="hover-lift px-4 py-2.5 rounded-xl bg-[#831C91]/20 border border-[#D552A3]/25 text-sm text-[#D552A3] hover:bg-[#831C91]/35 hover:text-white hover:border-[#D552A3]/50 transition-all"
                >
                  {name}
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 group">
              <div className="w-1.5 h-7 bg-gradient-to-b from-[#D552A3] to-[#831C91] rounded-full shadow-lg shadow-[#D552A3]/20 group-hover:shadow-[#D552A3]/40 transition-shadow" />
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Anime</h2>
                  <p className="text-[10px] text-white/30 font-medium tracking-wider uppercase">Japanese audio with English subtitles &mdash; browse all anime</p>
                </div>
                <Link
                  href="/anime"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#462C7D] to-[#831C91] text-white text-xs font-bold hover:from-[#831C91] hover:to-[#D552A3] transition-all shadow-lg shadow-[#831C91]/25"
                >
                  Browse Anime &rarr;
                </Link>
              </div>
            </div>
          </section>

          <MediaRow
            title="Famous / Popular"
            items={popular}
            isLoading={isLoading}
            seeAllHref="/browse/movies/popular"
          />
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
          <MediaRow
            title="Recently Added"
            items={recent}
            isLoading={isLoading}
            seeAllHref="/browse/movies"
          />
          <MediaRow
            title="Recommended"
            items={recommended}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
}
