"use client";

import { memo, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Play, Info, Star, Calendar, Sparkles } from "lucide-react";
import { isTmdbAnime, cn } from "@/lib/utils";
import { WatchlistButton } from "@/components/WatchlistButton";
import { useTheme } from "@/context/ThemeContext";

interface MediaItem {
  id: number | string;
  anilistId?: string | number;
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
  isTmdbAnime?: boolean;
}

interface HeroBannerProps {
  item: MediaItem;
}

const logoCache = new Map<string, string | null>();

function getCachedLogo(key: string): string | null | undefined {
  if (logoCache.has(key)) return logoCache.get(key);
  if (typeof window !== "undefined") {
    try {
      const saved = sessionStorage.getItem(`logo_v7_${key}`);
      if (saved) {
        const val = saved === "null" ? null : saved;
        logoCache.set(key, val);
        return val;
      }
    } catch {}
  }
  return undefined;
}

function saveLogoToCache(key: string, url: string | null) {
  logoCache.set(key, url);
  if (typeof window !== "undefined") {
    try {
      if (url) {
        sessionStorage.setItem(`logo_v7_${key}`, url);
      } else {
        sessionStorage.setItem(`logo_v7_${key}`, "null");
      }
    } catch {}
  }
}

export const HeroBanner = memo(function HeroBanner({ item }: HeroBannerProps) {
  let activeTheme = "global";
  try {
    const themeContext = useTheme();
    if (themeContext?.theme) activeTheme = themeContext.theme;
  } catch {}
  const isGlobalTheme = activeTheme === "global";

  const heroThemeStyles = useMemo(() => {
    switch (activeTheme) {
      case "oled":
        return {
          bottom: "from-[#000000] via-[#000000]/80 to-transparent",
          side: "from-[#000000]/90 via-[#000000]/40 to-transparent",
          mobile: "from-[#000000] via-[#000000]/50 to-transparent",
        };
      case "glass":
        return {
          bottom: "from-[#080d1e]/85 via-[#080d1e]/40 to-transparent",
          side: "from-[#080d1e]/80 via-[#080d1e]/25 to-transparent",
          mobile: "from-[#080d1e]/85 via-[#080d1e]/35 to-transparent",
        };
      case "cinema":
        return {
          bottom: "from-[#140509] via-[#140509]/80 to-transparent",
          side: "from-[#140509]/90 via-[#140509]/40 to-transparent",
          mobile: "from-[#140509] via-[#140509]/50 to-transparent",
        };
      case "wisteria":
        return {
          bottom: "from-[#0e071c] via-[#0e071c]/80 to-transparent",
          side: "from-[#0e071c]/90 via-[#0e071c]/40 to-transparent",
          mobile: "from-[#0e071c] via-[#0e071c]/50 to-transparent",
        };
      case "solaris":
        return {
          bottom: "from-[#100b05] via-[#100b05]/80 to-transparent",
          side: "from-[#100b05]/90 via-[#100b05]/40 to-transparent",
          mobile: "from-[#100b05] via-[#100b05]/50 to-transparent",
        };
      default:
        return null;
    }
  }, [activeTheme]);

  const [usePoster, setUsePoster] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const title = item?.title || item?.name || "";
  const anilistId = (item as any)?.anilistId;
  const isAnime = item?.media_type === "anime" || !!anilistId || isTmdbAnime(item);
  const isTv = item?.media_type === "tv" || (!isAnime && !!item?.first_air_date && !item?.release_date);
  const isMovie = item?.media_type === "movie" || (!isAnime && !isTv);
  const effectiveId = (item as any)?.tmdbId || item?.id;
  const cacheKey = `${effectiveId || item?.id}-${title}`;

  const [logoImgLoaded, setLogoImgLoaded] = useState(() => {
    if ((item as any)?.logoUrl) return true;
    const cached = getCachedLogo(cacheKey);
    return !!cached;
  });

  const [logoState, setLogoState] = useState<{ url: string | null; status: "cached" | "fetching" | "done" }>(() => {
    if ((item as any)?.logoUrl) {
      saveLogoToCache(cacheKey, (item as any).logoUrl);
      return { url: (item as any).logoUrl, status: "cached" };
    }
    const cached = getCachedLogo(cacheKey);
    if (cached !== undefined) {
      return { url: cached, status: "cached" };
    }
    return { url: null, status: "fetching" };
  });

  const logoUrl = logoState.url;

  // Reset load states and load logo on item change
  useEffect(() => {
    setUsePoster(false);
    setImgFailed(false);
    setImgLoaded(false);

    if (!item?.id) {
      setLogoState({ url: null, status: "done" });
      setLogoImgLoaded(false);
      return;
    }

    if ((item as any)?.logoUrl) {
      const u = (item as any).logoUrl;
      saveLogoToCache(cacheKey, u);
      setLogoState({ url: u, status: "done" });
      setLogoImgLoaded(true);
      return;
    }

    const cached = getCachedLogo(cacheKey);
    if (cached !== undefined) {
      setLogoState({ url: cached, status: "cached" });
      setLogoImgLoaded(!!cached);
      return;
    }

    setLogoImgLoaded(false);
    let isMounted = true;
    const mediaType = isAnime ? "anime" : isMovie ? "movie" : "tv";

    fetch(`/api/tmdb/logo?id=${effectiveId}&type=${mediaType}&title=${encodeURIComponent(title)}`, {
      cache: "force-cache",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        const url = data?.logoUrl || null;
        saveLogoToCache(cacheKey, url);
        setLogoState({ url, status: "done" });
      })
      .catch(() => {
        if (!isMounted) return;
        saveLogoToCache(cacheKey, null);
        setLogoState({ url: null, status: "done" });
      });

    return () => {
      isMounted = false;
    };
  }, [item?.id, effectiveId, title, isMovie, isAnime, cacheKey]);

  if (!item) return null;

  let link = (item as any).targetUrl || (item as any).target_url;
  if (!link) {
    if (anilistId || item.media_type === "anime") {
      const animeId = anilistId || item.id;
      link = `/anime/${animeId}`;
    } else if (isTv) {
      link = `/tv/${item.id}`;
    } else {
      link = `/movie/${item.id}`;
    }
  }

  // Direct watch link
  let watchLink = link;
  if (anilistId || item.media_type === "anime") {
    const animeId = anilistId || item.id;
    watchLink = `/watch/anime/${animeId}/1`;
  } else if (isTv) {
    watchLink = `/watch/tv/${item.id}/1/1`;
  } else {
    watchLink = `/watch/movie/${item.id}`;
  }

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rating = item.vote_average ?? 0;

  const resolveHighResImageUrl = (path?: string) =>
    path
      ? path.startsWith("http")
        ? path
        : `https://image.tmdb.org/t/p/original${path}`
      : null;

  const resolveFastImageUrl = (path?: string) =>
    path
      ? path.startsWith("http")
        ? path
        : `https://image.tmdb.org/t/p/w1280${path}`
      : null;

  const eventuallyOptimizable = (url?: string | null) =>
    !!url && !/(anilist\.co|myanimelist\.net|kitsu\.app|media\.kitsu\.io|media\.kitsu\.app)/i.test(url);

  const backdropPath = usePoster ? item.poster_path : item.backdrop_path;
  const fastBackdropUrl = resolveFastImageUrl(backdropPath);
  const highResBackdropUrl = resolveHighResImageUrl(backdropPath);
  const posterUrl = item.poster_path ? (item.poster_path.startsWith("http") ? item.poster_path : `https://image.tmdb.org/t/p/w780${item.poster_path}`) : null;

  const [highResLoaded, setHighResLoaded] = useState(false);

  useEffect(() => {
    setHighResLoaded(false);
    if (!highResBackdropUrl || typeof window === "undefined") return;

    const img = new window.Image();
    img.src = highResBackdropUrl;
    if (img.complete) {
      setHighResLoaded(true);
      return;
    }
    img.onload = () => setHighResLoaded(true);
  }, [highResBackdropUrl]);

  const isPortraitPoster = (url?: string | null) =>
    !!url && (url.includes("/cover/") || url.includes("/media/anime/cover/"));
  const isPosterOnly =
    isAnime &&
    (usePoster ||
      !item.backdrop_path ||
      item.backdrop_path === item.poster_path ||
      isPortraitPoster(highResBackdropUrl));

  const showBackdrop = !imgFailed && (!!fastBackdropUrl || !!highResBackdropUrl) && !isPosterOnly;
  const showPosterCard = !!posterUrl && !imgFailed;

  return (
    <section className="relative w-full h-[85svh] min-h-[500px] max-h-[720px] sm:h-[60vw] sm:max-h-[630px] md:h-[75vh] flex items-end bg-transparent overflow-hidden">
      {showBackdrop ? (
        <div 
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.15) 85%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.15) 85%, rgba(0,0,0,0) 100%)",
          }}
        >
          {/* Fast baseline backdrop for instant first render */}
          {fastBackdropUrl && (
            <img
              key={`fast-${fastBackdropUrl}`}
              src={fastBackdropUrl}
              alt={title}
              className="w-full h-full object-cover object-center md:object-top"
              style={{
                filter: "brightness(0.92) saturate(1.1)",
              }}
              loading="eager"
              fetchPriority="high"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                if (!usePoster && item.poster_path && item.poster_path !== item.backdrop_path) {
                  setUsePoster(true);
                } else {
                  setImgFailed(true);
                }
              }}
            />
          )}

          {/* Ultra-high quality original resolution backdrop (crossfades in when ready) */}
          {highResBackdropUrl && highResLoaded && (
            <img
              key={`hires-${highResBackdropUrl}`}
              src={highResBackdropUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover object-center md:object-top transition-opacity duration-500 ease-out"
              style={{
                filter: "brightness(0.92) saturate(1.1)",
              }}
              aria-hidden
            />
          )}
          {/* In non-global themes, blend hero seamlessly into the theme background */}
          {heroThemeStyles ? (
            <>
              <div className={`absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t ${heroThemeStyles.bottom} pointer-events-none z-10`} />
              <div className={`hidden md:block absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r ${heroThemeStyles.side} pointer-events-none z-10`} />
              <div className={`md:hidden absolute inset-0 bg-gradient-to-t ${heroThemeStyles.mobile} pointer-events-none z-10`} />
            </>
          ) : (
            <>
              {/* Subtle text legibility shadows only — NO solid color bottom block */}
              <div className="hidden md:block absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-black/80 via-black/25 to-transparent" />
              <div className="md:hidden absolute inset-0 bg-gradient-to-t from-[#07080d]/90 via-black/35 to-transparent pointer-events-none" />
            </>
          )}
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
        </div>
      ) : (
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0) 100%)",
          }}
        >
          {showPosterCard && posterUrl && (
            <img
              key={posterUrl}
              src={posterUrl}
              alt=""
              className="w-full h-full object-cover object-center blur-3xl scale-125 opacity-[0.25]"
              aria-hidden
            />
          )}
          <div className="hidden md:block absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          <div className="md:hidden absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

          {showPosterCard && posterUrl && (
            <div className="hidden md:flex absolute right-6 lg:right-12 xl:right-16 top-1/2 -translate-y-1/2 w-[200px] lg:w-[240px] xl:w-[270px] aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/15 z-10">
              <img
                key={`poster-card-${posterUrl}`}
                src={posterUrl}
                alt={title}
                className="w-full h-full object-cover"
                loading="eager"
                onError={() => setImgFailed(true)}
              />
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 w-full px-5 md:pl-20 md:pr-12 lg:pl-24 lg:pr-16 xl:pl-28 xl:pr-20 pb-8 sm:pb-10 md:pb-14">
        <div
          key={String(item.id)}
          className="w-full max-w-full sm:max-w-xl md:max-w-2xl flex flex-col items-center text-center md:items-start md:text-left mx-auto md:mx-0 bg-transparent p-0 animate-fade-in-up"
        >
          {/* Spotlight / Custom Badge Tagline */}
          {(item as any).badge && (
            <div className="mb-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-md backdrop-blur-sm">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {(item as any).badge}
              </span>
            </div>
          )}

          {/* Official ClearArt Logo OR Stylized Cinema Typography */}
          <div className="relative mb-6 sm:mb-7 md:mb-8 flex items-center justify-center md:justify-start min-h-[52px] sm:min-h-[64px] md:min-h-[84px] max-w-[85%] sm:max-w-[380px] md:max-w-[460px]">
            {/* Logo Image */}
            {logoUrl && (
              <img
                key={`logo-${logoUrl}`}
                src={logoUrl}
                alt={title}
                className={`max-h-24 sm:max-h-28 md:max-h-36 w-auto object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)] transition-all duration-300 ease-out ${
                  logoImgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                }`}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setLogoImgLoaded(true)}
              />
            )}

            {/* If fetching logo, keep clean skeleton placeholder rather than jarring raw text */}
            {logoState.status === "fetching" && !logoUrl && (
              <div className="h-10 sm:h-12 md:h-14 w-48 sm:w-60 md:w-72 rounded-xl skeleton-pulse opacity-40" />
            )}

            {/* Stylized Typography — ONLY visible if logo lookup completed and no logo exists */}
            {logoState.status === "done" && !logoUrl && (
              <h1
                className="text-white font-black line-clamp-2 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] tracking-tight select-text animate-fade-in"
                style={{
                  fontSize:
                    title.length > 40
                      ? "clamp(1.8rem, 3.6vw, 2.8rem)"
                      : title.length > 25
                      ? "clamp(2.2rem, 4.6vw, 3.5rem)"
                      : "clamp(2.5rem, 5.4vw, 4.2rem)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                {title}
              </h1>
            )}
          </div>

          {/* High-Impact Details Row (Rating, Year, Media Type, Quality) BELOW artwork */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 sm:gap-2.5 mb-3.5">
            {rating > 0 && (
              <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-black px-2.5 py-1 rounded-xl border border-emerald-500/35 shadow-sm backdrop-blur-sm">
                <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                <span>{rating.toFixed(1)}</span>
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1.5 bg-white/[0.08] text-white/90 font-bold text-xs px-2.5 py-1 rounded-xl border border-white/15 shadow-sm backdrop-blur-sm">
                <Calendar className="w-3.5 h-3.5 text-white/60" />
                <span>{year}</span>
              </span>
            )}
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider backdrop-blur-md border transition-all shadow-sm",
                isAnime
                  ? "bg-purple-500/20 text-purple-200 border-purple-400/35 shadow-purple-500/10"
                  : isMovie
                  ? "bg-rose-500/20 text-rose-200 border-rose-500/35 shadow-rose-500/10"
                  : "bg-emerald-500/20 text-emerald-200 border-emerald-400/35 shadow-emerald-500/10"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {isAnime ? "Anime" : isMovie ? "Movie" : "TV Series"}
            </span>
          </div>

          {/* Overview */}
          {item.overview && (
            <p
              className="text-white/90 text-xs sm:text-sm md:text-[15px] leading-relaxed mb-5 max-w-xl line-clamp-3 select-text"
              style={{ textShadow: "0 2px 6px rgba(0,0,0,0.85)" }}
            >
              {item.overview}
            </p>
          )}

          {/* Action buttons matching Whisper Man reference */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
            <Link
              href={watchLink}
              className="inline-flex items-center gap-2 bg-white hover:bg-white/90 active:scale-95 text-black font-extrabold px-6 sm:px-7 py-3.5 rounded-2xl text-xs sm:text-sm transition-all duration-300 shadow-[0_10px_28px_rgba(255,255,255,0.25)] hover:scale-[1.03] cursor-pointer"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
              <span>Watch Now</span>
            </Link>

            <WatchlistButton
              mediaId={parseInt(String(item.id).replace(/\D/g, ""), 10) || 0}
              mediaType={isAnime ? "anime" : isTv ? "tv" : "movie"}
              title={title}
              posterPath={item.poster_path ?? null}
              backdropPath={item.backdrop_path ?? null}
            />

            <Link
              href={link}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold px-5 py-3.5 rounded-2xl text-xs sm:text-sm transition-all duration-200 border border-white/20 backdrop-blur-md shadow-md"
            >
              <Info className="w-4 h-4" />
              <span>More Info</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
});
