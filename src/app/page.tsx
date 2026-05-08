"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { ContinueWatching } from "@/components/ContinueWatching";

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
}

interface ApiResponse {
  results: MediaItem[];
}

export default function Home() {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<MediaItem[]>([]);
  const [popularTv, setPopularTv] = useState<MediaItem[]>([]);
  const [topRatedTv, setTopRatedTv] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [trendingRes, popularMoviesRes, topRatedMoviesRes, popularTvRes, topRatedTvRes] =
          await Promise.all([
            fetch("/api/tmdb/trending?type=all&timeWindow=week"),
            fetch("/api/tmdb/movies/popular"),
            fetch("/api/tmdb/movies/top-rated"),
            fetch("/api/tmdb/tv/popular"),
            fetch("/api/tmdb/tv/top-rated"),
          ]);

        const [trendingData, popularMoviesData, topRatedMoviesData, popularTvData, topRatedTvData] =
          await Promise.all([
            trendingRes.json(),
            popularMoviesRes.json(),
            topRatedMoviesRes.json(),
            popularTvRes.json(),
            topRatedTvRes.json(),
          ]);

        setTrending(trendingData.results || []);
        setPopularMovies(popularMoviesData.results || []);
        setTopRatedMovies(topRatedMoviesData.results || []);
        setPopularTv(popularTvData.results || []);
        setTopRatedTv(topRatedTvData.results || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const heroItem = trending[0];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navigation />

      {isLoading ? (
        <div className="w-full h-[70vh] md:h-[85vh] bg-muted animate-pulse" />
      ) : heroItem ? (
        <HeroBanner item={heroItem} />
      ) : null}

      <div className="relative z-20 mt-6 md:mt-10 space-y-2 md:space-y-4">
        <ContinueWatching />
        <MediaRow
          title="Trending This Week"
          items={trending.slice(1)}
          isLoading={isLoading}
        />
        <MediaRow
          title="Popular Movies"
          items={popularMovies}
          isLoading={isLoading}
        />
        <MediaRow
          title="Top Rated Movies"
          items={topRatedMovies}
          isLoading={isLoading}
        />
        <MediaRow
          title="Popular TV Shows"
          items={popularTv}
          isLoading={isLoading}
        />
        <MediaRow
          title="Top Rated TV Shows"
          items={topRatedTv}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
