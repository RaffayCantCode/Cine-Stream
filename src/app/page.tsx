"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { ContinueWatching } from "@/components/ContinueWatching";
import { fetchJson, shuffleArray, filterReleasedSafeContent } from "@/lib/utils";
import {
  Tv, Film, Star, Calendar, ChevronRight, Zap, Clock,
  TrendingUp, Flame, Sparkles, Radio, Play, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  adult?: boolean;
  genre_ids?: number[];
}

interface AnimeItem {
  id: string;
  animeId: string;
  name: string;
  poster: string;
  type?: string | null;
  score?: string | null;
}

function pickRandomHero(items: MediaItem[]): MediaItem | undefined {
  if (!items.length) return undefined;
  const pool = filterReleasedSafeContent(items).slice(0, 20);
  if (!pool.length) return items[0];
  const weighted = pool.sort(() => Math.random() - 0.5);
  return weighted[Math.floor(Math.random() * Math.min(5, weighted.length))];
}

function deduplicateItems<T extends { id: number | string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type HomeTab = "now-airing" | "anime" | "movies-tv";

function SectionHeader(props: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  viewAllHref?: string;
}) {
  const { icon: Icon, title, subtitle, viewAllHref } = props;
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-1 h-8 bg-gradient-to-b from-violet-500 to-violet-600 rounded-full shadow-lg" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-violet-400" />
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-white/40 mt-0.5 ml-7">{subtitle}</p>}
      </div>
      {viewAllHref && (
        <Link href={viewAllHref}
          className="hidden md:flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white/50 hover:text-white transition-all border border-white/[0.06]">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

function HomeContent() {
  const [activeTab, setActiveTab] = useState<HomeTab>("now-airing");
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<MediaItem[]>([]);
  const [popularTv, setPopularTv] = useState<MediaItem[]>([]);
  const [topRatedTv, setTopRatedTv] = useState<MediaItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([]);
  const [airingToday, setAiringToday] = useState<MediaItem[]>([]);
  const [heroItem, setHeroItem] = useState<MediaItem | undefined>(undefined);
  const [animeTrending, setAnimeTrending] = useState<AnimeItem[]>([]);
  const [animeLatest, setAnimeLatest] = useState<AnimeItem[]>([]);
  const [animePopular, setAnimePopular] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const moviePages = [Math.floor(Math.random() * 5) + 1, Math.floor(Math.random() * 5) + 1];
      const tvPages = [Math.floor(Math.random() * 5) + 1, Math.floor(Math.random() * 5) + 1];
      const trendingPage = Math.floor(Math.random() * 3) + 1;
      const nowPlayingPage = Math.floor(Math.random() * 3) + 1;
      const airingTodayPage = Math.floor(Math.random() * 3) + 1;

      const [
        trendingData, popularMoviesData, topRatedMoviesData,
        popularTvData, topRatedTvData, nowPlayingData, airingTodayData,
        animeSpotlight, animeLatestData, animePopularData
      ] = await Promise.all([
        fetchJson<{ results: MediaItem[] }>(`/api/tmdb/trending?type=all&timeWindow=day&page=${trendingPage}`),
        fetchJson<{ results: MediaItem[] }>(`/api/tmdb/movies/popular?page=${moviePages[0]}`),
        fetchJson<{ results: MediaItem[] }>(`/api/tmdb/movies/top-rated?page=${moviePages[1]}`),
        fetchJson<{ results: MediaItem[] }>(`/api/tmdb/tv/popular?page=${tvPages[0]}`),
        fetchJson<{ results: MediaItem[] }>(`/api/tmdb/tv/top-rated?page=${tvPages[1]}`),
        fetchJson<{ results: MediaItem[] }>(`/api/tmdb/movies/now-playing?page=${nowPlayingPage}`),
        fetchJson<{ results: MediaItem[] }>(`/api/tmdb/tv/airing-today?page=${airingTodayPage}`),
        fetchJson<{ success: boolean; data: any[] }>(`/api/anime?category=latest&page=1`).catch(() => ({ success: false, data: [] })),
        fetchJson<{ success: boolean; data: any[] }>(`/api/anime?category=latest&page=1`).catch(() => ({ success: false, data: [] })),
        fetchJson<{ success: boolean; data: any[] }>(`/api/anime?category=popular&page=1`).catch(() => ({ success: false, data: [] })),
      ]);

      setTrending(deduplicateItems(filterReleasedSafeContent(shuffleArray(trendingData.results || []))));
      setPopularMovies(deduplicateItems(filterReleasedSafeContent(shuffleArray(popularMoviesData.results || []))));
      setTopRatedMovies(deduplicateItems(filterReleasedSafeContent(shuffleArray(topRatedMoviesData.results || []))));
      setPopularTv(deduplicateItems(filterReleasedSafeContent(shuffleArray(popularTvData.results || []))));
      setTopRatedTv(deduplicateItems(filterReleasedSafeContent(shuffleArray(topRatedTvData.results || []))));
      setNowPlaying(deduplicateItems(filterReleasedSafeContent(shuffleArray(nowPlayingData.results || []))));
      setAiringToday(deduplicateItems(filterReleasedSafeContent(shuffleArray(airingTodayData.results || []))));

      const safeAnime = (arr: any[]) => arr?.filter((a: any) => a?.id && a?.poster).slice(0, 20) || [];
      setAnimeTrending(safeAnime(animeSpotlight?.data || []));
      setAnimeLatest(safeAnime(animeLatestData?.data || []).slice(0, 20));
      setAnimePopular(safeAnime(animePopularData?.data || []).slice(0, 20));

      const heroPool = deduplicateItems([...filterReleasedSafeContent(trendingData.results || []).slice(0, 20)]);
      setHeroItem(pickRandomHero(heroPool));
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const tabItems = [
    { key: "now-airing" as HomeTab, icon: Radio, label: "Now Airing", activeBg: "bg-rose-500/15 border-rose-500/30" },
    { key: "anime" as HomeTab, icon: Sparkles, label: "Anime", activeBg: "bg-violet-500/15 border-violet-500/30" },
    { key: "movies-tv" as HomeTab, icon: Film, label: "Movies & TV", activeBg: "bg-amber-500/15 border-amber-500/30" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-0">
        {isLoading ? (
          <div className="w-full h-[70vh] md:h-[85vh] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-background to-background animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/40 text-sm font-medium">Loading StreamVault...</p>
              </div>
            </div>
          </div>
        ) : heroItem ? (
          <HeroBanner item={heroItem} />
        ) : null}

        <div className="relative z-20 -mt-6 mb-2 px-5 md:px-12">
          <div className="max-w-screen-2xl mx-auto">
            <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl">
              {tabItems.map(({ key, icon: Icon, label, activeBg }) => {
                const isActive = activeTab === key;
                return (
                  <motion.button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`relative flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 ${
                      isActive
                        ? `${activeBg} text-white border border-white/[0.08]`
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                    whileTap={{ scale: 0.97 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="home-tab-indicator"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 opacity-90"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10 hidden sm:inline">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative z-20 mt-4 md:mt-6 px-5 md:px-12 max-w-screen-2xl mx-auto space-y-12"
          >
            {activeTab === "now-airing" && (
              <>
                <ContinueWatching />

                {airingToday.length > 0 && (
                  <section>
                    <SectionHeader icon={Radio} title="Live Now on TV" subtitle="Shows airing right now" viewAllHref="/browse/tv" />
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                      {airingToday.slice(0, 16).map((item, i) => {
                        return (
                          <motion.div
                            key={`airing-${item.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group shrink-0 w-44"
                          >
                            <Link href={`/tv/${item.id}`} className="block">
                              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08]">
                                <img
                                  src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                  alt={item.name || item.title || ""}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                                <div className="absolute top-2 left-2 z-10">
                                  <span className="flex items-center gap-1 bg-rose-500/90 text-white text-[9px] font-extrabold px-2 py-1 rounded-lg animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
                                  </span>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <h3 className="text-white font-bold text-xs leading-tight line-clamp-2">{item.name || item.title}</h3>
                                  <p className="text-white/40 text-[9px] mt-1 truncate">New Episode Today</p>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {nowPlaying.length > 0 && (
                  <section>
                    <SectionHeader icon={Film} title="In Theaters" subtitle="Now playing at a cinema near you" viewAllHref="/browse/movies" />
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                      {nowPlaying.slice(0, 16).map((item, i) => {
                        return (
                          <motion.div
                            key={`nowplay-${item.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group shrink-0 w-44"
                          >
                            <Link href={`/movie/${item.id}`} className="block">
                              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08]">
                                <img
                                  src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                  alt={item.title || ""}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                  loading="lazy"
                                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                                <div className="absolute top-2 left-2 z-10">
                                  <span className="bg-orange-500/90 text-white text-[9px] font-extrabold px-2 py-1 rounded-lg">NOW PLAYING</span>
                                </div>
                                {item.vote_average && (
                                  <div className="absolute top-2 right-2 z-10">
                                    <span className="bg-amber-500/90 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                      &#9733; {item.vote_average.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <h3 className="text-white font-bold text-xs leading-tight line-clamp-2">{item.title}</h3>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {trending.length > 0 && (
                  <section>
                    <SectionHeader icon={TrendingUp} title="Trending Today" subtitle="What everyone is watching right now" viewAllHref="/browse/trending" />
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                      {trending.slice(0, 20).map((item, i) => {
                        const isMovie = item.media_type === "movie" || !!item.title;
                        const href = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
                        const name = item.title || item.name || "";
                        return (
                          <motion.div
                            key={`trend-${item.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group shrink-0 w-44"
                          >
                            <Link href={href} className="block">
                              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08]">
                                {item.poster_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                    alt={name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted/50" />
                                )}
                                <div className="absolute top-2 left-2 z-10">
                                  <span className="bg-cyan-500/90 text-white text-[9px] font-extrabold px-2 py-1 rounded-lg">#{i + 1}</span>
                                </div>
                                {item.vote_average && (
                                  <div className="absolute top-2 right-2 z-10">
                                    <span className="bg-amber-500/90 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                      &#9733; {item.vote_average.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <h3 className="text-white font-bold text-xs leading-tight line-clamp-2">{name}</h3>
                                    <p className="text-white/50 text-[9px] mt-1">{isMovie ? "Movie" : "TV Series"}</p>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {popularTv.length > 0 && (
                  <section>
                    <SectionHeader icon={Eye} title="Popular on Streaming" subtitle="Top trending series right now" viewAllHref="/browse/tv/popular" />
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                      {popularTv.slice(0, 16).map((item, i) => {
                        const name = item.title || item.name || "";
                        return (
                          <motion.div
                            key={`pop-${item.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group shrink-0 w-44"
                          >
                            <Link href={`/tv/${item.id}`} className="block">
                              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08]">
                                {item.poster_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                    alt={name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted/50" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                {item.vote_average && (
                                  <div className="absolute bottom-2 left-2">
                                    <span className="bg-amber-500/90 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      &#9733; {item.vote_average.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <p className="text-white/70 text-xs mt-2 text-center line-clamp-1 group-hover:text-white transition-colors font-medium">{name}</p>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {animeTrending.length > 0 && (
                  <section>
                    <SectionHeader icon={Sparkles} title="Anime Spotlight" subtitle="Hot anime everyone is watching" viewAllHref="/anime" />
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                      {animeTrending.slice(0, 16).map((anime, i) => {
                        return (
                          <motion.div
                            key={`spotlight-${anime.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group shrink-0 w-44"
                          >
                            <Link href={`/anime/${anime.id || anime.animeId}`} className="block">
                              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08] transition-all duration-300 group-hover:ring-violet-500/30 group-hover:shadow-violet-500/20 group-hover:scale-105">
                                {anime.poster ? (
                                  <img
                                    src={anime.poster}
                                    alt={anime.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 flex items-center justify-center">
                                    <span className="text-white/40 text-[10px] font-medium text-center p-2">{anime.name}</span>
                                  </div>
                                )}
                                <div className="absolute top-2 left-2 z-10">
                                  <span className="bg-violet-600/90 backdrop-blur-sm text-white text-[9px] font-extrabold tracking-widest px-2 py-0.5 rounded-lg uppercase shadow-lg">
                                    &#127839; Anime
                                  </span>
                                </div>
                                {anime.score && (
                                  <div className="absolute top-2 right-2 z-10">
                                    <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 shadow">
                                      &#9733; {anime.score}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                                  <h3 className="text-white font-bold text-xs leading-tight line-clamp-2">{anime.name}</h3>
                                </div>
                              </div>
                              <p className="text-white/70 text-xs mt-2 text-center line-clamp-1 group-hover:text-white transition-colors font-medium">{anime.name}</p>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === "anime" && (
              <>
                <ContinueWatching />
                {animeTrending.length > 0 && (
                  <section>
                    <SectionHeader icon={Flame} title="Hot Right Now" subtitle="Most popular anime trending this week" viewAllHref="/anime" />
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                      {animeTrending.slice(0, 16).map((anime, i) => {
                        return (
                          <motion.div
                            key={`hot-${anime.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group shrink-0 w-44"
                          >
                            <Link href={`/anime/${anime.id || anime.animeId}`} className="block">
                              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08] transition-all duration-300 group-hover:ring-violet-500/30 group-hover:shadow-violet-500/20 group-hover:scale-105">
                                {anime.poster ? (
                                  <img src={anime.poster} alt={anime.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-rose-600/30 to-orange-600/30 flex items-center justify-center">
                                    <span className="text-white/40 text-[10px] font-medium text-center p-2">{anime.name}</span>
                                  </div>
                                )}
                                <div className="absolute top-2 left-2 z-10">
                                  <span className="bg-violet-600/90 backdrop-blur-sm text-white text-[9px] font-extrabold tracking-widest px-2 py-0.5 rounded-lg uppercase shadow-lg">&#127839; Anime</span>
                                </div>
                                {anime.score && (
                                  <div className="absolute top-2 right-2 z-10">
                                    <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 shadow">&#9733; {anime.score}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                                  <h3 className="text-white font-bold text-xs leading-tight line-clamp-2">{anime.name}</h3>
                                </div>
                              </div>
                              <p className="text-white/70 text-xs mt-2 text-center line-clamp-1 group-hover:text-white transition-colors font-medium">{anime.name}</p>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {animeLatest.length > 0 && (
                  <section>
                    <SectionHeader icon={Clock} title="Latest Episodes" subtitle="Fresh episodes just released" />
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                      {animeLatest.slice(0, 16).map((anime, i) => {
                        return (
                          <motion.div
                            key={`latest-${anime.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group"
                          >
                            <Link href={`/anime/${anime.id || anime.animeId}`} className="block">
                              <div className="relative w-[108px] aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08] transition-all duration-300 group-hover:ring-violet-500/30 group-hover:shadow-violet-500/20 group-hover:scale-105">
                                {anime.poster ? (
                                  <img src={anime.poster} alt={anime.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-cyan-600/30 to-blue-600/30 flex items-center justify-center">
                                    <span className="text-white/40 text-[10px] font-medium text-center p-2">{anime.name}</span>
                                  </div>
                                )}
                                <div className="absolute top-2 left-2 z-10">
                                  <span className="bg-violet-600/90 backdrop-blur-sm text-white text-[9px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-lg uppercase">&#127839;</span>
                                </div>
                                {anime.score && (
                                  <div className="absolute top-2 right-2 z-10">
                                    <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[9px] font-extrabold px-1 py-0.5 rounded flex items-center gap-0.5">&#9733; {anime.score}</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-white/70 text-xs mt-2 w-[108px] text-center line-clamp-2 group-hover:text-white transition-colors font-medium leading-tight">{anime.name}</p>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {animePopular.length > 0 && (
                  <section>
                    <SectionHeader icon={Star} title="Top Rated Anime" subtitle="All-time favorites by community ratings" viewAllHref="/anime" />
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                      {animePopular.slice(0, 16).map((anime, i) => {
                        return (
                          <motion.div
                            key={`top-${anime.id}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            className="group shrink-0 w-44"
                          >
                            <Link href={`/anime/${anime.id || anime.animeId}`} className="block">
                              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08] transition-all duration-300 group-hover:ring-violet-500/30 group-hover:shadow-violet-500/20 group-hover:scale-105">
                                {anime.poster ? (
                                  <img src={anime.poster} alt={anime.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-emerald-600/30 to-teal-600/30 flex items-center justify-center">
                                    <span className="text-white/40 text-[10px] font-medium text-center p-2">{anime.name}</span>
                                  </div>
                                )}
                                <div className="absolute top-2 left-2 z-10">
                                  <span className="bg-violet-600/90 backdrop-blur-sm text-white text-[9px] font-extrabold tracking-widest px-2 py-0.5 rounded-lg uppercase shadow-lg">&#127839; Anime</span>
                                </div>
                                {anime.score && (
                                  <div className="absolute top-2 right-2 z-10">
                                    <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 shadow">&#9733; {anime.score}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                                  <h3 className="text-white font-bold text-xs leading-tight line-clamp-2">{anime.name}</h3>
                                </div>
                              </div>
                              <p className="text-white/70 text-xs mt-2 text-center line-clamp-1 group-hover:text-white transition-colors font-medium">{anime.name}</p>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <Link href="/anime" className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-gradient-to-r from-violet-600/15 to-fuchsia-600/15 border border-violet-500/20 hover:border-violet-500/40 text-white/50 hover:text-white font-bold text-sm transition-all group">
                  <span>Explore Full Anime Library</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </>
            )}

            {activeTab === "movies-tv" && (
              <>
                <ContinueWatching />
                <section>
                  <SectionHeader icon={TrendingUp} title="Trending Now" subtitle="Most popular content today" viewAllHref="/browse/trending" />
                  <MediaRow items={trending} />
                </section>
                <section>
                  <SectionHeader icon={Film} title="Now Playing in Theaters" subtitle="Catch these movies on the big screen" viewAllHref="/browse/movies" />
                  <MediaRow items={nowPlaying} />
                </section>
                <section>
                  <SectionHeader icon={Star} title="Top Rated Movies" subtitle="The best movies of all time" viewAllHref="/browse/movies/top-rated" />
                  <MediaRow items={topRatedMovies} />
                </section>
                <section>
                  <SectionHeader icon={Tv} title="Popular TV Shows" subtitle="Series everyone is bingeing" viewAllHref="/browse/tv/popular" />
                  <MediaRow items={popularTv} />
                </section>
                <section>
                  <SectionHeader icon={Calendar} title="On TV Today" subtitle="Today schedule" viewAllHref="/browse/tv" />
                  <MediaRow items={airingToday} />
                </section>
                <section>
                  <SectionHeader icon={Film} title="Top Rated TV" subtitle="Critical darlings and cult favorites" viewAllHref="/browse/tv/top-rated" />
                  <MediaRow items={topRatedTv} />
                </section>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="h-20" />
      </main>
    </div>
  );
}

function MediaRow({ items }: { items: MediaItem[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
      {items.slice(0, 20).map((item, i) => {
        const isMovie = item.media_type === "movie" || !!item.title;
        const href = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;
        const name = item.title || item.name || "";
        return (
          <Link key={`row-${item.id}-${i}`} href={href}
            className="group shrink-0 block w-44 transition-transform hover:scale-105 hover:z-20">
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/[0.08]">
              {item.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt={name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <div className="w-full h-full bg-muted/80 flex items-center justify-center text-white/30 text-xs">{name}</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {item.vote_average && (
                <div className="absolute bottom-2 left-2">
                  <span className="bg-amber-500/90 text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    &#9733; {item.vote_average.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <p className="text-white/70 text-xs mt-2 text-center line-clamp-1 group-hover:text-white transition-colors font-medium">{name}</p>
          </Link>
        );
      })}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}