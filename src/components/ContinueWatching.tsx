"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Play, X, Tv, Film } from "lucide-react";
import useSWR, { mutate } from "swr";
import useEmblaCarousel from "embla-carousel-react";
import { useRef, useState } from "react";

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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ContinueWatchingProps {
  filterType?: "movie" | "tv" | "anime" | "all";
}

export function ContinueWatching({ filterType = "all" }: ContinueWatchingProps = {}) {
  const { status } = useSession();
  const router = useRouter();
  const { data, isLoading } = useSWR(
    status === "authenticated" ? "/api/watch-history" : null,
    fetcher,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  const [emblaRef] = useEmblaCarousel({
    dragFree: true,
    containScroll: "trimSnaps",
  });



  if (status !== "authenticated" || isLoading || !data?.items?.length) {
    return null;
  }

  const filteredItems = data.items.filter((item: WatchHistoryItem) => {
    if (filterType === "movie") return item.mediaType === "movie";
    if (filterType === "tv") return item.mediaType === "tv";
    if (filterType === "anime") return item.mediaType === "anime";
    return true;
  });

  if (filteredItems.length === 0) return null;

  const handleRemove = async (mediaId: number, mediaType: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistically update the UI so the item disappears instantly
    mutate(
      "/api/watch-history",
      (currentData: any) => {
        if (!currentData || !currentData.items) return currentData;
        return {
          ...currentData,
          items: currentData.items.filter(
            (item: WatchHistoryItem) =>
              !(item.mediaId === mediaId && item.mediaType === mediaType)
          ),
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
    <section className="px-3 md:px-8 lg:px-10 pt-4 pb-1">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full" />
          <h2 className="text-base md:text-xl font-black text-white tracking-tight">Continue Watching</h2>
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
                className="flex-[0_0_auto] w-[122px] sm:w-[142px] md:w-[152px] relative group cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-card ring-1 ring-white/[0.07] mb-2.5 relative shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-all duration-300 group-hover:ring-[#7288AE]/50 group-hover:shadow-xl group-hover:shadow-black/25">
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

                  <div className={`absolute top-2 left-2 text-white text-[10px] sm:text-[11px] font-black px-2 py-1 rounded-md backdrop-blur-sm tracking-widest uppercase shadow-lg ${
                    item.mediaType === "movie"
                      ? "bg-gradient-to-r from-blue-600/90 to-indigo-600/90"
                      : item.mediaType === "tv"
                      ? "bg-gradient-to-r from-emerald-600/90 to-teal-600/90"
                      : "bg-gradient-to-r from-[#4B5694]/90 to-[#7288AE]/90"
                  }`}>
                    {item.mediaType === "movie" ? "Movie" : item.mediaType === "tv" ? "TV" : "JP Sub Anime"}
                  </div>

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-xl">
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    </div>
                  </div>

                  {(item.mediaType === "tv" || item.mediaType === "anime") && item.season != null && item.episode != null && item.season > 0 && item.episode > 0 && (
                    <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm rounded-md px-2 py-1 text-[11px] sm:text-xs font-black text-white shadow-lg">
                      S{item.season} E{item.episode}
                    </div>
                  )}



                  <button
                    onClick={(e) => handleRemove(item.mediaId, item.mediaType, e)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/80 transition-all duration-300 hover:bg-red-500 hover:text-white hover:scale-110 hover:shadow-[0_0_15px_rgba(239,68,68,0.6)] z-20 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="text-xs font-semibold text-white/80 line-clamp-1 leading-tight">
                  {item.title}
                </h4>
                {(item.mediaType === "tv" || item.mediaType === "anime") && item.episodeName && (
                  <p className="text-[11px] text-[#7288AE] font-medium mt-0.5 line-clamp-1">
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
