export const runtime = 'edge';
import { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";
import TvClient from "./TvClient";

const SITE_NAME = "CineStream";
const SITE_URL = "https://cine-stream.site";
const FALLBACK_IMAGE = `${SITE_URL}/icon-512.png`;

function cleanOverview(text?: string | null, maxLength = 180): string {
  if (!text) return "";
  const cleaned = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
  const pageUrl = `${SITE_URL}/tv/${id}`;

  try {
    const [rawShow, override] = await Promise.all([
      tmdbFetch(`/tv/${id}`).catch(() => null),
      getMediaOverride("tv", id).catch(() => null),
    ]);

    const show = applyMediaOverride(rawShow as any, override) as any;

    if (show && !show.isHidden) {
      const title = show.name || show.title || "TV Show";
      const pageTitle = `${title} - ${SITE_NAME}`;
      const desc = cleanOverview(show.overview) || `Watch ${title} on CineStream in full HD. Stream TV shows, movies, and anime online.`;
      
      const backdropUrl = show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null;
      const posterUrl = show.poster_path ? `https://image.tmdb.org/t/p/w780${show.poster_path}` : null;
      const primaryImage = backdropUrl || posterUrl || FALLBACK_IMAGE;

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
          type: "video.tv_show",
          images: [
            {
              url: primaryImage,
              width: backdropUrl ? 1280 : posterUrl ? 780 : 512,
              height: backdropUrl ? 720 : posterUrl ? 1170 : 512,
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
    console.warn(`[generateMetadata] TV metadata failed for ${id}:`, error);
  }

  return {
    title: `TV Show - ${SITE_NAME}`,
    description: "Stream movies and TV shows in full HD on CineStream.",
    openGraph: {
      title: `TV Show - ${SITE_NAME}`,
      description: "Stream movies and TV shows in full HD on CineStream.",
      url: pageUrl,
      siteName: SITE_NAME,
      images: [{ url: FALLBACK_IMAGE, width: 512, height: 512, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `TV Show - ${SITE_NAME}`,
      description: "Stream movies and TV shows in full HD on CineStream.",
      images: [FALLBACK_IMAGE],
    },
  };
}

export default function TvPage() {
  return <TvClient />;
}

