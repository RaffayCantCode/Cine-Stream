"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Info, Star, Calendar } from "lucide-react";
import { isTmdbAnime } from "@/lib/utils";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
}

interface HeroBannerProps {
  item: MediaItem;
}

const SECTION_STYLE: React.CSSProperties = {
  animation: "fade-in-up 0.6s ease-out both",
};

export const HeroBanner = memo(function HeroBanner({ item }: HeroBannerProps) {
  if (!item) return null;

  const isMovie = item.media_type === "movie" || !!item.title;
  const isAnime = isTmdbAnime(item);
  const title = item.title || item.name || "";
  let link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;

  if (isAnime) {
    link = `/api/anime/redirect?tmdbId=${item.id}&type=${isMovie ? 'movie' : 'tv'}&title=${encodeURIComponent(title)}`;
  }
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating = item.vote_average ?? 0;

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
    : null;

  return (
    <section className="relative w-full h-[82svh] min-h-[480px] max-h-[700px] sm:h-[58vw] sm:max-h-[610px] md:h-[72vh] flex items-end bg-background overflow-hidden">
      {backdropUrl ? (
        <>
          {/* Image clipped independently so gradients can bleed outside section */}
          <div className="absolute inset-0 overflow-hidden">
            <Image
              src={backdropUrl}
              alt={title}
              fill
              sizes="100vw"
              className="object-cover object-center md:object-top"
              style={{
                transform: "scale(1.02)",
                animation: "fade-in-up 1s ease-out both",
                // Darken the raw art itself so bright/white backdrops (like
                // high-key anime or action shots) never blow out the text
                // sitting on top of them, no matter the gradient stack below.
                filter: "brightness(0.82) saturate(1.05)",
              }}
              priority
            />
          </div>

          {/* Bottom -> top scrim (always full-bleed, strongest near the text) */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/45 to-transparent" />

          {/* Left -> right scrim, desktop text column */}
          <div className="hidden md:block absolute inset-y-0 left-0 w-full bg-gradient-to-r from-background/82 via-background/35 to-transparent" />

          {/* Mobile: text is centered near the bottom, so widen the bottom scrim instead */}
          <div className="md:hidden absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-background/90 via-background/45 to-transparent" />

          {/* Soft top edge so header/nav overlay never fights bright sky/highlights */}
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-background/35 to-transparent" />

          {/* Radial spotlight scrim centered on where the text block actually sits,
              guarantees contrast even if the gradients above land on a bright patch */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 65% 75% at 22% 78%, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 70%)",
            }}
          />

          {/* Bottom blend — extends below the section edge into the page background */}
          <div
            className="absolute inset-x-0 bg-gradient-to-t from-background via-background/70 to-transparent"
            style={{ bottom: "0rem", height: "5rem" }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-card" />
      )}

      <div className="relative z-10 w-full px-5 md:px-12 lg:px-16 xl:px-20 pb-8 sm:pb-9 md:pb-12 max-w-screen-2xl mx-auto">
        <div
          className="max-w-full sm:max-w-lg md:max-w-2xl flex flex-col items-center text-center md:items-start md:text-left mx-auto md:mx-0 rounded-2xl md:bg-transparent bg-black/12 md:backdrop-blur-0 px-4 py-5 md:p-0"
          style={SECTION_STYLE}
        >
          {/* Tags row */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-2">
            {rating > 0 && item.vote_count && item.vote_count > 20 && (
              <span className="flex items-center gap-1 bg-black/55 backdrop-blur-sm text-amber-400 text-xs font-extrabold px-2 py-1 rounded-md border border-white/10 shadow-sm">
                <Star className="w-3 h-3 fill-current" />
                {rating.toFixed(1)}
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white/90 text-xs font-semibold px-2 py-1 rounded-md border border-white/10">
                <Calendar className="w-3 h-3" />
                {year}
              </span>
            )}
            <span className="bg-black/40 backdrop-blur-sm text-white/85 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider border border-white/10">
              {isAnime ? "Anime" : isMovie ? "Movie" : "TV Show"}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-white font-black leading-none mb-3"
            style={{
              fontSize: "clamp(2rem, 5.4vw, 4.15rem)",
              textShadow:
                "0 2px 6px rgba(0,0,0,0.7), 0 8px 26px rgba(0,0,0,0.5)",
              lineHeight: 1,
            }}
          >
            {title}
          </h1>

          {/* Overview */}
          {item.overview && (
            <p
              className="text-white/90 text-sm sm:text-[15px] leading-relaxed mb-4 max-w-xl line-clamp-3"
              style={{ textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}
            >
              {item.overview}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
            <Link
              href={`${link}${isAnime ? "&autoplay=1" : "?autoplay=1"}`}
              className="inline-flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-5 py-3 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
            >
              <Play className="w-5 h-5 fill-current" />
              Watch Now
            </Link>
            <Link
              href={link}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-all duration-200 border border-white/20 backdrop-blur-sm"
            >
              <Info className="w-4 h-4" />
              More Info
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
});
