export const runtime = 'edge';
import { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import MovieClient from "./MovieClient";
import { Suspense } from "react";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;
  try {
    const movie = await tmdbFetch(`/movie/${id}`) as any;
    return {
      title: `${movie.title} - CineStream`,
      description: movie.overview,
      openGraph: {
        title: `${movie.title} - CineStream`,
        description: movie.overview,
        images: movie.backdrop_path 
          ? [`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`]
          : movie.poster_path 
            ? [`https://image.tmdb.org/t/p/w500${movie.poster_path}`]
            : [],
        type: "video.movie",
      },
      twitter: {
        card: "summary_large_image",
        title: `${movie.title} - CineStream`,
        description: movie.overview,
        images: movie.backdrop_path 
          ? [`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`]
          : movie.poster_path 
            ? [`https://image.tmdb.org/t/p/w500${movie.poster_path}`]
            : [],
      },
    };
  } catch (error) {
    return {
      title: "Movie - CineStream",
    };
  }
}

export default function MoviePage() {
  return <MovieClient />;
}
