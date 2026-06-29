import { Metadata } from "next";
import TvClient from "./TvClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}`);
    if (!res.ok) throw new Error("Failed to fetch");
    const show = await res.json();
    return {
      title: `${show.name} - CineStream`,
      description: show.overview,
      openGraph: {
        title: `${show.name} - CineStream`,
        description: show.overview,
        images: show.backdrop_path 
          ? [`https://image.tmdb.org/t/p/w1280${show.backdrop_path}`]
          : show.poster_path 
            ? [`https://image.tmdb.org/t/p/w500${show.poster_path}`]
            : [],
        type: "video.tv_show",
      },
      twitter: {
        card: "summary_large_image",
        title: `${show.name} - CineStream`,
        description: show.overview,
        images: show.backdrop_path 
          ? [`https://image.tmdb.org/t/p/w1280${show.backdrop_path}`]
          : show.poster_path 
            ? [`https://image.tmdb.org/t/p/w500${show.poster_path}`]
            : [],
      },
    };
  } catch (error) {
    return {
      title: "TV Show - CineStream",
    };
  }
}

export default function TvPage() {
  return <TvClient />;
}
