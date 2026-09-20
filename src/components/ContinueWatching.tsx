"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Play, X, Tv, Film, Info, ChevronLeft, ChevronRight } from "lucide-react";
import useSWR, { mutate } from "swr";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState, useRef, memo, useCallback } from "react";

const ContinueWatchingPoster = memo(function ContinueWatchingPoster({
  backdropPath,
  posterPath,
  mediaType,
  title,
  eager,
}: {
  backdropPath?: string | null;
  posterPath: string | null;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  eager?: boolean;
}) {
  const getInitialSrc = useCallback(() => {
    const rawPath = backdropPath || posterPath;
    if (!rawPath) return null;
    if (rawPath.startsWith("http")) return rawPath;
    const cleanPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    return `https://image.tmdb.org/t/p/w780${cleanPath}`;
  }, [backdropPath, posterPath]);

  const [imgSrc, setImgSrc] = useState<string | null>(getInitialSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const nextSrc = getInitialSrc();
    setImgSrc(nextSrc);
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [getInitialSrc]);

  // Network adaptive fallback on slow connection (>5s)
  useEffect(() => {
    if (isLoaded || hasError || !imgSrc) return;
    const timer = setTimeout(() => {
      if (!isLoaded && !hasError && imgSrc.includes("/w780/")) {
        setImgSrc((prev) => (prev ? prev.replace("/w780/", "/w300/") : null));
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [imgSrc, isLoaded, hasError]);

  const handleImageError = () => {
    if (imgSrc && imgSrc.includes("/w780/")) {
      // Fallback to smaller TMDB size
      setImgSrc(imgSrc.replace("/w780/", "/w300/"));
    } else if (backdropPath && posterPath && imgSrc && !imgSrc.includes(posterPath)) {
      // If backdrop failed, try fallback to posterPath
      const posterClean = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
      setImgSrc(posterPath.startsWith("http") ? posterPath : `https://image.tmdb.org/t/p/w500${posterClean}`);
    } else {
      setHasError(true);
    }
  };

  const showImg = imgSrc && !hasError;

  return (
    <div className="relative w-full h-full overflow-hidden bg-card/80">
      {!isLoaded && (
        <div className="absolute inset-0 bg-card/80" />
      )}
      {showImg ? (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={title}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={handleImageError}
          className={`w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#1b222c] to-[#0d1217]">
          {mediaType === "tv" ? (
            <Tv className="w-8 h-8 text-white/20 mb-1" />
          ) : (
            <Film className="w-8 h-8 text-white/20 mb-1" />
          )}
          <span className="text-xs font-bold text-white/40 line-clamp-1">{title}</span>
        </div>
      )}
    </div>
  );
});

interface WatchHistoryItem {
  id: number;
  mediaId: number;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  season?: number;
  episode?: number;
  episodeName?: string;
  progress?: number;
  duration?: number;
}

const CACHE_KEY = "cinestream_cw_cache";

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return { items: [] };
    const json = await res.json();
    if (json?.items && typeof window !== "undefined") {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...json, cachedAt: Date.now() }));
      } catch {}
    }
    return json;
  } catch {
    return { items: [] };
  }
};

interface ContinueWatchingProps {
  filterType?: "movie" | "tv" | "anime" | "all";
}

export function ContinueWatching({ filterType = "all" }: ContinueWatchingProps = {}) {
  const { status } = useSession();
  const router = useRouter();

  // Instant zero-jump cached items for immediate display for logged-in user
  const [cachedItems, setCachedItems] = useState<WatchHistoryItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed?.items || [];
    } catch {
      return [];
    }
  });

  const { data } = useSWR(
    status === "authenticated" ? "/api/watch-history" : null,
    fetcher,
    { 
      revalidateOnFocus: true,
      revalidateOnMount: true,
      dedupingInterval: 2000,
    }
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    dragFree: true,
    containScroll: "trimSnaps",
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Keep Continue Watching cache and UI updated in real-time across tabs / page navigations
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem(CACHE_KEY);
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed?.items && Array.isArray(parsed.items)) {
          setCachedItems(parsed.items);
        }
      } catch {}
      mutate("/api/watch-history");
    };

    window.addEventListener("cinestream_watch_history_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("cinestream_watch_history_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const rawItems: WatchHistoryItem[] = (data?.items && Array.isArray(data.items)) ? data.items : cachedItems;

  const filteredItems = rawItems.filter((item: WatchHistoryItem) => {
    if (!item || !item.mediaId) return false;
    if (filterType === "movie") return item.mediaType === "movie";
    if (filterType === "tv") return item.mediaType === "tv";
    if (filterType === "anime") return item.mediaType === "anime";
    return true;
  });

  // Track Embla scroll button states
  useEffect(() => {
    if (!emblaApi) return;
    const updateScrollButtons = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    updateScrollButtons();
    emblaApi.on("select", updateScrollButtons);
    emblaApi.on("reInit", updateScrollButtons);
    return () => {
      emblaApi.off("select", updateScrollButtons);
      emblaApi.off("reInit", updateScrollButtons);
    };
  }, [emblaApi, filteredItems.length]);

  // Auto-upgrade legacy items that didn't have backdropPath stored
  useEffect(() => {
    if (!rawItems || rawItems.length === 0) return;
    const missingBackdrop = rawItems.filter(
      (it) => !it.backdropPath && it.mediaType !== "anime" && it.mediaId
    );
    if (missingBackdrop.length === 0) return;

    let isMounted = true;
    Promise.all(
      missingBackdrop.map(async (item) => {
        try {
          const res = await fetch(`/api/tmdb/${item.mediaType}/${item.mediaId}`);
          if (!res.ok) return null;
          const json = await res.json();
          if (json?.backdrop_path) {
            return {
              mediaId: item.mediaId,
              mediaType: item.mediaType,
              backdropPath: json.backdrop_path as string,
            };
          }
        } catch {}
        return null;
      })
    ).then((updates) => {
      if (!isMounted) return;
      const validUpdates = updates.filter(Boolean);
      if (validUpdates.length > 0) {
        setCachedItems((prev) => {
          const next = prev.map((it) => {
            const up = validUpdates.find(
              (u) => u?.mediaId === it.mediaId && u?.mediaType === it.mediaType
            );
            return up ? { ...it, backdropPath: up.backdropPath } : it;
          });
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ items: next, cachedAt: Date.now() }));
          } catch {}
          return next;
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [rawItems?.length]);

  // Continue Watching is strictly for logged-in accounts
  if (status !== "authenticated") {
    return null;
  }

  if (filteredItems.length === 0) {
    return null;
  }

  const handleRemove = async (mediaId: number, mediaType: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistically update UI and cache
    mutate(
      "/api/watch-history",
      (currentData: any) => {
        if (!currentData || !currentData.items) return currentData;
        const nextItems = currentData.items.filter(
          (item: WatchHistoryItem) =>
            !(item.mediaId === mediaId && item.mediaType === mediaType)
        );
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...currentData, items: nextItems, cachedAt: Date.now() }));
        } catch {}
        return {
          ...currentData,
          items: nextItems,
        };
      },
      false
    );

    setCachedItems((prev) => prev.filter((it) => !(it.mediaId === mediaId && it.mediaType === mediaType)));

    await fetch(`/api/watch-history/${mediaId}?mediaType=${mediaType}`, {
      method: "DELETE",
    }).catch(() => {});
    mutate("/api/watch-history");
  };

  const handlePlay = (item: WatchHistoryItem) => {
    if (item.mediaType === "movie") {
      router.push(`/watch/movie/${item.mediaId}`);
    } else if (item.mediaType === "anime") {
      const episode = item.episode ?? 1;
      const seasonQuery = item.season && item.season > 1 ? `?season=${item.season}` : "";
      router.push(`/watch/anime/${item.mediaId}/${episode}${seasonQuery}`);
    } else {
      const season = item.season ?? 1;
      const episode = item.episode ?? 1;
      router.push(`/watch/tv/${item.mediaId}/${season}/${episode}`);
    }
  };

  const handleOpenPage = (item: WatchHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.mediaType === "movie") {
      router.push(`/movie/${item.mediaId}`);
    } else if (item.mediaType === "anime") {
      const seasonQuery = item.season && item.season > 1 ? `?season=${item.season}` : "";
      router.push(`/anime/${item.mediaId}${seasonQuery}`);
    } else {
      router.push(`/tv/${item.mediaId}`);
    }
  };

  return (
    <section className="w-full px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16 pt-4 pb-3 animate-fade-in">
      <div className="w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-1 bg-gradient-to-b from-primary to-primary/40 rounded-full h-5 shadow-sm" />
            <h2 className="text-base md:text-xl font-black text-white tracking-tight">
              Continue Watching
            </h2>
          </div>

          {/* Desktop Arrow Controls */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canScrollPrev}
              className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${
                canScrollPrev ? "hover:bg-white/15 hover:border-white/30 cursor-pointer" : "opacity-25 cursor-not-allowed"
              }`}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 ml-[-1px]" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canScrollNext}
              className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${
                canScrollNext ? "hover:bg-white/15 hover:border-white/30 cursor-pointer" : "opacity-25 cursor-not-allowed"
              }`}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 mr-[-1px]" />
            </button>
          </div>
        </div>

        {/* Embla Carousel Container */}
        <div className="overflow-hidden -mx-3 px-3 md:-mx-4 md:px-4 -mt-2 pt-2 pb-5 -mb-2" ref={emblaRef}>
          <div className="flex gap-3.5 sm:gap-4 md:gap-5">
            {filteredItems.map((item: WatchHistoryItem, idx: number) => (
              <div
                key={`${item.mediaType}-${item.mediaId}-${item.season ?? 0}-${item.episode ?? 0}`}
                onClick={() => handlePlay(item)}
                className="flex-[0_0_auto] w-[230px] xs:w-[250px] sm:w-[275px] md:w-[305px] lg:w-[335px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.02] first:origin-left hover:z-10"
              >
                {/* 16:9 Landscape Artwork Card */}
                <div className="aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-card/80 ring-1 ring-white/10 relative shadow-[0_6px_20px_-4px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:ring-white/25 group-hover:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.7)]">
                  <ContinueWatchingPoster
                    backdropPath={item.backdropPath}
                    posterPath={item.posterPath}
                    mediaType={item.mediaType}
                    title={item.title}
                    eager={idx < 4}
                  />

                  {/* Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                  {/* Media Type Badge */}
                  <div
                    className={`absolute top-2.5 left-2.5 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md tracking-wider uppercase shadow-md backdrop-blur-md border border-white/10 pointer-events-none transition-opacity duration-300 group-hover:opacity-40 ${
                      item.mediaType === "movie"
                        ? "bg-rose-600/85 border-rose-500/30"
                        : item.mediaType === "tv"
                        ? "bg-emerald-600/85 border-emerald-500/30"
                        : "bg-purple-900/85 border-purple-500/30 text-purple-200"
                    }`}
                  >
                    {item.mediaType === "movie" ? "Movie" : item.mediaType === "tv" ? "TV" : "Anime"}
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(item.mediaId, item.mediaType, e)}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 hover:bg-rose-600 text-white/80 hover:text-white flex items-center justify-center transition-all duration-200 hover:scale-110 z-30 opacity-0 group-hover:opacity-100 shadow-lg border border-white/15 cursor-pointer"
                    title="Remove from continue watching"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {/* Hover Overlay with Resume & Details Actions */}
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2.5 p-3 z-20">
                    {/* Resume Button */}
                    <button
                      type="button"
                      onMouseEnter={() => {
                        if (item.mediaType === "movie") {
                          router.prefetch(`/watch/movie/${item.mediaId}`);
                        } else if (item.mediaType === "anime") {
                          const ep = item.episode ?? 1;
                          const sq = item.season && item.season > 1 ? `?season=${item.season}` : "";
                          router.prefetch(`/watch/anime/${item.mediaId}/${ep}${sq}`);
                        } else {
                          const s = item.season ?? 1;
                          const ep = item.episode ?? 1;
                          router.prefetch(`/watch/tv/${item.mediaId}/${s}/${ep}`);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlay(item);
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-black shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                      title="Resume playback"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      <span>Resume</span>
                    </button>

                    {/* Details Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenPage(item, e)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white border border-white/20 text-xs font-bold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                      title="Open details page"
                    >
                      <Info className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>

                {/* Metadata underneath the card: Title and Episode Info, Strictly NO timestamp or time-left */}
                <div className="mt-2.5 px-0.5 space-y-0.5">
                  <h3 className="text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>

                  {(item.mediaType === "tv" || item.mediaType === "anime") && (
                    <p className="text-xs text-zinc-400 font-medium line-clamp-1 flex items-center gap-1.5">
                      {item.season != null && item.episode != null && item.season > 0 && item.episode > 0 ? (
                        <span className="text-zinc-300 font-semibold">
                          S{item.season}:E{item.episode}
                        </span>
                      ) : item.episode != null && item.episode > 0 ? (
                        <span className="text-zinc-300 font-semibold">
                          EP {item.episode}
                        </span>
                      ) : null}
                      {item.episodeName && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="truncate">{item.episodeName}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
