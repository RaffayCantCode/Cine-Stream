export const runtime = 'edge';
import { BrowseGridPage } from "@/components/BrowseGridPage";

const themeTitles: Record<string, string> = {
  'k-dramas': 'K-Dramas',
  'superhero': 'Superheroes',
  'true-crime': 'True Crime',
  'sci-fi-fantasy': 'Sci-Fi & Fantasy',
  'rom-com': 'Romance',
  'action-packed': 'Adrenaline',
  'horror-thriller': 'Horror & Thriller',
  'fantasy-magic': 'Fantasy & Magic',
  'feel-good-comedy': 'Comedy',
  'documentary': 'Documentary',
};

export default async function ThemePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const { slug } = params;
  const endpoint = `/api/tmdb/theme/${slug}`;

  return (
    <BrowseGridPage
      title={themeTitles[slug] || "Thematic Picks"}
      description="Curated collection based on your favorite theme"
      endpoint={endpoint}
    />
  );
}
