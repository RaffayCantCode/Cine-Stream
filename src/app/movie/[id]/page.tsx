export const runtime = 'edge';
import { Metadata } from "next";
import { tmdbFetch } from "@/lib/tmdb";
import { getMediaOverride, applyMediaOverride } from "@/lib/media-overrides";
import MovieClient from "./MovieClient";

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
  const pageUrl = `${SITE_URL}/movie/${id}`;

  try {
    const [rawMovie, override] = await Promise.all([
      tmdbFetch(`/movie/${id}`).catch(() => null),
      getMediaOverride("movie", id).catch(() => null),
    ]);

    const movie = applyMediaOverride(rawMovie as any, override) as any;

    if (movie && !movie.isHidden) {
      const title = movie.title || "Movie";
      const pageTitle = `${title} - ${SITE_NAME}`;
      const desc = cleanOverview(movie.overview) || `Watch ${title} on CineStream in full HD. Stream movies, TV shows, and anime online.`;
      
      const backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;
      const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : null;
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
          type: "video.movie",
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
    console.warn(`[generateMetadata] Movie metadata failed for ${id}:`, error);
  }

  return {
    title: `Movie - ${SITE_NAME}`,
    description: "Stream movies and TV shows in full HD on CineStream.",
    openGraph: {
      title: `Movie - ${SITE_NAME}`,
      description: "Stream movies and TV shows in full HD on CineStream.",
      url: pageUrl,
      siteName: SITE_NAME,
      images: [{ url: FALLBACK_IMAGE, width: 512, height: 512, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Movie - ${SITE_NAME}`,
      description: "Stream movies and TV shows in full HD on CineStream.",
      images: [FALLBACK_IMAGE],
    },
  };
}

export default function MoviePage() {
  return <MovieClient />;
}

