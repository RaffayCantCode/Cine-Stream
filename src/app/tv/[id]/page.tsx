export const runtime = 'edge';
import { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";
import { constructMediaMetadata } from "@/lib/social-preview";
import TvClient from "./TvClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const [rawShow, override] = await Promise.all([
      tmdbFetch(`/tv/${id}`).catch(() => null),
      getMediaOverride("tv", id).catch(() => null),
    ]);

    const show = applyMediaOverride(rawShow as any, override) as any;

    if (show && !show.isHidden) {
      const title = show.name || show.title || "TV Show";
      const year = show.first_air_date ? String(show.first_air_date).split("-")[0] : null;

      return constructMediaMetadata({
        title,
        overview: typeof show.overview === "string" ? show.overview : "",
        backdropPath: typeof show.backdrop_path === "string" ? show.backdrop_path : null,
        posterPath: typeof show.poster_path === "string" ? show.poster_path : null,
        releaseYear: year,
        mediaTypeLabel: "TV Series",
        urlPath: `/tv/${id}`,
        fallbackDescription: `Watch ${title} all seasons and episodes on CineStream in Full HD with English subtitles.`,
      });
    }
  } catch (error) {
    console.warn(`[generateMetadata] TV metadata failed for ${id}:`, error);
  }

  return constructMediaMetadata({
    title: "TV Show",
    mediaTypeLabel: "TV Series",
    urlPath: `/tv/${id}`,
    fallbackDescription: "Stream movies and TV shows in Full HD on CineStream.",
  });
}

export default function TvPage() {
  return <TvClient />;
}
