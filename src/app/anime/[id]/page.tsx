export const runtime = 'edge';
import { Metadata } from "next";
import AnimeClient from "./AnimeClient";
import { Suspense } from "react";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;
  try {
    const query = `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        title { romaji english }
        description
        coverImage { extraLarge large }
      }
    }`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { id: parseInt(id, 10) } }),
      next: { revalidate: 3600 } // Cache metadata for 1 hour
    });
    
    if (!res.ok) throw new Error("Failed to fetch from AniList");
    const json = await res.json();
    const anime = json?.data?.Media;
    if (!anime) throw new Error("No media found");
    
    // Fallback images
    const ogImage = anime.coverImage?.extraLarge || anime.coverImage?.large;
    
    // Parse description (anilist returns HTML sometimes)
    let desc = anime.description || "";
    if (desc) desc = desc.replace(/<[^>]*>?/gm, ''); // strip HTML

    return {
      title: `${anime.title?.english || anime.title?.romaji || "Anime"} - CineStream`,
      description: desc,
      openGraph: {
        title: `${anime.title?.english || anime.title?.romaji || "Anime"} - CineStream`,
        description: desc,
        images: ogImage ? [ogImage] : [],
      },
    };
  } catch (error) {
    return {
      title: "Anime - CineStream",
    };
  }
}

export default function AnimePage() {
  return <AnimeClient />;
}
