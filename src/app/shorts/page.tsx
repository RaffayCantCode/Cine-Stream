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
import { SiYoutube, SiImdb } from "react-icons/si";
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
  trailerKey: string;
  detailHref: string;
  watchHref: string;
}

function pickBestYoutubeKey(videos: any[]): string | null {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  const yt = videos.filter((v) => v?.site === "YouTube" && v?.key);
  if (yt.length === 0) return null;
  const officialTrailer = yt.find((v) => v.type === "Trailer" && v.official);
  if (officialTrailer) return officialTrailer.key;
  const anyTrailer = yt.find((v) => v.type === "Trailer");
  if (anyTrailer) return anyTrailer.key;
  const teaser = yt.find((v) => v.type === "Teaser" || v.type === "Clip");
  if (teaser) return teaser.key;
  return yt[0].key;
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
  // Tracks which slides the user explicitly clicked Play on (or active slide auto-plays)
  const [playingSlides, setPlayingSlides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const loadPool = async () => {
      setLoading(true);
      const moviesAndTvWithTrailers: ShortFeedItem[] = [];
      const animeWithTrailers: ShortFeedItem[] = [];

      // 1. Fetch trending + popular movies & TV and resolve their official YouTube trailer keys in parallel
      const tmdbTask = (async () => {
        try {
          const [trendingRes, popMoviesRes, popTvRes] = await Promise.allSettled([
            fetchJson<{ results: any[] }>("/api/tmdb/trending"),
            fetchJson<{ results: any[] }>("/api/tmdb/movies/popular"),
            fetchJson<{ results: any[] }>("/api/tmdb/tv/popular"),
          ]);

          const rawCandidates: any[] = [];
          if (trendingRes.status === "fulfilled" && Array.isArray(trendingRes.value?.results)) {
            rawCandidates.push(...trendingRes.value.results);
          }
          if (popMoviesRes.status === "fulfilled" && Array.isArray(popMoviesRes.value?.results)) {
            rawCandidates.push(
              ...popMoviesRes.value.results.map((m) => ({ ...m, media_type: "movie" }))
            );
          }
          if (popTvRes.status === "fulfilled" && Array.isArray(popTvRes.value?.results)) {
            rawCandidates.push(
              ...popTvRes.value.results.map((t) => ({ ...t, media_type: "tv" }))
            );
          }

          const cleaned = filterExcludeAnime(rawCandidates);
          const seen = new Set<string>();
          const uniqueCandidates: any[] = [];
          for (const it of cleaned) {
            if (!it?.id || (!it.backdrop_path && !it.poster_path)) continue;
            const mType: "movie" | "tv" =
              it.media_type === "tv" || (it.first_air_date && !it.release_date)
                ? "tv"
                : "movie";
            const key = `${mType}-${it.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            uniqueCandidates.push({ ...it, _mType: mType, _key: key });
            if (uniqueCandidates.length >= 24) break;
          }

          // Resolve trailer keys in parallel so every slide has a guaranteed playable trailer
          const resolved = await Promise.allSettled(
            uniqueCandidates.map(async (it) => {
              const mType: "movie" | "tv" = it._mType;
              const vData = await fetchJson<{ results: any[] }>(
                `/api/tmdb/${mType}/${it.id}/videos`
              );
              const ytKey = pickBestYoutubeKey(vData?.results || []);
              if (!ytKey) return null;
              return {
                id: it._key,
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
                trailerKey: ytKey,
                detailHref: `/${mType}/${it.id}`,
                watchHref:
                  mType === "movie"
                    ? `/watch/movie/${it.id}`
                    : `/watch/tv/${it.id}/1/1`,
              } satisfies ShortFeedItem;
            })
          );

          for (const r of resolved) {
            if (r.status === "fulfilled" && r.value) {
              moviesAndTvWithTrailers.push(r.value);
            }
          }
        } catch {}
      })();

      // 2. Fetch trending Anime with YouTube trailers from AniList
      const animeTask = (async () => {
        try {
          const query = `
            query {
              Page(page: 1, perPage: 20) {
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
              animeWithTrailers.push({
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

      // Interleave Movies/TV and Anime so "All" feed feels rich and varied
      const combined: ShortFeedItem[] = [];
      const max = Math.max(moviesAndTvWithTrailers.length, animeWithTrailers.length);
      for (let i = 0; i < max; i++) {
        if (moviesAndTvWithTrailers[i]) combined.push(moviesAndTvWithTrailers[i]);
        if (animeWithTrailers[i]) combined.push(animeWithTrailers[i]);
      }

      setItems(combined);
      if (combined[0]) {
        setPlayingSlides({ [combined[0].id]: true });
      }
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

  // Automatically enable trailer playback when a slide becomes active
  useEffect(() => {
    const activeItem = filteredItems[activeIndex];
    if (activeItem) {
      setPlayingSlides((prev) =>
        prev[activeItem.id] ? prev : { ...prev, [activeItem.id]: true }
      );
    }
  }, [activeIndex, filteredItems]);

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
          className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/65 hover:bg-black/90 border border-white/15 backdrop-blur-2xl text-xs font-extrabold text-white transition-all shadow-xl"
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
          <Loader2 className="w-10 h-10 text-white animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">
            Loading Official Trailers...
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
            const isTrailerPlaying = Boolean(isActive && playingSlides[item.id] && item.trailerKey);
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

                {/* Main Video / Trailer Frame — clicking Play ALWAYS plays the trailer inline inside /shorts */}
                <div className="relative w-full h-full max-w-5xl mx-auto flex items-center justify-center px-0 sm:px-6">
                  {isTrailerPlaying ? (
                    <div className="relative w-full aspect-video max-h-[80dvh] sm:rounded-3xl overflow-hidden bg-black border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.95)]">
                      <iframe
                        key={`${item.id}-${isMuted ? "muted" : "unmuted"}`}
                        src={`https://www.youtube-nocookie.com/embed/${item.trailerKey}?autoplay=1&mute=${
                          isMuted ? 1 : 0
                        }&controls=1&loop=1&playlist=${item.trailerKey}&rel=0&modestbranding=1&playsinline=1`}
                        className="w-full h-full border-0 pointer-events-auto"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={`${item.title} Official Trailer`}
                      />
                    </div>
                  ) : (
                    <div className="relative w-full aspect-video max-h-[78dvh] sm:rounded-3xl overflow-hidden bg-zinc-950 border border-white/15 shadow-2xl">
                      {(item.backdrop || item.poster) && (
                        <img
                          src={item.backdrop || item.poster || ""}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveIndex(idx);
                            setPlayingSlides((prev) => ({
                              ...prev,
                              [item.id]: true,
                            }));
                          }}
                          aria-label={`Play ${item.title} trailer`}
                          className="group/play flex flex-col items-center gap-3 cursor-pointer"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 text-black flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.85)] group-hover/play:scale-110 transition-transform">
                            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-black ml-1" />
                          </div>
                          <span className="px-3.5 py-1 rounded-full bg-black/75 border border-white/20 backdrop-blur-md text-xs font-extrabold text-white flex items-center gap-1.5">
                            <SiYoutube className="w-3.5 h-3.5 text-[#FF0000]" />
                            <span>Play Trailer</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Gradient & Title Info Overlay */}
                <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black via-black/65 to-transparent pointer-events-none" />

                <div className="absolute bottom-7 left-4 sm:left-10 right-20 sm:right-28 z-30 max-w-2xl space-y-2.5 pointer-events-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/15 border border-white/15 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white">
                      <SiYoutube className="w-3 h-3 text-[#FF0000]" />
                      <span>Official Trailer • {item.mediaType}</span>
                    </span>
                    {item.rating > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-amber-300 text-xs font-black">
                        <SiImdb className="w-3.5 h-3.5 text-[#F5C518]" />
                        <span>{item.rating.toFixed(1)}</span>
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
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#D3D1CE] text-black text-xs sm:text-sm font-black shadow-xl transition-transform active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>Watch Full {item.mediaType === "movie" ? "Movie" : "Series"}</span>
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

                {/* Right-Side Vertical Action Rail */}
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
                        ? "bg-white text-black border-white"
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
                    title={isMuted ? "Unmute Trailer" : "Mute Trailer"}
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white/70" />
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
