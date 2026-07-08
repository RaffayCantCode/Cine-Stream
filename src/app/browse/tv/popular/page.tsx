export const runtime = 'edge';
import { BrowseGridPage } from "@/components/BrowseGridPage";

export default function PopularTvPage() {
  return (
    <BrowseGridPage
      title="Popular TV Shows"
      description="Binge-worthy series trending with viewers."
      endpoint="/api/tmdb/tv/popular"
      mediaType="tv"
    />
  );
}

