"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, Info, Star, Calendar } from "lucide-react";
import { isTmdbAnime, cn } from "@/lib/utils";

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
  const [usePoster, setUsePoster] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  if (!item) return null;

  const isMovie = item.media_type === "movie" || !!item.title;
  const isAnime = item.media_type === "anime" || !!(item as any).anilistId || isTmdbAnime(item);
  const title = item.title || item.name || "";
  let link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;

  if (item.media_type === "anime" || (item as any).anilistId) {
    const animeId = (item as any).anilistId || item.id;
    link = `/anime/${animeId}`;
  } else if (isAnime) {
    link = `/api/anime/redirect?tmdbId=${item.id}&type=${isMovie ? 'movie' : 'tv'}&title=${encodeURIComponent(title)}`;
  }
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating = item.vote_average ?? 0;

  const resolveImageUrl = (path?: string) =>
    path
      ? path.startsWith("http")
        ? path
        : `https://image.tmdb.org/t/p/w1280${path}`
      : null;

  // Anime slides (3rd hero card) often have a banner-only backdrop. If that
  // banner fails to load, gracefully fall back to the poster so the card never
  // renders a broken/empty image.
  const backdropUrl = resolveImageUrl(usePoster ? item.poster_path : item.backdrop_path);
  const showBackdrop = !imgFailed && !!backdropUrl;

  return (
    <section className="relative w-full h-[82svh] min-h-[480px] max-h-[700px] sm:h-[58vw] sm:max-h-[610px] md:h-[72vh] flex items-end bg-background overflow-hidden">
      {showBackdrop ? (
        <>
          {/* Image clipped independently so gradients can bleed outside section */}
          <div className="absolute inset-0 overflow-hidden">
            <Image
              src={backdropUrl!}
              alt={title}
              fill
              sizes="100vw"
              className="object-cover object-center md:object-top"
              style={{
                transform: "scale(1.02)",
                animation: "fade-in-up 1s ease-out both",
                filter: "brightness(0.82) saturate(1.05)",
              }}
              priority
              onError={() => {
                if (!usePoster && item.poster_path && item.poster_path !== item.backdrop_path) {
                  setUsePoster(true);
                } else {
                  setImgFailed(true);
                }
              }}
            />
          </div>

          {/* Bottom -> top scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/45 to-transparent" />

          {/* Left -> right scrim */}
          <div className="hidden md:block absolute inset-y-0 left-0 w-full bg-gradient-to-r from-background/82 via-background/35 to-transparent" />

          {/* Mobile scrim */}
          <div className="md:hidden absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-background/90 via-background/45 to-transparent" />

          {/* Soft top edge */}
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-background/35 to-transparent" />

          {/* Radial spotlight scrim */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 65% 75% at 22% 78%, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 70%)",
            }}
          />

          {/* Bottom blend */}
          <div
            className="absolute inset-x-0 bg-gradient-to-t from-background via-background/70 to-transparent"
            style={{ bottom: "0rem", height: "5rem" }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-card flex items-end justify-start p-6 md:p-10">
          <span className="text-white/50 font-bold text-2xl md:text-4xl line-clamp-2 max-w-2xl drop-shadow-lg">
            {title}
          </span>
        </div>
      )}

      <div className="relative z-10 w-full px-5 md:px-12 lg:px-16 xl:px-20 pb-8 sm:pb-9 md:pb-12 max-w-screen-2xl mx-auto">
        <div
          className="max-w-full sm:max-w-lg md:max-w-2xl flex flex-col items-center text-center md:items-start md:text-left mx-auto md:mx-0 rounded-2xl md:bg-transparent bg-black/12 md:backdrop-blur-0 px-4 py-5 md:p-0"
          style={SECTION_STYLE}
        >
          {/* Tags row */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-2.5 mb-2.5">
            {rating > 0 && item.vote_count && item.vote_count > 20 && (
              <span className="flex items-center gap-1 bg-black/55 backdrop-blur-sm text-amber-400 text-xs font-extrabold px-2.5 py-1 rounded-lg border border-white/10 shadow-sm">
                <Star className="w-3.5 h-3.5 fill-current" />
                {rating.toFixed(1)}
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white/90 text-xs font-semibold px-2.5 py-1 rounded-lg border border-white/10">
                <Calendar className="w-3.5 h-3.5" />
                {year}
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-1 text-xs font-black px-3 py-1 rounded-lg uppercase tracking-wider backdrop-blur-md border transition-all shadow-md",
                isAnime
                  ? "bg-purple-500/30 text-purple-300 border-purple-400/40 shadow-purple-500/25"
                  : isMovie
                  ? "bg-red-500/25 text-red-400 border-red-500/40 shadow-red-500/25"
                  : "bg-emerald-500/25 text-emerald-300 border-emerald-400/40 shadow-emerald-500/25"
              )}
            >
              {isAnime ? "Anime" : isMovie ? "Movie" : "TV Show"}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-white font-black mb-2.5 line-clamp-2"
            style={{
              fontSize:
                title.length > 50
                  ? "clamp(1.5rem, 3vw, 2.4rem)"
                  : title.length > 30
                  ? "clamp(1.75rem, 3.8vw, 3rem)"
                  : "clamp(2rem, 4.8vw, 3.75rem)",
              textShadow:
                "0 2px 6px rgba(0,0,0,0.7), 0 8px 26px rgba(0,0,0,0.5)",
              lineHeight: 1.1,
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
              href={`${link}${link.includes("?") ? "&autoplay=1" : "?autoplay=1"}`}
              className="inline-flex items-center gap-2.5 bg-[#D3D1CE] hover:bg-white text-[#090F15] font-extrabold px-6 py-3.5 rounded-xl text-sm transition-all duration-300 shadow-xl shadow-black/50 hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
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
