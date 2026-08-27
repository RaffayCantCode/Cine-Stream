import { Metadata } from "next";

export const SITE_NAME = "CineStream";
export const SITE_URL = "https://cine-stream.site";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/icon-512.png`;

export interface MediaMetadataOptions {
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  type?: "website" | "article";
  urlPath?: string;
  fallbackDescription?: string;
  releaseYear?: string | number | null;
  mediaTypeLabel?: string; // e.g. "Movie", "TV Series", "Anime", "Manhwa", "Manga"
}

export function formatTmdbImageUrl(
  path?: string | null,
  size: "backdrop" | "poster" = "backdrop"
): string | null {
  if (!path || typeof path !== "string") return null;
  const clean = path.trim();
  if (!clean) return null;
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean.replace(/^http:\/\//i, "https://");
  }
  const tmdbPrefix = size === "backdrop" ? "https://image.tmdb.org/t/p/w1280" : "https://image.tmdb.org/t/p/w780";
  return clean.startsWith("/") ? `${tmdbPrefix}${clean}` : `${tmdbPrefix}/${clean}`;
}

export function cleanDescription(text?: string | null, maxLength = 200): string {
  if (!text || typeof text !== "string") return "";
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

export function constructMediaMetadata(options: MediaMetadataOptions): Metadata {
  const cleanTitle = options.title ? options.title.trim() : SITE_NAME;
  const yearStr = options.releaseYear ? ` (${options.releaseYear})` : "";
  const pageTitle = cleanTitle === SITE_NAME ? SITE_NAME : `${cleanTitle}${yearStr} - ${SITE_NAME}`;

  const isReadingMedia = options.mediaTypeLabel === "Manga" || options.mediaTypeLabel === "Manhwa" || options.mediaTypeLabel === "Manhua";
  const defaultDesc = isReadingMedia
    ? `Read ${cleanTitle} online in full color on CineStream with all chapters. Zero ads.`
    : options.mediaTypeLabel
      ? `Stream ${cleanTitle} in Full HD on CineStream. Watch ${options.mediaTypeLabel.toLowerCase()}s, movies, TV shows, and anime online for free.`
      : `Stream ${cleanTitle} in Full HD on CineStream. Watch movies, TV shows, and anime online for free.`;

  const description = cleanDescription(options.overview) || options.fallbackDescription || defaultDesc;

  const canonicalUrl = options.urlPath
    ? `${SITE_URL}${options.urlPath.startsWith("/") ? options.urlPath : `/${options.urlPath}`}`
    : SITE_URL;

  // Resolve best high-resolution images
  const backdrop = formatTmdbImageUrl(options.backdropPath, "backdrop");
  const poster = formatTmdbImageUrl(options.posterPath, "poster");
  const primaryImage = backdrop || poster || DEFAULT_OG_IMAGE;

  const imagesList = [];
  if (backdrop) {
    imagesList.push({
      url: backdrop,
      secureUrl: backdrop,
      width: 1280,
      height: 720,
      alt: cleanTitle,
      type: "image/jpeg",
    });
  }
  if (poster && poster !== backdrop) {
    imagesList.push({
      url: poster,
      secureUrl: poster,
      width: 780,
      height: 1170,
      alt: `${cleanTitle} Poster`,
      type: "image/jpeg",
    });
  }
  if (imagesList.length === 0) {
    imagesList.push({
      url: DEFAULT_OG_IMAGE,
      secureUrl: DEFAULT_OG_IMAGE,
      width: 512,
      height: 512,
      alt: SITE_NAME,
      type: "image/png",
    });
  }

  return {
    title: pageTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website", // Always use "website" so Discord/Twitter/WhatsApp embed cards render rich previews
      images: imagesList,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [primaryImage],
      site: "@CineStream",
      creator: "@CineStream",
    },
    other: {
      "theme-color": "#6366f1",
      "og:image:alt": cleanTitle,
      "twitter:image:alt": cleanTitle,
    },
  };
}
