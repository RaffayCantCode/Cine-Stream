"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { AnimeRow } from "@/components/AnimeRow";
import { ContinueWatching } from "@/components/ContinueWatching";
import { fetchJson, shuffleArray, filterReleasedSafeContent } from "@/lib/utils";
import { AnimeItem } from "@/components/AnimeCard";

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
}

interface ApiResponse {
  results: MediaItem[];
}

// Removed old filterSafeContent since we imported the new one from utils

// Pick a truly random hero item (not always index 0)
function pickRandomHero(items: MediaItem[]): MediaItem | undefined {
  if (!items.length) return undefined;
  // Exclude adult and unreleased items and pick from first 15 for variety
  const pool = filterReleasedSafeContent(items).slice(0, 15);
  if (!pool.length) return items[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function Home() {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<MediaItem[]>([]);
  const [popularTv, setPopularTv] = useState<MediaItem[]>([]);
  const [topRatedTv, setTopRatedTv] = useState<MediaItem[]>([]);
  const [heroItem, setHeroItem] = useState<MediaItem | undefined>(undefined);
  // Anime state
  const [animeSpotlight, setAnimeSpotlight] = useState<AnimeItem[]>([]);
  const [animeNew, setAnimeNew] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [animeLoading, setAnimeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch multiple pages for more variety + better randomness
        const pageNum = Math.floor(Math.random() * 3) + 1; // random page 1-3
        const [
          trendingData,
          popularMoviesData,
          topRatedMoviesData,
          popularTvData,
          topRatedTvData,
        ] = await Promise.all([
          fetchJson<ApiResponse>(`/api/tmdb/trending?type=all&timeWindow=week&page=${pageNum}`),
          fetchJson<ApiResponse>(`/api/tmdb/movies/popular?page=${Math.floor(Math.random() * 5) + 1}`),
          fetchJson<ApiResponse>(`/api/tmdb/movies/top-rated?page=${Math.floor(Math.random() * 5) + 1}`),
          fetchJson<ApiResponse>(`/api/tmdb/tv/popular?page=${Math.floor(Math.random() * 5) + 1}`),
          fetchJson<ApiResponse>(`/api/tmdb/tv/top-rated?page=${Math.floor(Math.random() * 5) + 1}`),
        ]);

        const safeFiltered = filterReleasedSafeContent(shuffleArray(trendingData.results || []));
        const safePM = filterReleasedSafeContent(shuffleArray(popularMoviesData.results || []));
        const safeTRM = filterReleasedSafeContent(shuffleArray(topRatedMoviesData.results || []));
        const safePTV = filterReleasedSafeContent(shuffleArray(popularTvData.results || []));
        const safeTRTV = filterReleasedSafeContent(shuffleArray(topRatedTvData.results || []));

        setTrending(safeFiltered);
        setHeroItem(pickRandomHero(safeFiltered));
        setPopularMovies(safePM);
        setTopRatedMovies(safeTRM);
        setPopularTv(safePTV);
        setTopRatedTv(safeTRTV);
      } catch (error) {
        setTrending([]);
        setPopularMovies([]);
        setTopRatedMovies([]);
        setPopularTv([]);
        setTopRatedTv([]);
        setError(error instanceof Error ? error.message : "Failed to fetch data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch anime separately so it doesn't block the main content
  useEffect(() => {
    const fetchAnime = async () => {
      setAnimeLoading(true);
      try {
        const data = await fetchJson<{
          success: boolean;
          data: {
            spotlightAnimes?: AnimeItem[];
            latestEpisodeAnimes?: AnimeItem[];
            newReleases?: AnimeItem[];
          };
        }>("/api/anime?category=home");

        if (data.success && data.data) {
          const spotlight = shuffleArray(data.data.spotlightAnimes || []);
          const latest = shuffleArray(data.data.latestEpisodeAnimes || []);
          setAnimeSpotlight(spotlight.length ? spotlight : latest);
          setAnimeNew(shuffleArray(data.data.newReleases || latest));
        }
      } catch {
        // Anime failing silently — it's not critical
        setAnimeSpotlight([]);
        setAnimeNew([]);
      } finally {
        setAnimeLoading(false);
      }
    };

    fetchAnime();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navigation />

      {isLoading ? (
        <div className="w-full h-[70vh] md:h-[85vh] bg-muted animate-pulse" />
      ) : error ? (
        <div className="pt-32 px-6 md:px-12 max-w-screen-2xl mx-auto">
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
        <MediaRow
          title="Trending This Week"
          items={trending.slice(1)}
          isLoading={isLoading}
          seeAllHref="/browse/trending"
        />
        {/* Anime section — clearly labelled with violet accent */}
        <AnimeRow
          title="Anime Spotlight"
          items={animeSpotlight}
          isLoading={animeLoading}
          seeAllHref="/anime"
        />
        <MediaRow
          title="Popular Movies"
          items={popularMovies}
          isLoading={isLoading}
          seeAllHref="/browse/movies/popular"
        />
        <AnimeRow
          title="New Anime Releases"
          items={animeNew}
          isLoading={animeLoading}
          seeAllHref="/anime"
        />
        <MediaRow
          title="Top Rated Movies"
          items={topRatedMovies}
          isLoading={isLoading}
          seeAllHref="/browse/movies/top-rated"
        />
        <MediaRow
          title="Popular TV Shows"
          items={popularTv}
          isLoading={isLoading}
          seeAllHref="/browse/tv/popular"
        />
        <MediaRow
          title="Top Rated TV Shows"
          items={topRatedTv}
          isLoading={isLoading}
          seeAllHref="/browse/tv/top-rated"
        />
      </div>
    </div>
  );
}
