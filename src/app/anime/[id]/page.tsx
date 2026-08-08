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
  const catalog = await fetchCatalog(id);
  if (!catalog) {
    return { title: "Anime - CineStream" };
  }
  const anime = catalog.anime;
  const desc = anime.description || undefined;
  return {
    title: `${anime.name} - CineStream`,
    description: desc,
    openGraph: {
      title: `${anime.name} - CineStream`,
      description: desc,
      images: anime.poster ? [anime.poster] : [],
    },
  };
}

export default async function AnimePage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const catalog = await fetchCatalog(id);
  return <AnimeClient initialData={catalog} />;
}