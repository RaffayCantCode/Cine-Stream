export const runtime = 'edge';
import { Metadata } from "next";
import { getAnimeDetails } from "@/lib/anime-fetch";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";
import AnimeClient from "./AnimeClient";

const SITE_NAME = "CineStream";
const SITE_URL = "https://cine-stream.site";
const FALLBACK_IMAGE = `${SITE_URL}/icon-512.png`;

function cleanOverview(text?: string | null, maxLength = 180): string {
  if (!text) return "";
  const cleaned = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s*\(?\s*Source\s*[:：]\s*[^)]*\)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  const sub = cleaned.slice(0, maxLength);
  const lastSpace = sub.lastIndexOf(" ");
  return `${(lastSpace > 30 ? sub.slice(0, lastSpace) : sub).replace(/[,.;:!? ]+$/, "")}...`;
}

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;
  const pageUrl = `${SITE_URL}/anime/${id}`;

  try {
    const [details, override] = await Promise.all([
      getAnimeDetails(id, 0, true).catch(() => null),
      getMediaOverride("anime", id).catch(() => null),
    ]);

    const rawAnime = details?.anime || null;
    const anime = applyMediaOverride(rawAnime as any, override) as any;

    if (anime && !anime.isHidden) {
      const title = anime.name || anime.title || "Anime";
      const pageTitle = `${title} - ${SITE_NAME}`;
      const desc = cleanOverview(anime.description || anime.overview) || `Watch ${title} on CineStream in full HD. Stream anime episodes with English subtitles.`;

      const bannerUrl = anime.bannerImage || anime.backdrop || null;
      const posterUrl = anime.poster || null;
      const primaryImage = bannerUrl || posterUrl || FALLBACK_IMAGE;

      return {
        title: pageTitle,
        description: desc,
        alternates: { canonical: pageUrl },
        openGraph: {
          title: pageTitle,
          description: desc,
          url: pageUrl,
          siteName: SITE_NAME,
          locale: "en_US",
          type: anime.type === "MOVIE" ? "video.movie" : "video.tv_show",
          images: [
            {
              url: primaryImage,
              width: bannerUrl ? 1280 : posterUrl ? 780 : 512,
              height: bannerUrl ? 720 : posterUrl ? 1170 : 512,
              alt: title,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: pageTitle,
          description: desc,
          images: [primaryImage],
        },
      };
    }
  } catch (error) {
    console.warn(`[generateMetadata] Anime metadata failed for ${id}:`, error);
  }

  return {
    title: `Anime - ${SITE_NAME}`,
    description: "Watch anime with Japanese audio and English subtitles on CineStream.",
    openGraph: {
      title: `Anime - ${SITE_NAME}`,
      description: "Watch anime with Japanese audio and English subtitles on CineStream.",
      url: pageUrl,
      siteName: SITE_NAME,
      images: [{ url: FALLBACK_IMAGE, width: 512, height: 512, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Anime - ${SITE_NAME}`,
      description: "Watch anime with Japanese audio and English subtitles on CineStream.",
      images: [FALLBACK_IMAGE],
    },
  };
}

export default function AnimePage() {
  return <AnimeClient />;
}


