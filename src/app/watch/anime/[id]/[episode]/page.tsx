export const runtime = 'edge';
import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import { isMetadataBotRequest } from "@/lib/metadata-bots";
import { fetchLightweightAnimeMetaCached } from "@/lib/anime-light-meta";
import WatchAnimeClient from "./WatchAnimeClient";

interface Props {
  params: Promise<{ id: string; episode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, episode } = await params;
  const urlPath = `/watch/anime/${id}/${episode}`;

  // Only crawlers/social previews wait for dynamic tags. For real visitors the
  // player shell must stream immediately; WatchAnimeClient fills in the title
  // once the anime details arrive.
  if (!(await isMetadataBotRequest())) {
    return constructMediaMetadata({
      title: "CineStream",
      urlPath,
      fallbackDescription: "Stream anime episodes in HD on CineStream.",
    });
  }

  try {
    const meta = await fetchLightweightAnimeMetaCached(id);
    if (meta) {
      return constructMediaMetadata({
        title: meta.title,
        overview: meta.overview,
        backdropPath: meta.bannerUrl,
        posterPath: meta.posterUrl,
        mediaTypeLabel: "Anime",
        urlPath,
        fallbackDescription: `Watch ${meta.title} Episode ${episode} on CineStream in Full HD with Japanese audio and English subtitles.`,
      });
    }
  } catch (error) {
    console.warn(`[generateMetadata] Watch anime metadata failed for ${id}:`, error);
  }

  return constructMediaMetadata({
    title: "CineStream",
    urlPath,
    fallbackDescription: "Stream anime episodes in HD on CineStream.",
  });
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
