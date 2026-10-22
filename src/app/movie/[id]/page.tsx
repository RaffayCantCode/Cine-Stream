export const runtime = 'edge';
import { cache } from "react";
import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import { isMetadataBotRequest } from "@/lib/metadata-bots";
import { fetchMovieDetails } from "@/lib/tmdb-details";
import MovieClient from "./MovieClient";

// React's per-request cache lets generateMetadata and the page share one TMDB
// request instead of fetching the same movie twice during a single render.
const getMovieDetails = cache(fetchMovieDetails);

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  // Only crawlers/social previews wait for dynamic tags. For real visitors the
  // page shell must stream immediately; the client fills in the title later.
  if (!(await isMetadataBotRequest())) {
    return constructMediaMetadata({
      title: "Movie",
      mediaTypeLabel: "Movie",
      urlPath: `/movie/${id}`,
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

export default async function MoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Never await TMDB in the page itself. The route commits immediately, the
  // loading shell paints, and the client fetches details (usually from the
  // hover-prefetched cache). This is what makes every click feel instant even
  // when TMDB is slow or a Cloudflare cold start is involved.
  return <MovieClient key={id} initialData={null} initialHidden={false} />;
}
