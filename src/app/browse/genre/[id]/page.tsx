export const runtime = 'edge';
import { BrowseGridPage } from "@/components/BrowseGridPage";

export default async function GenrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const endpoint = `/api/tmdb/discover/movies?genreId=${id}`;

  return (
    <BrowseGridPage
      title="Genre Picks"
      description="Movies curated by selected genre"
      endpoint={endpoint}
      mediaType="movie"
    />
  );
}
