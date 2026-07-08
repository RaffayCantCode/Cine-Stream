export const runtime = 'edge';
import { BrowseGridPage } from "@/components/BrowseGridPage";

export default function TopRatedMoviesPage() {
  return (
    <BrowseGridPage
      title="Top Rated Movies"
      description="Highly rated picks — critics and fans agree."
      endpoint="/api/tmdb/movies/top-rated"
      mediaType="movie"
    />
  );
}

