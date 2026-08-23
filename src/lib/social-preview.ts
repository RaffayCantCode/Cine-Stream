import { Metadata } from "next";

export interface MediaMetadataOptions {
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  type?: "website" | "video.movie" | "video.tv_show";
  urlPath?: string;
  fallbackDescription?: string;
}

export function constructMediaMetadata(options: MediaMetadataOptions): Metadata {
  const siteUrl = "https://cine-stream.site";
  const title = options.title ? `${options.title} — CineStream` : "CineStream";
  const description =
    (options.overview && options.overview.length > 200
      ? `${options.overview.slice(0, 197)}...`
      : options.overview) ||
    options.fallbackDescription ||
    "Stream movies, TV shows, anime, and read manga online for free on CineStream.";

  const canonicalUrl = options.urlPath ? `${siteUrl}${options.urlPath}` : siteUrl;

  const imageUrl =
    options.backdropPath ||
    options.posterPath ||
    `${siteUrl}/icon.png?v=22`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "CineStream",
      images: [
        {
          url: imageUrl,
          width: 1280,
          height: 720,
          alt: options.title || "CineStream Media",
        },
      ],
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
