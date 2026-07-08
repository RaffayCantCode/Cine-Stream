export const runtime = 'edge';
import { BrowseGridPage } from "@/components/BrowseGridPage";

export default function PopularMoviesPage() {
  return (
    <BrowseGridPage
      title="Popular Movies"
      description="What everyone’s watching right now."
      endpoint="/api/tmdb/movies/popular"
      mediaType="movie"
    />
  );
}

