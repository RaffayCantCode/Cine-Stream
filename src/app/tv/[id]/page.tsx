export const runtime = 'edge';
import { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import { constructMediaMetadata } from "@/lib/social-preview";
import TvClient from "./TvClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const rawShow = await tmdbFetch(`/tv/${id}`).catch(() => null) as any;

    if (rawShow && rawShow.id && !rawShow.adult) {
      const title = rawShow.name || rawShow.title || "TV Show";
      const year = rawShow.first_air_date ? String(rawShow.first_air_date).split("-")[0] : null;

      return constructMediaMetadata({
        title,
        overview: typeof rawShow.overview === "string" ? rawShow.overview : "",
        backdropPath: typeof rawShow.backdrop_path === "string" ? rawShow.backdrop_path : null,
        posterPath: typeof rawShow.poster_path === "string" ? rawShow.poster_path : null,
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
