import { Metadata } from "next";
import WatchAnimeClient from "./WatchAnimeClient";

interface Props {
  params: Promise<{ id: string; episode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, episode } = await params;
  return {
    title: `Watch Anime Ep ${episode} | Cine-Stream`,
    description: `Stream anime episodes in HD on Cine-Stream`,
  };
}

export default async function WatchAnimePage({ params }: Props) {
  const { id, episode } = await params;
  return (
    <WatchAnimeClient
      animeId={id}
      episodeNumber={Number(episode) || 1}
    />
  );
}
