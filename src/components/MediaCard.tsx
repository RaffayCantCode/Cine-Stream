"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Play } from "lucide-react";
import { isTmdbAnime } from "@/lib/utils";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
  genre_ids?: number[];
  profile_path?: string;
}

interface MediaCardProps {
  item: MediaItem;
  index?: number;
  rank?: number;
  priority?: boolean;
  showMediaBadge?: boolean;
}

const CARD_WRAPPER_STYLE: React.CSSProperties = {
  animation: "fade-in-up 0.35s ease-out both",
};

export function MediaCard({ item, index = 0, rank, priority, showMediaBadge = false }: MediaCardProps) {
  const isPerson = item.media_type === "person";
  const isManga = item.media_type === "manga" || item.media_type === "manhwa";
  const rawTargetUrl = (item as any).targetUrl || (item as any).target_url;
  const isAnime =
    item.media_type === "anime" ||
    (item as any).isTmdbAnime ||
    Boolean((item as any).anilistId) ||
    String(rawTargetUrl || "").includes("/anime/") ||
    isTmdbAnime(item);
  const isTv = !isAnime && (item.media_type === "tv" || (!isPerson && !isManga && !!item.first_air_date && !item.release_date));
  const isMovie = !isAnime && (item.media_type === "movie" || (!isPerson && !isTv && !isManga));

  const title = item.title || item.name || "";
  let link = rawTargetUrl;
  if (isManga && (!link || !link.startsWith("/manga/"))) {
    link = `/manga/${item.id}`;
  } else if (isAnime) {
    if (!link || !link.startsWith("/anime/")) {
      const rawId = String(item.id);
      const aId = (item as any).anilistId || (rawId.startsWith("tmdb-") || rawId.startsWith("kitsu-") ? rawId : `tmdb-${rawId}`);
      link = `/anime/${aId}`;
    }
  } else if (!link) {
    link = isPerson
      ? `/person/${item.id}`
      : isTv
      ? `/tv/${item.id}`
      : `/movie/${item.id}`;
  }

  const initialPosterUrl = item.profile_path 
    ? (item.profile_path.startsWith("http") ? item.profile_path : `https://image.tmdb.org/t/p/w780${item.profile_path}`)
    : item.poster_path
    ? (item.poster_path.startsWith("http") ? item.poster_path : `https://image.tmdb.org/t/p/w780${item.poster_path}`)
    : null;

  const [imgSrc, setImgSrc] = useState<string | null>(initialPosterUrl);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setImgSrc(initialPosterUrl);
    setHasError(false);
    setIsLoaded(false);
  }, [initialPosterUrl]);

  const handleImageError = () => {
    if (imgSrc && imgSrc.includes("/w780/")) {
      setImgSrc(imgSrc.replace("/w780/", "/w500/"));
    } else {
      setHasError(true);
    }
  };

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);

  return (
    <div
      className="row-item w-full relative hover:z-30 pt-2 -mt-2"
      style={{ ...CARD_WRAPPER_STYLE, animationDelay: `${index * 0.03}s` }}
    >
      <Link
        href={link}
        prefetch={false}
        className={`group relative block shrink-0 transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-2 hover:z-20 focus:outline-none ${
          rank ? "w-[155px] sm:w-[185px] md:w-[212px] lg:w-[230px]" : "w-full"
        }`}
        style={{ transformOrigin: "center center" }}
      >
        {rank && (
          <div 
            className={`absolute bottom-[-10px] font-black leading-none z-0 select-none pointer-events-none tracking-tighter ${
              rank === 1
                ? "-left-2 sm:-left-3 text-[100px] sm:text-[120px] md:text-[142px]"
                : rank === 10
                ? "-left-4 sm:-left-5 text-[82px] sm:text-[100px] md:text-[118px]"
                : "-left-3 sm:-left-4 text-[102px] sm:text-[122px] md:text-[144px]"
            }`}
            style={{ 
              background: rank === 1 
                ? "linear-gradient(180deg, #FDE68A 0%, #F59E0B 50%, #B45309 100%)" 
                : "linear-gradient(180deg, #FFFFFF 0%, #D3D1CE 45%, #6C6D74 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              WebkitTextStroke: "1px rgba(255,255,255,0.2)",
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.95)) drop-shadow(0 0 16px rgba(211,209,206,0.15))"
            }}
          >
            {rank}
          </div>
        )}
        <div 
          className={`relative z-10 w-full h-full overflow-hidden rounded-xl bg-card/80 ring-1 ring-white/10 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.5),0_2px_6px_-2px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:shadow-[0_20px_35px_-8px_rgba(0,0,0,0.65),0_8px_16px_-4px_rgba(0,0,0,0.35)] group-hover:ring-white/40 sheen-wrapper ${
            rank ? "ml-6 sm:ml-7 md:ml-8 w-[calc(100%-1.5rem)] sm:w-[calc(100%-1.75rem)] md:w-[calc(100%-2rem)]" : "w-full"
          }`}
          style={{ aspectRatio: "2/3" }}
        >
        {imgSrc && !hasError ? (
          <>
            {!isLoaded && (
              <div className="absolute inset-0 bg-white/[0.04] animate-pulse" />
            )}
            <img
              src={imgSrc}
              alt={title}
              className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
              loading="eager"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
              onError={handleImageError}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{title}</span>
          </div>
        )}

        {/* Badges: Upcoming/Unavailable, Anime (JP SUB), Movie/TV, and Custom Tags */}
        {!isPerson && (
          <div className="absolute top-2 left-2 z-20 flex flex-wrap items-center gap-1.5 pointer-events-none max-w-[85%]">
            {(item as any).isUpcoming || (item as any).status === "upcoming" ? (
              <span className="bg-amber-500/90 border border-amber-400/50 text-white text-[9px] sm:text-[10px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
                UPCOMING
              </span>
            ) : (item as any).isUnavailable || (item as any).status === "unavailable" ? (
              <span className="bg-zinc-700/90 border border-zinc-500/50 text-zinc-200 text-[9px] sm:text-[10px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
                UNAVAILABLE
              </span>
            ) : (isAnime || showMediaBadge) ? (
              isAnime ? (
                <span className="bg-purple-950/85 border border-purple-500/40 text-purple-200 text-[10px] sm:text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase leading-none shadow-lg">
                  JP SUB
                </span>
              ) : (
                <span className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white shadow-lg border ${
                  isMovie ? "bg-rose-600/85 border-rose-500/30" : "bg-emerald-600/85 border-emerald-500/30"
                }`}>
                  {isMovie ? "MOVIE" : "TV SHOW"}
                </span>
              )
            ) : null}

            {Array.isArray((item as any).customTags || (item as any).tags) && ((item as any).customTags || (item as any).tags).slice(0, 2).map((tag: string, i: number) => (
              <span key={i} className="bg-purple-600/90 border border-purple-400/50 text-white text-[9px] sm:text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-md uppercase leading-none shadow-lg">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Persistent bottom dark gradient for anime */}
        {isAnime && (
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none z-10" />
        )}

        {/* Hover overlay gradient for movie/tv and hover enhancement for anime */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 pointer-events-none" />

        {/* Center Play Button on hover */}
        {!isPerson && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/65 border border-white/30 text-white flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-all duration-300 group-hover:scale-110 shadow-[0_10px_25px_rgba(0,0,0,0.8)] group-hover:bg-white group-hover:text-black group-hover:border-white">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5 transition-colors" />
            </div>
          </div>
        )}

        {/* Top Right Rating Badge */}
        {!isPerson && item.vote_average ? (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-black/70 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-md border border-white/10 shadow-sm pointer-events-none">
            <Star className="w-2.5 h-2.5 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}

        {/* Bottom Title & Details Container */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-3 pointer-events-none flex flex-col justify-end">
          <div className={`transition-all duration-300 ${
            isAnime
              ? "transform group-hover:-translate-y-5"
              : "opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
          }`}>
            <h3 className="text-white font-extrabold text-xs sm:text-sm leading-snug line-clamp-2 drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-tight">
              {title}
            </h3>
          </div>

          {/* Details (Year & Type badge) */}
          <div className={`flex items-center gap-2 transition-all duration-300 opacity-0 group-hover:opacity-100 ${
            isAnime
              ? "absolute bottom-3 left-3 transform translate-y-2 group-hover:translate-y-0"
              : "mt-1.5 transform translate-y-2 group-hover:translate-y-0"
          }`}>
            {year && !isPerson && (
              <span className="text-white/90 text-[10px] sm:text-xs font-semibold bg-white/20 px-2 py-0.5 rounded border border-white/10 shadow-sm">
                {year}
              </span>
            )}
            <span className="text-white/70 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              {isPerson ? "Person" : isManga ? (item.media_type === "manhwa" ? "Manhwa" : "Manga") : isAnime ? "Anime" : isMovie ? "Movie" : "TV"}
            </span>
          </div>
        </div>

        </div>
      </Link>
    </div>
  );
}
