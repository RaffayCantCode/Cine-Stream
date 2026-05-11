"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { ContinueWatching } from "@/components/ContinueWatching";
import { fetchJson, shuffleArray, filterReleasedSafeContent } from "@/lib/utils";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  adult?: boolean;
  genre_ids?: number[];
}

interface ApiResponse {
  results: MediaItem[];
}

// Pick a truly random hero item with good variety
function pickRandomHero(items: MediaItem[]): MediaItem | undefined {
  if (!items.length) return undefined;
  const pool = filterReleasedSafeContent(items).slice(0, 20);
  if (!pool.length) return items[0];
  // Weight towards higher rated items but still random
  const weighted = pool.sort(() => Math.random() - 0.5);
  return weighted[Math.floor(Math.random() * Math.min(5, weighted.length))];
}

// Deduplicate items by ID
function deduplicateItems(items: MediaItem[]): MediaItem[] {
  const seen = new Set<number>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// Get random pages for variety (1-10 for more spread)
function getRandomPages(count: number, max: number = 10): number[] {
  const pages = new Set<number>();
  while (pages.size < count) {
    pages.add(Math.floor(Math.random() * max) + 1);
  }
  return Array.from(pages);
}

export default function Home() {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<MediaItem[]>([]);
  const [popularTv, setPopularTv] = useState<MediaItem[]>([]);
  const [topRatedTv, setTopRatedTv] = useState<MediaItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([]);
  const [airingToday, setAiringToday] = useState<MediaItem[]>([]);
  const [heroItem, setHeroItem] = useState<MediaItem | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch data with randomization - runs on every mount for fresh content
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get random pages for true variety - new random pages each time
      const moviePages = getRandomPages(2, 10);
      const tvPages = getRandomPages(2, 10);
      const trendingPage = Math.floor(Math.random() * 5) + 1;
      const nowPlayingPage = Math.floor(Math.random() * 3) + 1;
      const airingTodayPage = Math.floor(Math.random() * 3) + 1;
      
      const [
        trendingData,
        popularMoviesData,
        topRatedMoviesData,
        popularTvData,
        topRatedTvData,
        nowPlayingData,
        airingTodayData,
      ] = await Promise.all([
        fetchJson<ApiResponse>(`/api/tmdb/trending?type=all&timeWindow=day&page=${trendingPage}`),
        fetchJson<ApiResponse>(`/api/tmdb/movies/popular?page=${moviePages[0]}`),
        fetchJson<ApiResponse>(`/api/tmdb/movies/top-rated?page=${moviePages[1]}`),
        fetchJson<ApiResponse>(`/api/tmdb/tv/popular?page=${tvPages[0]}`),
        fetchJson<ApiResponse>(`/api/tmdb/tv/top-rated?page=${tvPages[1]}`),
        fetchJson<ApiResponse>(`/api/tmdb/movies/now-playing?page=${nowPlayingPage}`),
        fetchJson<ApiResponse>(`/api/tmdb/tv/airing-today?page=${airingTodayPage}`),
      ]);

      // Shuffle and deduplicate for maximum variety
      const safeTrending = deduplicateItems(filterReleasedSafeContent(shuffleArray(trendingData.results || [])));
      const safePM = deduplicateItems(filterReleasedSafeContent(shuffleArray(popularMoviesData.results || [])));
      const safeTRM = deduplicateItems(filterReleasedSafeContent(shuffleArray(topRatedMoviesData.results || [])));
      const safePTV = deduplicateItems(filterReleasedSafeContent(shuffleArray(popularTvData.results || [])));
      const safeTRTV = deduplicateItems(filterReleasedSafeContent(shuffleArray(topRatedTvData.results || [])));
      const safeNP = deduplicateItems(filterReleasedSafeContent(shuffleArray(nowPlayingData.results || [])));
      const safeAT = deduplicateItems(filterReleasedSafeContent(shuffleArray(airingTodayData.results || [])));

      setTrending(safeTrending);
      setPopularMovies(safePM);
      setTopRatedMovies(safeTRM);
      setPopularTv(safePTV);
      setTopRatedTv(safeTRTV);
      setNowPlaying(safeNP);
      setAiringToday(safeAT);
      
      // Pick hero from combined pool for variety
      const heroPool = deduplicateItems([...safeTrending, ...safePM, ...safePTV]);
      setHeroItem(pickRandomHero(heroPool));
    } catch (error) {
      setTrending([]);
      setPopularMovies([]);
      setTopRatedMovies([]);
      setPopularTv([]);
      setTopRatedTv([]);
      setNowPlaying([]);
      setAiringToday([]);
      setError(error instanceof Error ? error.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  // Always fetch fresh data on mount
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64">
      {isLoading ? (
        <div className="w-full h-[70vh] md:h-[85vh] bg-muted animate-pulse" />
      ) : error ? (
        <div className="pt-0 px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80">
            <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load content</div>
            <div className="text-sm text-white/50 break-words">{error}</div>
          </div>
        </div>
      ) : heroItem ? (
        <HeroBanner item={heroItem} />
      ) : null}

      <div className="relative z-20 mt-6 md:mt-10 space-y-2 md:space-y-4">
        <ContinueWatching />
        
        {/* Mix up the order for variety on each load */}
        {Math.random() > 0.5 ? (
          <>
            <MediaRow
              title="🔥 Trending Today"
              items={trending}
              isLoading={isLoading}
              seeAllHref="/browse/trending"
            />
            <MediaRow
              title="🎬 Now Playing in Theaters"
              items={nowPlaying}
              isLoading={isLoading}
              seeAllHref="/browse/movies"
            />
            <MediaRow
              title="📺 Airing Today"
              items={airingToday}
              isLoading={isLoading}
              seeAllHref="/browse/tv"
            />
          </>
        ) : (
          <>
            <MediaRow
              title="📺 Airing Today"
              items={airingToday}
              isLoading={isLoading}
              seeAllHref="/browse/tv"
            />
            <MediaRow
              title="🔥 Trending Today"
              items={trending}
              isLoading={isLoading}
              seeAllHref="/browse/trending"
            />
            <MediaRow
              title="🎬 Now Playing in Theaters"
              items={nowPlaying}
              isLoading={isLoading}
              seeAllHref="/browse/movies"
            />
          </>
        )}
        
        <MediaRow
          title="⭐ Popular Movies"
          items={popularMovies}
          isLoading={isLoading}
          seeAllHref="/browse/movies/popular"
        />
        <MediaRow
          title="🏆 Top Rated Movies"
          items={topRatedMovies}
          isLoading={isLoading}
          seeAllHref="/browse/movies/top-rated"
        />
        <MediaRow
          title="📈 Popular TV Shows"
          items={popularTv}
          isLoading={isLoading}
          seeAllHref="/browse/tv/popular"
        />
        <MediaRow
          title="🎯 Top Rated TV Shows"
          items={topRatedTv}
          isLoading={isLoading}
          seeAllHref="/browse/tv/top-rated"
        />
        </div>
      </main>
    </div>
  );
}
