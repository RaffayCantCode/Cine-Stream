import { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import TvClient from "./TvClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;
  try {
    const show = await tmdbFetch(`/tv/${id}`) as any;
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
