export const runtime = 'edge';
import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import AnimeClient from "./AnimeClient";

async function fetchLightweightAnimeMeta(id: string): Promise<{
  title: string;
  overview: string;
  bannerUrl: string | null;
  posterUrl: string | null;
} | null> {
  const clean = String(id || "").trim();
  if (clean.startsWith("kitsu-")) {
    const kid = clean.replace("kitsu-", "");
    const res = await fetch(`https://kitsu.io/api/edge/anime/${encodeURIComponent(kid)}`, {
      signal: AbortSignal.timeout(1200),
      headers: { Accept: "application/vnd.api+json" },
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const attr = res?.data?.attributes;
    if (attr) {
      return {
        title: attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || "Anime",
        overview: (attr.synopsis || attr.description || "").slice(0, 300),
        bannerUrl: attr.coverImage?.large || attr.coverImage?.original || null,
        posterUrl: attr.posterImage?.large || attr.posterImage?.medium || null,
      };
    }
    return null;
  }

  const numId = parseInt(clean.replace(/^mal-/, ""), 10);
  if (!isNaN(numId) && numId > 0) {
    const isMal = clean.startsWith("mal-");
    const query = isMal
      ? `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { title { english romaji native } bannerImage coverImage { extraLarge large } description } }`
      : `query ($id: Int) { Media(id: $id, type: ANIME) { title { english romaji native } bannerImage coverImage { extraLarge large } description } }`;
    const variables = isMal ? { idMal: numId } : { id: numId };
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(1200),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const m = res?.data?.Media;
    if (m) {
      return {
        title: m.title?.english || m.title?.romaji || m.title?.native || "Anime",
        overview: (m.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
        bannerUrl: m.bannerImage || m.coverImage?.extraLarge || null,
        posterUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
      };
    }
  }

  return null;
}

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const meta = await fetchLightweightAnimeMeta(id).catch(() => null);
    if (meta) {
      return constructMediaMetadata({
        title: meta.title,
        overview: meta.overview,
        backdropPath: meta.bannerUrl,
        posterPath: meta.posterUrl,
        mediaTypeLabel: "Anime",
        urlPath: `/anime/${id}`,
        fallbackDescription: `Watch ${meta.title} on CineStream in Full HD with Japanese audio and English subtitles.`,
      });
    }
  } catch (error) {
    console.warn(`[generateMetadata] Anime metadata failed for ${id}:`, error);
  }

  return constructMediaMetadata({
    title: "Anime",
    mediaTypeLabel: "Anime",
    urlPath: `/anime/${id}`,
    fallbackDescription: "Watch anime with Japanese audio and English subtitles on CineStream.",
  });
}

export default function AnimePage() {
  return <AnimeClient />;
}
