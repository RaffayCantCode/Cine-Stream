export const runtime = 'edge';
import { cache } from "react";
import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import { fetchTvDetails } from "@/lib/tmdb-details";
import TvClient from "./TvClient";

// React's per-request cache lets generateMetadata and the page share one TMDB
// request (including the bundled first season) during a single render.
const getTvDetails = cache(fetchTvDetails);

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const result = await getTvDetails(id);
    const rawShow = result?.data as any;

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

export default async function TvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTvDetails(id).catch(() => null);

  return (
    <TvClient
      key={id}
      initialData={(result?.data ?? null) as any}
      initialHidden={Boolean(result?.hidden)}
    />
  );
}
