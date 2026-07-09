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
    const res = await fetch(`https://api.tatakai.me/meta/anilist/info/${id}?provider=zoro`);
    if (!res.ok) throw new Error("Failed to fetch");
    const anime = await res.json();
    
    // Fallback images
    const ogImage = anime.cover || anime.image;
    
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
