export const runtime = 'edge';
import { Metadata } from "next";
import { cache } from "react";
import AnimeClient from "./AnimeClient";

// Shared AniList query — fetches enough fields for BOTH <head> metadata AND
// the first-paint of AnimeClient. The result is produced once server-side and
// serialised into the HTML payload; the client hydrates instantly with no
// extra round-trip for the basic poster/title/description view.
const INITIAL_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME, isAdult: false) {
    id idMal
    title { romaji english native }
    description
    coverImage { extraLarge large }
    bannerImage
    episodes genres averageScore
    status type format season seasonYear duration
    trailer { id site }
    nextAiringEpisode { episode airingAt timeUntilAiring }
  }
}`;

interface InitialAnimeData {
  id: string;
  idMal: string | null;
  name: string;
  jname: string | null;
  poster: string;
  description: string;
  type: string | null;
  rating: string | null;
  status: string | null;
  genres: string[];
  totalEpisodes: number;
  seasons: [];
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  openedSeasonId: string;
  tmdbId: null;
  duration: number | null;
  trailerId: string | null;
  bannerImage: string | null;
}

const fetchInitialAnimeData = cache(async function fetchInitialAnimeData(id: string): Promise<{ meta: Metadata; initialData: InitialAnimeData | null }> {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return { meta: { title: "Anime - CineStream" }, initialData: null };
  }

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: INITIAL_QUERY, variables: { id: numId } }),
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 86400 },
    });

    if (!res.ok) throw new Error("AniList fetch failed");
    const json = await res.json();
    const anime = json?.data?.Media;
    if (!anime) throw new Error("No media found");

    // Strip HTML from description
    let desc = (anime.description || "").replace(/<[^>]*>?/gm, '');

    const title = anime.title?.english || anime.title?.romaji || "Anime";
    const poster = anime.coverImage?.extraLarge || anime.coverImage?.large || "";

    const meta: Metadata = {
      title: `${title} - CineStream`,
      description: desc,
      openGraph: {
        title: `${title} - CineStream`,
        description: desc,
        images: poster ? [poster] : [],
      },
    };

    const initialData: any = {
      id: String(anime.id),
      idMal: anime.idMal ? String(anime.idMal) : null,
      name: title,
      jname: anime.title?.native || null,
      poster,
      description: desc,
      type: anime.format || anime.type || null,
      rating: anime.averageScore ? String((anime.averageScore / 10).toFixed(1)) : null,
      status: anime.status || null,
      genres: anime.genres || [],
      totalEpisodes: anime.episodes || 12,
      seasons: [{
        id: String(anime.id),
        name: title,
        seasonLabel: "Season 1",
        totalEpisodes: anime.episodes || 12,
        isCurrent: true,
        idMal: anime.idMal ? Number(anime.idMal) : null,
        seasonYear: anime.seasonYear || null,
      }],
      season: anime.season || null,
      seasonYear: anime.seasonYear || null,
      format: anime.format || null,
      openedSeasonId: String(anime.id),
      tmdbId: null,
      duration: anime.duration || null,
      trailerId: (anime.trailer?.site === "youtube" ? anime.trailer.id : null) ?? null,
      bannerImage: anime.bannerImage || null,
      nextAiringEpisode: anime.nextAiringEpisode || null,
    };

    return { meta, initialData };
  } catch {
    return { meta: { title: "Anime - CineStream" }, initialData: null };
  }
});

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await props.params;
  const { meta } = await fetchInitialAnimeData(id);
  return meta;
}

export default async function AnimePage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const { initialData } = await fetchInitialAnimeData(id);
  return <AnimeClient initialData={initialData} />;
}
