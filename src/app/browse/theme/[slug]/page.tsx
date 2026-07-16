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

export default async function ThemePage(props: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ shuffle?: string; seed?: string }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { slug } = params;
  const query = new URLSearchParams();
  if (searchParams.shuffle) query.set("shuffle", searchParams.shuffle);
  if (searchParams.seed) query.set("seed", searchParams.seed);
  const endpoint = `/api/tmdb/theme/${slug}${query.toString() ? `?${query.toString()}` : ""}`;

  return (
    <BrowseGridPage
      title={themeTitles[slug] || "Thematic Picks"}
      description="Fresh picks inside this mood every time you open it"
      endpoint={endpoint}
    />
  );
}
