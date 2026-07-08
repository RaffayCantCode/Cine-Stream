export const runtime = 'edge';
import { BrowseGridPage } from "@/components/BrowseGridPage";

export default function TopRatedTvPage() {
  return (
    <BrowseGridPage
      title="Top Rated TV Shows"
      description="Great series to start tonight."
      endpoint="/api/tmdb/tv/top-rated"
      mediaType="tv"
    />
  );
}

