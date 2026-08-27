export const runtime = 'edge';
import { Metadata } from "next";
import { getAnimeDetails } from "@/lib/anime-fetch";
import { constructMediaMetadata } from "@/lib/social-preview";
import AnimeClient from "./AnimeClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const details = await getAnimeDetails(id, 0, true).catch(() => null);
    const anime = details?.anime || null;

    if (anime && !(anime as any).isHidden) {
      const title = (anime as any).name || (anime as any).title || "Anime";
      const bannerUrl = (anime as any).bannerImage || (anime as any).backdrop || null;
      const posterUrl = (anime as any).poster || null;

      return constructMediaMetadata({
        title,
        overview: typeof ((anime as any).description || (anime as any).overview) === "string" ? ((anime as any).description || (anime as any).overview) : "",
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

export default function AnimePage() {
  return <AnimeClient />;
}
