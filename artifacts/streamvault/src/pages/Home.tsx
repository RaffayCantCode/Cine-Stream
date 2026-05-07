import {
  useGetTrending,
  useGetPopularMovies,
  useGetTopRatedMovies,
  useGetPopularTv,
  useGetTopRatedTv,
} from "@workspace/api-client-react";
import { HeroBanner } from "@/components/HeroBanner";
import { MediaRow } from "@/components/MediaRow";
import { Navigation } from "@/components/Navigation";
import { ContinueWatching } from "@/components/ContinueWatching";

export function Home() {
  const { data: trending, isLoading: trendingLoading } = useGetTrending({ type: "all", timeWindow: "week" });
  const { data: popularMovies, isLoading: popMoviesLoading } = useGetPopularMovies();
  const { data: topRatedMovies, isLoading: topMoviesLoading } = useGetTopRatedMovies();
  const { data: popularTv, isLoading: popTvLoading } = useGetPopularTv();
  const { data: topRatedTv, isLoading: topTvLoading } = useGetTopRatedTv();

  const heroItem = trending?.results?.[0];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navigation />
      
      {trendingLoading ? (
        <div className="w-full h-[70vh] md:h-[85vh] bg-muted animate-pulse" />
      ) : heroItem ? (
        <HeroBanner item={heroItem} />
      ) : null}

      <div className="relative z-20 mt-6 md:mt-10 space-y-2 md:space-y-4">
        <ContinueWatching />
        <MediaRow title="Trending This Week" items={trending?.results?.slice(1)} isLoading={trendingLoading} />
        <MediaRow title="Popular Movies" items={popularMovies?.results} isLoading={popMoviesLoading} />
        <MediaRow title="Top Rated Movies" items={topRatedMovies?.results} isLoading={topMoviesLoading} />
        <MediaRow title="Popular TV Shows" items={popularTv?.results} isLoading={popTvLoading} />
        <MediaRow title="Top Rated TV Shows" items={topRatedTv?.results} isLoading={topTvLoading} />
      </div>
    </div>
  );
}
