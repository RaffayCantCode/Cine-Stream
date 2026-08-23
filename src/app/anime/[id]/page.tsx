export const runtime = 'edge';
import { Metadata } from "next";
import { getAnimeDetails } from "@/lib/anime-fetch";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";
import { constructMediaMetadata } from "@/lib/social-preview";
import AnimeClient from "./AnimeClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;

  try {
    const [details, override] = await Promise.all([
      getAnimeDetails(id, 0, true).catch(() => null),
      getMediaOverride("anime", id).catch(() => null),
    ]);

    const rawAnime = details?.anime || null;
    const anime = applyMediaOverride(rawAnime as any, override) as any;

    if (anime && !anime.isHidden) {
      const title = anime.name || anime.title || "Anime";
      const bannerUrl = anime.bannerImage || anime.backdrop || null;
      const posterUrl = anime.poster || null;

      return constructMediaMetadata({
        title,
        overview: anime.description || anime.overview,
        backdropPath: bannerUrl,
        posterPath: posterUrl,
        mediaTypeLabel: "Anime",
        urlPath: `/anime/${id}`,
        fallbackDescription: `Watch ${title} on CineStream in Full HD with Japanese audio and English subtitles.`,
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

export default function AnimePage() {
  return <AnimeClient />;
}
