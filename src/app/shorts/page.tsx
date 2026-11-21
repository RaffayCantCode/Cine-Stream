"use client";
export const runtime = "edge";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Star,
  Plus,
  Check,
  Film,
  Tv,
  Sparkles,
  Info,
  Loader2,
} from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";
import { usePageContentReady } from "@/lib/pageLoad";
import { fetchJson, filterExcludeAnime, cn } from "@/lib/utils";

interface ShortFeedItem {
  id: string;
  mediaId: number;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string;
  rating: number;
  trailerKey?: string | null;
  detailHref: string;
  watchHref: string;
}

export default function ShortsFeedPage() {
  usePageContentReady(true);
  const watchlist = useWatchlist();
  const containerRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<ShortFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<"all" | "movie" | "tv" | "anime">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [trailerKeys, setTrailerKeys] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;

    const loadPool = async () => {
      setLoading(true);
      const pool: ShortFeedItem[] = [];

      // 1. Fetch trending movies & TV shows
      const tmdbTask = (async () => {
        try {
          const data = await fetchJson<{ results: any[] }>("/api/tmdb/trending");
          const list = filterExcludeAnime(data?.results || []);
          for (const it of list) {
            if (!it?.id || (!it.backdrop_path && !it.poster_path)) continue;
            const mType: "movie" | "tv" =
              it.media_type === "tv" || (it.first_air_date && !it.release_date)
                ? "tv"
                : "movie";
            pool.push({
              id: `${mType}-${it.id}`,
              mediaId: Number(it.id),
              mediaType: mType,
              title: it.title || it.name || "Featured Title",
              overview: it.overview || "",
              poster: it.poster_path
                ? `https://image.tmdb.org/t/p/w500${it.poster_path}`
                : null,
              backdrop: it.backdrop_path
                ? `https://image.tmdb.org/t/p/w1280${it.backdrop_path}`
                : null,
              year: String(it.release_date || it.first_air_date || "").slice(0, 4),
              rating: Number(it.vote_average || 0),
              detailHref: `/${mType}/${it.id}`,
              watchHref:
                mType === "movie"
                  ? `/watch/movie/${it.id}`
                  : `/watch/tv/${it.id}/1/1`,
            });
          }
        } catch {}
      })();

      // 2. Fetch trending Anime with YouTube trailers from AniList
      const animeTask = (async () => {
        try {
          const query = `
            query {
              Page(page: 1, perPage: 18) {
                media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
                  id
                  title { english romaji }
                  description
                  coverImage { extraLarge large }
                  bannerImage
                  seasonYear
                  averageScore
                  trailer { id site }
                }
              }
            }
          `;
          const res = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const json = await res.json();
            const list = json?.data?.Page?.media || [];
            for (const m of list) {
              if (!m?.id || m.trailer?.site !== "youtube" || !m.trailer?.id) continue;
              pool.push({
                id: `anime-${m.id}`,
                mediaId: Number(m.id),
                mediaType: "anime",
                title: m.title?.english || m.title?.romaji || "Anime",
                overview: (m.description || "").replace(/<[^>]*>/g, ""),
                poster: m.coverImage?.extraLarge || m.coverImage?.large || null,
                backdrop: m.bannerImage || m.coverImage?.extraLarge || null,
                year: String(m.seasonYear || ""),
                rating: m.averageScore ? m.averageScore / 10 : 0,
                trailerKey: m.trailer.id,
                detailHref: `/anime/${m.id}`,
                watchHref: `/watch/anime/${m.id}/1`,
              });
            }
          }
        } catch {}
      })();

      await Promise.allSettled([tmdbTask, animeTask]);
      if (cancelled) return;

      setItems(pool);
      setLoading(false);
    };

    void loadPool();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (category === "all") return items;
    return items.filter((it) => it.mediaType === category);
  }, [items, category]);

  // Lazily resolve YouTube trailer key for the active slide + next slide
  useEffect(() => {
    const targets = [
      filteredItems[activeIndex],
      filteredItems[activeIndex + 1],
    ].filter(Boolean);

    for (const item of targets) {
      if (!item) continue;
      if (item.trailerKey || trailerKeys[item.id] !== undefined) continue;
      if (item.mediaType === "anime") continue;

      fetchJson<{ results: any[] }>(
        `/api/tmdb/${item.mediaType}/${item.mediaId}/videos`
      )
        .then((data) => {
          const videos = Array.isArray(data?.results) ? data.results : [];
          const trailer =
            videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
            videos.find((v) => v.site === "YouTube");
          setTrailerKeys((prev) => ({
            ...prev,
            [item.id]: trailer?.key || null,
          }));
        })
        .catch(() => {
          setTrailerKeys((prev) => ({ ...prev, [item.id]: null }));
        });
    }
  }, [activeIndex, filteredItems, trailerKeys]);

  const scrollToSlide = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, filteredItems.length - 1));
      setActiveIndex(clamped);
      const container = containerRef.current;
      if (container) {
        const child = container.children[clamped] as HTMLElement | undefined;
        child?.scrollIntoView({ behavior: "smooth" });
      }
    },
    [filteredItems.length]
  );

  // Keyboard Up / Down navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollToSlide(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollToSlide(activeIndex - 1);
      } else if (e.key === "m") {
        setIsMuted((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, scrollToSlide]);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black text-white overflow-hidden select-none">
      {/* Top Overlay Navigation Bar */}
      <div className="fixed top-4 inset-x-4 sm:inset-x-8 z-50 flex items-center justify-between gap-3 pointer-events-none">
        <Link
          href="/"
          className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 hover:bg-black/85 border border-white/15 backdrop-blur-2xl text-xs font-extrabold text-white transition-all shadow-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Shorts</span>
        </Link>

        {/* Category Filter Pills */}
        <div className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-full bg-black/65 border border-white/15 backdrop-blur-2xl shadow-xl">
          {(
            [
              { id: "all", label: "All" },
              { id: "movie", label: "Movies", icon: Film },
              { id: "tv", label: "Series", icon: Tv },
              { id: "anime", label: "Anime", icon: Sparkles },
            ] as const
          ).map((tab) => {
            const Icon = (tab as any).icon;
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategory(tab.id);
                  setActiveIndex(0);
                  containerRef.current?.scrollTo({ top: 0 });
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer",
                  active
                    ? "bg-white text-black shadow-md"
                    : "text-white/70 hover:text-white"
                )}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vertical Snap Scroll Feed */}
      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">
            Loading Shorts Feed...
          </span>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const idx = Math.round(el.scrollTop / Math.max(el.clientHeight, 1));
            if (idx !== activeIndex && idx >= 0 && idx < filteredItems.length) {
              setActiveIndex(idx);
            }
          }}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        >
          {filteredItems.map((item, idx) => {
            const isActive = idx === activeIndex;
            const resolvedTrailerKey = item.trailerKey ?? trailerKeys[item.id];
            const inWatchlist = Boolean(
              watchlist?.isSaved?.(item.mediaId, item.mediaType)
            );

            return (
              <div
                key={item.id}
                className="relative w-full h-[100dvh] snap-start snap-always flex items-center justify-center overflow-hidden bg-black"
              >
                {/* Ambient blurred backdrop */}
                {(item.backdrop || item.poster) && (
                  <img
                    src={item.backdrop || item.poster || ""}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none"
                  />
                )}

                {/* Main Video / Trailer Frame */}
                <div className="relative w-full h-full max-w-5xl mx-auto flex items-center justify-center">
                  {isActive && resolvedTrailerKey ? (
                    <iframe
                      key={`${item.id}-${isMuted ? "muted" : "unmuted"}`}
                      src={`https://www.youtube-nocookie.com/embed/${resolvedTrailerKey}?autoplay=1&mute=${
                        isMuted ? 1 : 0
                      }&controls=0&loop=1&playlist=${resolvedTrailerKey}&rel=0&modestbranding=1&playsinline=1`}
                      className="w-full aspect-video max-h-[82dvh] border-0 rounded-none sm:rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] pointer-events-auto"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={item.title}
                    />
                  ) : (
                    <div className="relative w-full aspect-video max-h-[78dvh] sm:rounded-3xl overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl">
                      {(item.backdrop || item.poster) && (
                        <img
                          src={item.backdrop || item.poster || ""}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Link
                          href={item.watchHref}
                          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                        >
                          <Play className="w-7 h-7 fill-black ml-1" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Gradient & Title Info Overlay */}
                <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black via-black/65 to-transparent pointer-events-none" />

                <div className="absolute bottom-8 left-4 sm:left-10 right-20 sm:right-28 z-30 max-w-2xl space-y-2.5 pointer-events-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-white/15 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white">
                      {item.mediaType}
                    </span>
                    {item.rating > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                        <Star className="w-3 h-3 fill-current" />
                        {item.rating.toFixed(1)}
                      </span>
                    )}
                    {item.year && (
                      <span className="text-xs font-bold text-white/70">
                        {item.year}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight drop-shadow-lg">
                    {item.title}
                  </h2>

                  {item.overview && (
                    <p className="text-xs sm:text-sm text-white/70 line-clamp-2 leading-relaxed">
                      {item.overview}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <Link
                      href={item.watchHref}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-white/90 text-black text-xs sm:text-sm font-black shadow-xl transition-transform active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>Watch Now</span>
                    </Link>
                    <Link
                      href={item.detailHref}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-xl text-xs sm:text-sm font-bold text-white transition-all"
                    >
                      <Info className="w-4 h-4" />
                      <span>Details</span>
                    </Link>
                  </div>
                </div>

                {/* Right-Side Vertical Action Rail (Cinejoy Shorts style) */}
                <div className="absolute right-3 sm:right-8 bottom-10 z-30 flex flex-col items-center gap-3.5">
                  {item.poster && (
                    <Link
                      href={item.detailHref}
                      title="Open details"
                      className="w-11 h-16 rounded-xl overflow-hidden ring-2 ring-white/30 hover:ring-white shadow-xl transition-transform hover:scale-105 mb-1"
                    >
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      watchlist?.toggle?.({
                        mediaId: item.mediaId,
                        mediaType: item.mediaType,
                        title: item.title,
                        posterPath: item.poster,
                        backdropPath: item.backdrop,
                      });
                    }}
                    className={cn(
                      "w-12 h-12 rounded-full border backdrop-blur-2xl flex items-center justify-center transition-all cursor-pointer shadow-xl",
                      inWatchlist
                        ? "bg-emerald-500 text-black border-emerald-300"
                        : "bg-black/60 hover:bg-white/20 text-white border-white/20"
                    )}
                    title={inWatchlist ? "In Watchlist" : "Add to Watchlist"}
                  >
                    {inWatchlist ? (
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMuted((prev) => !prev)}
                    className="w-12 h-12 rounded-full bg-black/60 hover:bg-white/20 border border-white/20 backdrop-blur-2xl flex items-center justify-center text-white transition-all cursor-pointer shadow-xl"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-rose-400" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex flex-col gap-1.5 pt-2">
                    <button
                      type="button"
                      onClick={() => scrollToSlide(activeIndex - 1)}
                      disabled={activeIndex <= 0}
                      className="w-10 h-10 rounded-full bg-black/60 hover:bg-white/20 disabled:opacity-30 border border-white/15 backdrop-blur-xl flex items-center justify-center text-white transition-all cursor-pointer"
                      aria-label="Previous short"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSlide(activeIndex + 1)}
                      disabled={activeIndex >= filteredItems.length - 1}
                      className="w-10 h-10 rounded-full bg-black/60 hover:bg-white/20 disabled:opacity-30 border border-white/15 backdrop-blur-xl flex items-center justify-center text-white transition-all cursor-pointer"
                      aria-label="Next short"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
