"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Play, X, Tv, Film } from "lucide-react";
import useSWR, { mutate } from "swr";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState } from "react";

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
  const res = await fetch(url);
  const json = await res.json();
  if (json?.items && typeof window !== "undefined") {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(json));
    } catch {}
  }
  return json;
};

interface ContinueWatchingProps {
  filterType?: "movie" | "tv" | "anime" | "all";
}

export function ContinueWatching({ filterType = "all" }: ContinueWatchingProps = {}) {
  const { status } = useSession();
  const router = useRouter();

  // Try reading local storage for instant zero-jump hydration
  const [initialCachedData] = useState<any>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const { data, isLoading } = useSWR(
    status === "authenticated" ? "/api/watch-history" : null,
    fetcher,
    { 
      fallbackData: initialCachedData,
      revalidateOnFocus: false, 
      revalidateIfStale: false 
    }
  );

  const [emblaRef] = useEmblaCarousel({
    dragFree: true,
    containScroll: "trimSnaps",
  });

  const items = data?.items || [];
  const filteredItems = items.filter((item: WatchHistoryItem) => {
    if (filterType === "movie") return item.mediaType === "movie";
    if (filterType === "tv") return item.mediaType === "tv";
    if (filterType === "anime") return item.mediaType === "anime";
    return true;
  });

  const isVisible = status === "authenticated" && filteredItems.length > 0;

  const handleRemove = async (mediaId: number, mediaType: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistically update the UI so the item disappears instantly
    mutate(
      "/api/watch-history",
      (currentData: any) => {
        if (!currentData || !currentData.items) return currentData;
        const nextItems = currentData.items.filter(
          (item: WatchHistoryItem) =>
            !(item.mediaId === mediaId && item.mediaType === mediaType)
        );
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...currentData, items: nextItems }));
        } catch {}
        return {
          ...currentData,
          items: nextItems,
        };
      },
      false
    );

    await fetch(`/api/watch-history/${mediaId}?mediaType=${mediaType}`, {
      method: "DELETE",
    });

    mutate("/api/watch-history");
  };

  const handlePlay = (item: WatchHistoryItem) => {
    const timeParam = item.progress && item.progress > 0 ? `&t=${item.progress}` : "";
    if (item.mediaType === "movie") {
      router.push(`/movie/${item.mediaId}?autoplay=1${timeParam}`);
    } else if (item.mediaType === "anime") {
      const season = item.season ?? 1;
      const episode = item.episode ?? 1;
      router.push(`/anime/${item.mediaId}?autoplay=1&season=${season}&episode=${episode}${timeParam}`);
    } else {
      const season = item.season ?? 1;
      const episode = item.episode ?? 1;
      router.push(`/tv/${item.mediaId}?autoplay=1&season=${season}&episode=${episode}${timeParam}`);
    }
  };

  return (
    <div 
      className={`grid transition-all duration-500 ease-out ${
        isVisible 
          ? "grid-rows-[1fr] opacity-100 translate-y-0" 
          : "grid-rows-[0fr] opacity-0 -translate-y-2 pointer-events-none"
      }`}
    >
      <div className="overflow-hidden">
        <section className="px-3 md:px-8 lg:px-10 pt-4 pb-2">
          <div className="max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-5 rounded-full bg-primary shadow-sm" />
              <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
                Continue Watching
              </h2>
            </div>

            <div className="overflow-hidden pb-3" ref={emblaRef}>
              <div className="flex gap-3 md:gap-4">
                {filteredItems.map((item: WatchHistoryItem, i: number) => {
                  const posterUrl = item.posterPath
                    ? item.mediaType === "anime"
                      ? item.posterPath
                      : `https://image.tmdb.org/t/p/w342${item.posterPath}`
                    : null;

                  return (
                    <div
                      key={`${item.mediaType}-${item.mediaId}-${item.season ?? 0}-${item.episode ?? 0}`}
                      onClick={() => handlePlay(item)}
                      className="flex-[0_0_auto] w-[124px] sm:w-[146px] md:w-[158px] relative group cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                    >
                      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-card/80 ring-1 ring-white/10 mb-2.5 relative shadow-[0_12px_32px_rgba(0,0,0,0.65)] transition-all duration-300 group-hover:ring-white/35 group-hover:shadow-[0_24px_48px_rgba(0,0,0,0.9)] sheen-wrapper">
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            {item.mediaType === "tv" ? (
                              <Tv className="w-8 h-8 text-white/20" />
                            ) : (
                              <Film className="w-8 h-8 text-white/20" />
                            )}
                          </div>
                        )}

                        <div className={`absolute top-2 left-2 text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-md tracking-widest uppercase shadow-lg border border-white/10 ${
                          item.mediaType === "movie"
                            ? "bg-rose-600/85 border-rose-500/30"
                            : item.mediaType === "tv"
                            ? "bg-emerald-600/85 border-emerald-500/30"
                            : "bg-purple-950/80 border-purple-500/30 text-purple-200"
                        }`}>
                          {item.mediaType === "movie" ? "Movie" : item.mediaType === "tv" ? "TV" : "JP Sub Anime"}
                        </div>

                        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <div className="w-11 h-11 rounded-full bg-black/65 border border-white/30 text-white flex items-center justify-center translate-y-2 group-hover:translate-y-0 transition-all duration-300 group-hover:scale-110 shadow-[0_10px_25px_rgba(0,0,0,0.8)] group-hover:bg-white group-hover:text-black group-hover:border-white">
                            <Play className="w-4 h-4 fill-current ml-0.5 transition-colors" />
                          </div>
                        </div>

                        {(item.mediaType === "tv" || item.mediaType === "anime") && item.season != null && item.episode != null && item.season > 0 && item.episode > 0 && (
                          <div className="absolute bottom-2 left-2 bg-black/80 rounded-md px-2 py-0.5 text-[11px] sm:text-xs font-black text-white shadow-lg border border-white/10">
                            S{item.season} E{item.episode}
                          </div>
                        )}

                        <button
                          onClick={(e) => handleRemove(item.mediaId, item.mediaType, e)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/80 transition-all duration-300 hover:bg-rose-600 hover:text-white hover:scale-110 z-20 md:opacity-0 md:group-hover:opacity-100"
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
      </div>
    </div>
  );
}
