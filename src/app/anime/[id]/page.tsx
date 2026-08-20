export const runtime = 'edge';
import { Metadata } from "next";
import AnimeClient from "./AnimeClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  try {
    const params = await props.params;
    const id = params.id;
    const isMal = id?.startsWith("mal-");
    const isKitsu = id?.startsWith("kitsu-");
    const numId = parseInt(id?.replace(/^(mal-|kitsu-|tmdb-)/, "") || "", 10);

    if (!isNaN(numId) && !isKitsu) {
      const q = isMal
        ? `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME, isAdult: false) { title { english romaji } description coverImage { large extraLarge } } }`
        : `query ($id: Int) { Media(id: $id, type: ANIME, isAdult: false) { title { english romaji } description coverImage { large extraLarge } } }`;
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query: q, variables: isMal ? { idMal: numId } : { id: numId } }),
        signal: AbortSignal.timeout(3000),
      }).then(r => r.json()).catch(() => null);

      const media = res?.data?.Media;
      if (media) {
        const title = media.title?.english || media.title?.romaji || "Anime";
        const desc = (media.description || "").replace(/<[^>]*>/g, "").slice(0, 200);
        const poster = media.coverImage?.extraLarge || media.coverImage?.large;
        return {
          title: `${title} - CineStream`,
          description: desc,
          openGraph: {
            title: `${title} - CineStream`,
            description: desc,
            images: poster ? [poster] : [],
          },
          twitter: {
            card: "summary_large_image",
            title: `${title} - CineStream`,
            description: desc,
            images: poster ? [poster] : [],
          },
        };
      }
    }
  } catch {}

  return {
    title: "Anime - CineStream",
    description: "Watch anime on CineStream",
  };
}

export default function AnimePage() {
  return <AnimeClient />;
}

