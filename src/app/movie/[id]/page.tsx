export const runtime = 'edge';
import type { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import { constructMediaMetadata } from "@/lib/social-preview";
import MovieClient from "./MovieClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const rawMovie = await tmdbFetch(`/movie/${id}`).catch(() => null) as any;

    if (rawMovie && rawMovie.id && !rawMovie.adult) {
      const title = rawMovie.title || rawMovie.name || "Movie";
      const year = rawMovie.release_date ? String(rawMovie.release_date).split("-")[0] : null;

      return constructMediaMetadata({
        title,
        overview: typeof rawMovie.overview === "string" ? rawMovie.overview : "",
        backdropPath: typeof rawMovie.backdrop_path === "string" ? rawMovie.backdrop_path : null,
        posterPath: typeof rawMovie.poster_path === "string" ? rawMovie.poster_path : null,
        releaseYear: year,
        mediaTypeLabel: "Movie",
        urlPath: `/movie/${id}`,
        fallbackDescription: `Watch ${title} on CineStream in Full HD with subtitles. Stream movies, TV shows, and anime online.`,
      });
    }
  } catch (error) {
    console.warn(`[generateMetadata] Movie metadata failed for ${id}:`, error);
  }

  return constructMediaMetadata({
    title: "Movie",
    mediaTypeLabel: "Movie",
    urlPath: `/movie/${id}`,
    fallbackDescription: "Stream movies and TV shows in Full HD on CineStream.",
  });
}

export default function MoviePage() {
  return <MovieClient />;
}
