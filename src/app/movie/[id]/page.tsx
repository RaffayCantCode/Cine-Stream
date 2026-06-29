import { Metadata } from "next";
import MovieClient from "./MovieClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}`);
    if (!res.ok) throw new Error("Failed to fetch");
    const movie = await res.json();
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
