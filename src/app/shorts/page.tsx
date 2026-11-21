"use client";
export const runtime = "edge";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Volume2,
  Volume1,
  VolumeX,
  ChevronUp,
  ChevronDown,
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
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const [items, setItems] = useState<ShortFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<"all" | "movie" | "tv" | "anime">("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [volume, setVolume] = useState<number>(85);
  const [prevVolume, setPrevVolume] = useState<number>(85);
  const isMuted = volume === 0;
  const [playingSlides, setPlayingSlides] = useState<Record<string, boolean>>({});

  // Send live volume updates to active YouTube iframe without reloading it
  const syncYoutubeVolume = useCallback(
    (targetVol: number, slideId?: string) => {
      const clamped = Math.max(0, Math.min(100, Math.round(targetVol)));
      const targets = slideId
        ? [iframeRefs.current[slideId]]
        : Object.values(iframeRefs.current);

      for (const iframe of targets) {
        if (!iframe?.contentWindow) continue;
        try {
          if (clamped === 0) {
            iframe.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "mute", args: [] }),
              "*"
            );
          } else {
            iframe.contentWindow.postMessage(
              JSON.stringify({ event: "command", func: "unMute", args: [] }),
              "*"
            );
            iframe.contentWindow.postMessage(
              JSON.stringify({
                event: "command",
                func: "setVolume",
                args: [clamped],
              }),
              "*"
            );
          }
        } catch {}
      }
    },
    []
  );

  const handleVolumeChange = useCallback(
    (nextVol: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(nextVol)));
      setVolume(clamped);
      if (clamped > 0) setPrevVolume(clamped);
      syncYoutubeVolume(clamped);
    },
    [syncYoutubeVolume]
  );

  const toggleMute = useCallback(() => {
    if (volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 80;
      handleVolumeChange(restored);
    } else {
      setPrevVolume(volume);
      handleVolumeChange(0);
    }
  }, [volume, prevVolume, handleVolumeChange]);

  useEffect(() => {
    let cancelled = false;

    const loadPool = async () => {
      setLoading(true);
      const moviesWithTrailers: ShortFeedItem[] = [];
      const tvWithTrailers: ShortFeedItem[] = [];
      const animeWithTrailers: ShortFeedItem[] = [];

      // 1. Fetch trending + popular Movies & TV Series and resolve their YouTube trailers
      const tmdbTask = (async () => {
        try {
          const [trendMovies, popMovies, trendTv, popTv] =
            await Promise.allSettled([
              fetchJson<{ results: any[] }>("/api/tmdb/trending?type=movie", {
                skipCache: true,
              }),
              fetchJson<{ results: any[] }>("/api/tmdb/movies/popular", {
                skipCache: true,
              }),
              fetchJson<{ results: any[] }>("/api/tmdb/trending?type=tv", {
                skipCache: true,
              }),
              fetchJson<{ results: any[] }>("/api/tmdb/tv/popular", {
                skipCache: true,
              }),
            ]);

          const rawMovies: any[] = [];
          if (trendMovies.status === "fulfilled" && Array.isArray(trendMovies.value?.results)) {
            rawMovies.push(...trendMovies.value.results);
          }
          if (popMovies.status === "fulfilled" && Array.isArray(popMovies.value?.results)) {
            rawMovies.push(...popMovies.value.results);
          }

          const rawTv: any[] = [];
          if (trendTv.status === "fulfilled" && Array.isArray(trendTv.value?.results)) {
            rawTv.push(...trendTv.value.results);
          }
          if (popTv.status === "fulfilled" && Array.isArray(popTv.value?.results)) {
            rawTv.push(...popTv.value.results);
          }

          const cleanMovies = filterExcludeAnime(rawMovies);
          const cleanTv = filterExcludeAnime(rawTv);

          const seenMovies = new Set<number>();
          const movieCandidates: any[] = [];
          for (const m of cleanMovies) {
            if (!m?.id || (!m.backdrop_path && !m.poster_path) || seenMovies.has(Number(m.id))) continue;
            seenMovies.add(Number(m.id));
            movieCandidates.push(m);
            if (movieCandidates.length >= 16) break;
          }

          const seenTv = new Set<number>();
          const tvCandidates: any[] = [];
          for (const t of cleanTv) {
            if (!t?.id || (!t.backdrop_path && !t.poster_path) || seenTv.has(Number(t.id))) continue;
            seenTv.add(Number(t.id));
            tvCandidates.push(t);
            if (tvCandidates.length >= 16) break;
          }

          const [resolvedMovies, resolvedTv] = await Promise.all([
            Promise.allSettled(
              movieCandidates.map(async (it) => {
                const vData = await fetchJson<{ results: any[] }>(
                  `/api/tmdb/movie/${it.id}/videos`,
                  { skipCache: true }
                );
                const ytKey = pickBestYoutubeKey(vData?.results || []);
                if (!ytKey) return null;
                return {
                  id: `movie-${it.id}`,
                  mediaId: Number(it.id),
                  mediaType: "movie" as const,
                  title: it.title || it.name || "Movie",
                  overview: it.overview || "",
                  poster: it.poster_path
                    ? `https://image.tmdb.org/t/p/w500${it.poster_path}`
                    : null,
                  backdrop: it.backdrop_path
                    ? `https://image.tmdb.org/t/p/w1280${it.backdrop_path}`
                    : null,
                  year: String(it.release_date || "").slice(0, 4),
                  rating: Number(it.vote_average || 0),
                  trailerKey: ytKey,
                  detailHref: `/movie/${it.id}`,
                  watchHref: `/watch/movie/${it.id}`,
                } satisfies ShortFeedItem;
              })
            ),
            Promise.allSettled(
              tvCandidates.map(async (it) => {
                const vData = await fetchJson<{ results: any[] }>(
                  `/api/tmdb/tv/${it.id}/videos`,
                  { skipCache: true }
                );
                const ytKey = pickBestYoutubeKey(vData?.results || []);
                if (!ytKey) return null;
                return {
                  id: `tv-${it.id}`,
                  mediaId: Number(it.id),
                  mediaType: "tv" as const,
                  title: it.name || it.title || "TV Series",
                  overview: it.overview || "",
                  poster: it.poster_path
                    ? `https://image.tmdb.org/t/p/w500${it.poster_path}`
                    : null,
                  backdrop: it.backdrop_path
                    ? `https://image.tmdb.org/t/p/w1280${it.backdrop_path}`
                    : null,
                  year: String(it.first_air_date || "").slice(0, 4),
                  rating: Number(it.vote_average || 0),
                  trailerKey: ytKey,
                  detailHref: `/tv/${it.id}`,
                  watchHref: `/watch/tv/${it.id}/1/1`,
                } satisfies ShortFeedItem;
              })
            ),
          ]);

          for (const r of resolvedMovies) {
            if (r.status === "fulfilled" && r.value) moviesWithTrailers.push(r.value);
          }
          for (const r of resolvedTv) {
            if (r.status === "fulfilled" && r.value) tvWithTrailers.push(r.value);
          }
        } catch {}
      })();

      // 2. Fetch trending Anime with YouTube trailers from AniList
      const animeTask = (async () => {
        try {
          const query = `
            query {
              Page(page: 1, perPage: 22) {
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

      // Interleave 1:1:1 (Movie -> TV Series -> Anime) so "All" is a rich mix starting with a Movie!
      const combined: ShortFeedItem[] = [];
      const maxLen = Math.max(
        moviesWithTrailers.length,
        tvWithTrailers.length,
        animeWithTrailers.length
      );
      for (let i = 0; i < maxLen; i++) {
        if (moviesWithTrailers[i]) combined.push(moviesWithTrailers[i]);
        if (tvWithTrailers[i]) combined.push(tvWithTrailers[i]);
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
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, scrollToSlide, toggleMute]);

  const VolumeIcon = isMuted ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black text-white overflow-hidden select-none">
      {/* Top Overlay Navigation Bar */}
      <div className="fixed top-4 inset-x-4 sm:inset-x-8 z-50 flex items-center justify-between gap-3 pointer-events-none">
        <Link
          href="/"
          prefetch={true}
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
      ) : filteredItems.length === 0 ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-base font-bold text-white/80">
            No trailers available in this category right now.
          </p>
          <button
            type="button"
            onClick={() => setCategory("all")}
            className="px-4 py-2 rounded-full bg-white text-black text-xs font-black cursor-pointer"
          >
            Show All Trailers
          </button>
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
            const isTrailerPlaying = Boolean(
              isActive && playingSlides[item.id] && item.trailerKey
            );
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
                <div className="relative w-full h-full max-w-5xl mx-auto flex items-center justify-center px-0 sm:px-6">
                  {isTrailerPlaying ? (
                    <div className="relative w-full aspect-video max-h-[80dvh] sm:rounded-3xl overflow-hidden bg-black border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.95)]">
                      <iframe
                        ref={(el) => {
                          iframeRefs.current[item.id] = el;
                        }}
                        key={item.id}
                        src={`https://www.youtube-nocookie.com/embed/${item.trailerKey}?autoplay=1&enablejsapi=1&controls=1&loop=1&playlist=${item.trailerKey}&rel=0&modestbranding=1&playsinline=1`}
                        onLoad={() => {
                          setTimeout(() => syncYoutubeVolume(volume, item.id), 250);
                          setTimeout(() => syncYoutubeVolume(volume, item.id), 900);
                        }}
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
                      <span>
                        Watch Full {item.mediaType === "movie" ? "Movie" : "Series"}
                      </span>
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

                  {/* Hover-Expanding Volume Slider Pill */}
                  <div className="group/vol relative flex items-center justify-end">
                    <div className="flex items-center rounded-full bg-black/75 hover:bg-black/90 border border-white/20 backdrop-blur-2xl shadow-2xl transition-all duration-200 overflow-hidden">
                      {/* Expanding Slider Drawer (reveals smoothly on hover) */}
                      <div className="w-0 opacity-0 group-hover/vol:w-32 group-hover/vol:opacity-100 group-hover/vol:pl-4 group-hover/vol:pr-1 flex items-center gap-2 transition-all duration-200 overflow-hidden">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={volume}
                          onChange={(e) =>
                            handleVolumeChange(Number(e.target.value))
                          }
                          aria-label="Trailer volume"
                          className="w-20 h-1.5 accent-white bg-white/25 rounded-lg cursor-pointer"
                        />
                        <span className="text-[10px] font-black text-white/80 w-7 text-right tabular-nums">
                          {volume}%
                        </span>
                      </div>

                      {/* Volume Icon Button */}
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:text-white/90 transition-colors cursor-pointer shrink-0"
                        title={isMuted ? "Unmute Trailer" : `Volume ${volume}% (Click to mute)`}
                      >
                        <VolumeIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

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
