export const runtime = 'edge';
import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import { isMetadataBotRequest } from "@/lib/metadata-bots";
import { fetchLightweightAnimeMetaCached } from "@/lib/anime-light-meta";
import AnimeClient from "./AnimeClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  // Only crawlers/social previews wait for dynamic tags. Real visitors get the
  // route immediately so AnimeClient can load and reveal cleanly without
  // blocking navigation on an extra server-side AniList/Kitsu round-trip.
  if (!(await isMetadataBotRequest())) {
    return constructMediaMetadata({
      title: "Anime",
      mediaTypeLabel: "Anime",
      urlPath: `/anime/${id}`,
      fallbackDescription: "Watch anime with Japanese audio and English subtitles on CineStream.",
    });
  }

  try {
    const meta = await fetchLightweightAnimeMetaCached(id);
    if (meta) {
      return constructMediaMetadata({
        title: meta.title,
        overview: meta.overview,
        backdropPath: meta.bannerUrl,
        posterPath: meta.posterUrl,
        mediaTypeLabel: "Anime",
        urlPath: `/anime/${id}`,
        fallbackDescription: `Watch ${meta.title} on CineStream in Full HD with Japanese audio and English subtitles.`,
      });
    }
  } catch (error) {
    console.warn(`[generateMetadata] Anime metadata failed for ${id}:`, error);
  }

  return constructMediaMetadata({
    title: "Anime",
    mediaTypeLabel: "Anime",
    urlPath: `/anime/${id}`,
    fallbackDescription: "Watch anime with Japanese audio and English subtitles on CineStream.",
  });
}

export default async function AnimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnimeClient key={id} />;
}
