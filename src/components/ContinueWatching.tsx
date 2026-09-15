"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Play, X, Tv, Film, ExternalLink, Info } from "lucide-react";
import useSWR, { mutate } from "swr";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState, useRef, memo } from "react";

const ContinueWatchingPoster = memo(function ContinueWatchingPoster({
  posterPath,
  mediaType,
  title,
  eager,
}: {
  posterPath: string | null;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  eager?: boolean;
}) {
  const initialSrc = posterPath
    ? mediaType === "anime"
      ? posterPath
      : `https://image.tmdb.org/t/p/w342${posterPath}`
    : null;

  const [imgSrc, setImgSrc] = useState<string | null>(initialSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgSrc(initialSrc);
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [initialSrc]);

  // Network adaptive fallback on slow connection (>5s)
  useEffect(() => {
    if (isLoaded || hasError || !imgSrc) return;
    const timer = setTimeout(() => {
      if (!isLoaded && !hasError && imgSrc.includes("/w342/")) {
        setImgSrc((prev) => (prev ? prev.replace("/w342/", "/w185/") : null));
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [imgSrc, isLoaded, hasError]);

  const handleImageError = () => {
    if (imgSrc && imgSrc.includes("/w342/")) {
      setImgSrc(imgSrc.replace("/w342/", "/w185/"));
    } else {
      setHasError(true);
    }
  };

  const showImg = imgSrc && !hasError;

  return (
    <div className="relative w-full h-full overflow-hidden bg-card/80">
      {/* Ambient skeleton while downloading on slow internet */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent animate-pulse pointer-events-none" />
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
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-[#262E36]/90 to-[#12161B]">
          {mediaType === "tv" ? (
            <Tv className="w-8 h-8 text-white/20 mb-1" />
          ) : (
            <Film className="w-8 h-8 text-white/20 mb-1" />
          )}
          <span className="text-[10px] font-bold text-white/30 line-clamp-1">{title}</span>
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

  const [emblaRef] = useEmblaCarousel({
    dragFree: true,
    containScroll: "trimSnaps",
  });

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

  // Continue Watching is strictly for logged-in accounts
  if (status !== "authenticated") {
    return null;
  }

  const rawItems: WatchHistoryItem[] = (data?.items && Array.isArray(data.items)) ? data.items : cachedItems;

  const filteredItems = rawItems.filter((item: WatchHistoryItem) => {
    if (!item || !item.mediaId) return false;
    if (filterType === "movie") return item.mediaType === "movie";
    if (filterType === "tv") return item.mediaType === "tv";
    if (filterType === "anime") return item.mediaType === "anime";
    return true;
  });

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
    <section className="w-full px-3 md:px-6 lg:px-8 xl:px-10 pt-4 pb-2 animate-fade-in">
      <div className="w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-5 rounded-full bg-primary shadow-sm" />
          <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
            Continue Watching
          </h2>
        </div>

        <div className="overflow-hidden -mx-3 px-3 md:-mx-4 md:px-4 -mt-3 pt-3 pb-6 -mb-3" ref={emblaRef}>
          <div className="flex gap-3 md:gap-4">
            {filteredItems.map((item: WatchHistoryItem, idx: number) => {
              const posterUrl = item.posterPath
                ? item.mediaType === "anime"
                  ? item.posterPath
                  : `https://image.tmdb.org/t/p/w342${item.posterPath}`
                : null;

              return (
                <div
                  key={`${item.mediaType}-${item.mediaId}-${item.season ?? 0}-${item.episode ?? 0}`}
                  onClick={() => handlePlay(item)}
                  className="flex-[0_0_auto] w-[124px] sm:w-[146px] md:w-[158px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.03] first:origin-left hover:z-10"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-card/80 ring-1 ring-white/10 mb-2.5 relative shadow-[0_6px_18px_-4px_rgba(0,0,0,0.5),0_2px_6px_-2px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:ring-white/35 group-hover:shadow-[0_20px_35px_-8px_rgba(0,0,0,0.65),0_8px_16px_-4px_rgba(0,0,0,0.35)] sheen-wrapper">
                    <ContinueWatchingPoster
                      posterPath={item.posterPath}
                      mediaType={item.mediaType}
                      title={item.title}
                      eager={idx < 4}
                    />

                    <div className={`absolute top-2 left-2 text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md tracking-widest uppercase shadow-lg border border-white/10 ${
                      item.mediaType === "movie"
                        ? "bg-rose-600/85 border-rose-500/30"
                        : item.mediaType === "tv"
                        ? "bg-emerald-600/85 border-emerald-500/30"
                        : "bg-purple-950/80 border-purple-500/30 text-purple-200"
                    }`}>
                      {item.mediaType === "movie" ? "Movie" : item.mediaType === "tv" ? "TV" : "JP Sub Anime"}
                    </div>

                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 p-2 z-20">
                      {/* Resume Button: opens in player */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlay(item);
                        }}
                        className="w-full max-w-[108px] flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white hover:bg-white/90 text-black text-[11px] font-extrabold shadow-lg transition-transform duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer"
                        title="Resume playback"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        <span>Resume</span>
                      </button>

                      {/* Open Page Button: opens details page */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenPage(item, e)}
                        className="w-full max-w-[108px] flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-white border border-white/20 text-[10px] font-bold shadow-md transition-transform duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer"
                        title="Open details page"
                      >
                        <Info className="w-3 h-3 text-zinc-300" />
                        <span>Open Page</span>
                      </button>
                    </div>

                    {(item.mediaType === "tv" || item.mediaType === "anime") && item.season != null && item.episode != null && item.season > 0 && item.episode > 0 && (
                      <div className="absolute bottom-2 left-2 bg-black/80 rounded-md px-2 py-0.5 text-[11px] sm:text-xs font-black text-white shadow-lg border border-white/10">
                        S{item.season} E{item.episode}
                      </div>
                    )}

                    <button
                      onClick={(e) => handleRemove(item.mediaId, item.mediaType, e)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/80 transition-all duration-300 hover:bg-rose-600 hover:text-white hover:scale-110 z-20 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                      aria-label="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="text-xs font-bold text-white/90 line-clamp-1 leading-tight tracking-tight">
                    {item.title}
                  </h4>
                  {(item.mediaType === "tv" || item.mediaType === "anime") && item.episodeName && (
                    <p className="text-[11px] text-indigo-300/80 font-medium mt-0.5 line-clamp-1">
                      {item.episodeName}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
