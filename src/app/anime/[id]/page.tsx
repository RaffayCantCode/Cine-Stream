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
  const id = params?.id || "";

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
        overview: typeof (anime.description || anime.overview) === "string" ? (anime.description || anime.overview) : "",
        backdropPath: typeof bannerUrl === "string" ? bannerUrl : null,
        posterPath: typeof posterUrl === "string" ? posterUrl : null,
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

export default async function AnimePage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const id = params?.id || "";

  let initialData: any = null;
  try {
    const [details, override] = await Promise.all([
      getAnimeDetails(id, 0, true).catch(() => null),
      getMediaOverride("anime", id).catch(() => null),
    ]);

    if (details?.anime) {
      const merged = applyMediaOverride({
        ...details.anime,
        seasons: details.seasons || [],
        franchiseNodes: details.franchiseNodes || [],
        tmdbId: details.tmdbId || null,
        tmdbSeasonMap: details.tmdbSeasonMap || {},
      }, override);
      initialData = merged;
    }
  } catch (err) {
    console.warn(`[AnimePage] Server initialData load failed for ${id}:`, err);
  }

  return <AnimeClient initialData={initialData} />;
}
