export const runtime = 'edge';

import { Metadata } from "next";
import { cache } from "react";
import AnimeClient from "./AnimeClient";
import { buildAnimeCatalog } from "@/lib/anime/catalog";
import type { AnimeCatalog } from "@/lib/anime/types";

const fetchCatalog = cache(async function fetchCatalog(id: string): Promise<AnimeCatalog | null> {
  const built = await buildAnimeCatalog(id);
  return built?.catalog ?? null;
});

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const catalog = await fetchCatalog(id);
    if (catalog?.anime) {
      return {
        title: `${catalog.anime.name} - CineStream`,
        description: catalog.anime.description || undefined,
        openGraph: {
          title: `${catalog.anime.name} - CineStream`,
          description: catalog.anime.description || undefined,
          images: catalog.anime.poster ? [catalog.anime.poster] : [],
        },
      };
    }
  } catch {}
  return { title: "Anime - CineStream" };
}

export default function AnimePage() {
  return <AnimeClient />;
}