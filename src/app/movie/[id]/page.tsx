export const runtime = 'edge';
import { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";
import { constructMediaMetadata } from "@/lib/social-preview";
import MovieClient from "./MovieClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const [rawMovie, override] = await Promise.all([
      tmdbFetch(`/movie/${id}`).catch(() => null),
      getMediaOverride("movie", id).catch(() => null),
    ]);

    const movie = applyMediaOverride(rawMovie as any, override) as any;

    if (movie && !movie.isHidden) {
      const title = movie.title || movie.name || "Movie";
      const year = movie.release_date ? String(movie.release_date).split("-")[0] : null;

      return constructMediaMetadata({
        title,
        overview: typeof movie.overview === "string" ? movie.overview : "",
        backdropPath: typeof movie.backdrop_path === "string" ? movie.backdrop_path : null,
        posterPath: typeof movie.poster_path === "string" ? movie.poster_path : null,
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
