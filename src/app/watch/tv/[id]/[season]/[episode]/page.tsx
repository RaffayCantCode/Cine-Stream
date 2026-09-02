import { Metadata } from "next";
import WatchTvClient from "./WatchTvClient";

interface Props {
  params: Promise<{ id: string; season: string; episode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, season, episode } = await params;
  return {
    title: `Watch TV S${season} E${episode} | Cine-Stream`,
    description: `Stream TV series on Cine-Stream`,
  };
}

export default async function WatchTvPage({ params }: Props) {
  const { id, season, episode } = await params;
  return (
    <WatchTvClient
      showId={Number(id)}
      seasonNumber={Number(season) || 1}
      episodeNumber={Number(episode) || 1}
    />
  );
}
