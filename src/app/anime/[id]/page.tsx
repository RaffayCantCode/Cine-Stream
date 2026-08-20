export const runtime = 'edge';
import { Metadata } from "next";
import { cache } from "react";
import { redirect } from "next/navigation";
import AnimeClient from "./AnimeClient";
import { cleanAnimeDescription, getAnimeDetailsViaKitsu } from "@/lib/anime-fetch";

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
  seasons: any[];
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  openedSeasonId: string;
  tmdbId: any;
  duration: number | null;
  trailerId: string | null;
  bannerImage: string | null;
}

const fetchInitialAnimeData = cache(async function fetchInitialAnimeData(id: string): Promise<{ meta: Metadata; initialData: InitialAnimeData | null }> {
  try {
    let targetId = id;
    if (id.startsWith("mal-")) {
      const malIdNum = parseInt(id.replace("mal-", ""), 10);
      if (!isNaN(malIdNum)) {
        try {
          const q = `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }`;
          const r = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: q, variables: { idMal: malIdNum } }),
            signal: AbortSignal.timeout(3000),
          }).then(res => res.json()).catch(() => null);
          if (r?.data?.Media?.id) targetId = String(r.data.Media.id);
          else targetId = String(malIdNum);
        } catch { targetId = String(malIdNum); }
      }
    } else if (id.startsWith("tmdb-")) {
      const parts = id.split("-");
      if (parts.length >= 2) {
        const tmdbIdNum = parseInt(parts[1], 10);
        if (!isNaN(tmdbIdNum)) {
          try {
            const azRes = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${tmdbIdNum}`, {
              signal: AbortSignal.timeout(3000),
            }).then(res => res.json()).catch(() => null);
            if (azRes?.mappings?.anilist_id) targetId = String(azRes.mappings.anilist_id);
          } catch { /* ignore */ }
        }
      }
    }

    const numId = parseInt(targetId, 10);
    if (isNaN(numId) || targetId.startsWith("kitsu-")) {
      try {
        const kitsuDetails = await getAnimeDetailsViaKitsu(targetId, 100, true);
        if (kitsuDetails && kitsuDetails.anime) {
          const title = kitsuDetails.anime.name || "Anime";
          const poster = kitsuDetails.anime.poster || "";
          const desc = kitsuDetails.anime.description || "";
          return {
            meta: {
              title: `${title} - CineStream`,
              description: desc,
              openGraph: { title: `${title} - CineStream`, description: desc, images: poster ? [poster] : [] },
            },
            initialData: {
              ...kitsuDetails.anime,
              id: targetId,
              totalEpisodes: kitsuDetails.totalEpisodes || 12,
              seasons: kitsuDetails.seasons as any,
              openedSeasonId: kitsuDetails.openedSeasonId || targetId,
              tmdbId: kitsuDetails.tmdbId as any,
            } as InitialAnimeData,
          };
        }
      } catch {}
      return { meta: { title: "Anime - CineStream" }, initialData: null };
    }

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: INITIAL_QUERY, variables: { id: numId } }),
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 86400 },
      });

      let json = res.ok ? await res.json().catch(() => null) : null;
      let anime = json?.data?.Media;

      if (!anime && !isNaN(numId)) {
        // Fallback 1: Try AniList by MAL ID
        try {
          const malRes = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              query: `query ($idMal: Int) {
                Media(idMal: $idMal, type: ANIME, isAdult: false) {
                  id idMal title { romaji english native } description coverImage { extraLarge large } bannerImage episodes genres averageScore status type format season seasonYear duration trailer { id site } nextAiringEpisode { episode airingAt timeUntilAiring }
                }
              }`,
              variables: { idMal: numId }
            }),
            signal: AbortSignal.timeout(3000),
            next: { revalidate: 86400 },
          }).then(r => r.json()).catch(() => null);
          if (malRes?.data?.Media) {
            anime = malRes.data.Media;
          }
        } catch {}
      }

      if (!anime && !isNaN(numId)) {
        // Fallback 2: Try AniZip mapping for TMDB ID
        try {
          const azRes = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${numId}`, {
            signal: AbortSignal.timeout(3000),
          }).then(r => r.json()).catch(() => null);
          const alId = azRes?.mappings?.anilist_id;
          if (alId) {
            const alRes = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ query: INITIAL_QUERY, variables: { id: alId } }),
              signal: AbortSignal.timeout(3000),
              next: { revalidate: 86400 },
            }).then(r => r.json()).catch(() => null);
            if (alRes?.data?.Media) {
              anime = alRes.data.Media;
            }
          }
        } catch {}
      }

      if (!anime) {
        // Fallback 3: Kitsu + AniZip details fallback (when AniList is down)
        try {
          const kitsuDetails = await getAnimeDetailsViaKitsu(targetId, 100, true);
          if (kitsuDetails && kitsuDetails.anime) {
            const title = kitsuDetails.anime.name || "Anime";
            const poster = kitsuDetails.anime.poster || "";
            const desc = kitsuDetails.anime.description || "";
            return {
              meta: {
                title: `${title} - CineStream`,
                description: desc,
                openGraph: { title: `${title} - CineStream`, description: desc, images: poster ? [poster] : [] },
              },
              initialData: {
                ...kitsuDetails.anime,
                id: targetId,
                totalEpisodes: kitsuDetails.totalEpisodes || 12,
                seasons: kitsuDetails.seasons as any,
                openedSeasonId: kitsuDetails.openedSeasonId || targetId,
                tmdbId: kitsuDetails.tmdbId as any,
              } as InitialAnimeData,
            };
          }
        } catch {}
        return { meta: { title: "Anime - CineStream" }, initialData: null };
      }

      // Strip HTML from description
      let desc = cleanAnimeDescription(anime.description);

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

      const isMovie = anime.format === "MOVIE" || anime.type === "MOVIE";
      const nextEp = anime.nextAiringEpisode?.episode;
      const totalEps = isMovie ? 1 : (anime.episodes || (nextEp ? nextEp - 1 : 1500));

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
        totalEpisodes: totalEps,
        seasons: [{
          id: String(anime.id),
          name: title,
          seasonLabel: isMovie ? "Movie 1" : "Season 1",
          totalEpisodes: totalEps,
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
      try {
        const kitsuDetails = await getAnimeDetailsViaKitsu(id, 100, true);
        if (kitsuDetails && kitsuDetails.anime) {
          const title = kitsuDetails.anime.name || "Anime";
          const poster = kitsuDetails.anime.poster || "";
          const desc = kitsuDetails.anime.description || "";
          return {
            meta: {
              title: `${title} - CineStream`,
              description: desc,
              openGraph: { title: `${title} - CineStream`, description: desc, images: poster ? [poster] : [] },
            },
            initialData: {
              ...kitsuDetails.anime,
              totalEpisodes: kitsuDetails.totalEpisodes || 12,
              seasons: kitsuDetails.seasons as any,
              openedSeasonId: kitsuDetails.openedSeasonId || kitsuDetails.anime.id,
              tmdbId: kitsuDetails.tmdbId as any,
            } as InitialAnimeData,
          };
        }
      } catch {}
      return { meta: { title: "Anime - CineStream" }, initialData: null };
    }
  } catch {
    return { meta: { title: "Anime - CineStream" }, initialData: null };
  }
});

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  try {
    const { id } = await props.params;
    const { meta } = await fetchInitialAnimeData(id);
    return meta || { title: "Anime - CineStream" };
  } catch {
    return { title: "Anime - CineStream" };
  }
}

export default async function AnimePage(
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { initialData } = await fetchInitialAnimeData(id);
    return <AnimeClient initialData={initialData} />;
  } catch (err) {
    console.error("[AnimePage Render Error]:", err);
    return <AnimeClient initialData={null} />;
  }
}
