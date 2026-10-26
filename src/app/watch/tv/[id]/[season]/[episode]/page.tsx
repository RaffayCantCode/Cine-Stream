export const runtime = 'edge';
import { cache } from "react";
import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import { isMetadataBotRequest } from "@/lib/metadata-bots";
import { fetchTvDetails } from "@/lib/tmdb-details";
import WatchTvClient from "./WatchTvClient";

interface Props {
  params: Promise<{ id: string; season: string; episode: string }>;
}

// React's per-request cache lets generateMetadata reuse a single TMDB request
// if the show details are needed more than once during the same render.
const getTvDetails = cache(fetchTvDetails);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, season, episode } = await params;
  const urlPath = `/watch/tv/${id}/${season}/${episode}`;

  // Only crawlers/social previews wait for dynamic tags. For real visitors the
  // player shell must stream immediately; WatchTvClient fills in the title once
  // the show details arrive.
  if (!(await isMetadataBotRequest())) {
    return constructMediaMetadata({
      title: "CineStream",
      urlPath,
      fallbackDescription: "Stream TV series in Full HD on CineStream.",
    });
  }

  try {
    const result = await getTvDetails(id);
    const rawShow = result?.data as any;

    if (rawShow && rawShow.id && !rawShow.adult) {
      const title = rawShow.name || rawShow.title || "TV Show";
      const year = rawShow.first_air_date ? String(rawShow.first_air_date).split("-")[0] : null;

      return constructMediaMetadata({
        title,
        overview: typeof rawShow.overview === "string" ? rawShow.overview : "",
        backdropPath: typeof rawShow.backdrop_path === "string" ? rawShow.backdrop_path : null,
        posterPath: typeof rawShow.poster_path === "string" ? rawShow.poster_path : null,
        releaseYear: year,
        mediaTypeLabel: "TV Series",
        urlPath,
        fallbackDescription: `Watch ${title} S${season} E${episode} on CineStream in Full HD with English subtitles.`,
      });
    }
  } catch (error) {
    console.warn(`[generateMetadata] Watch TV metadata failed for ${id}:`, error);
  }

  return constructMediaMetadata({
    title: "CineStream",
    urlPath,
    fallbackDescription: "Stream TV series in Full HD on CineStream.",
  });
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
