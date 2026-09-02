import { Metadata } from "next";
import WatchMovieClient from "./WatchMovieClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Watch Movie | Cine-Stream`,
    description: `Stream high-definition cinema on Cine-Stream`,
  };
}

export default async function WatchMoviePage({ params }: Props) {
  const { id } = await params;
  return <WatchMovieClient movieId={Number(id)} />;
}
