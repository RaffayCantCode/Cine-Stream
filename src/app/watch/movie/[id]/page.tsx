export const runtime = 'edge';
import { cache } from "react";
import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import { isMetadataBotRequest } from "@/lib/metadata-bots";
import { fetchMovieDetails } from "@/lib/tmdb-details";
import WatchMovieClient from "./WatchMovieClient";

interface Props {
  params: Promise<{ id: string }>;
}

// React's per-request cache lets generateMetadata reuse a single TMDB request
// if the movie details are needed more than once during the same render.
const getMovieDetails = cache(fetchMovieDetails);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const urlPath = `/watch/movie/${id}`;

  // Only crawlers/social previews wait for dynamic tags. For real visitors the
  // player shell must stream immediately; WatchMovieClient fills in the title
  // once the movie details arrive.
  if (!(await isMetadataBotRequest())) {
    return constructMediaMetadata({
      title: "CineStream",
      urlPath,
      fallbackDescription: "Stream movies and TV shows in Full HD on CineStream.",
    });
  }

  try {
    const result = await getMovieDetails(id);
    const rawMovie = result?.data as any;

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
        urlPath,
        fallbackDescription: `Watch ${title} on CineStream in Full HD with subtitles.`,
      });
    }
  } catch (error) {
    console.warn(`[generateMetadata] Watch movie metadata failed for ${id}:`, error);
  }

  return constructMediaMetadata({
    title: "CineStream",
    urlPath,
    fallbackDescription: "Stream movies and TV shows in Full HD on CineStream.",
  });
}

export default async function WatchMoviePage({ params }: Props) {
  const { id } = await params;
  return <WatchMovieClient movieId={Number(id)} />;
}
