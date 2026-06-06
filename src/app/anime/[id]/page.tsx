"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { AnimePlayer } from "@/components/AnimePlayer";
import { fetchJson, cn } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";
import { Star, ArrowLeft, Tv2, Clock, ChevronLeft, ChevronRight, List, Calendar, Lock, Play, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimeDetail {
  id: string;
  idMal?: string | null;
  name: string;
  jname?: string | null;
  poster: string;
  description: string;
  type?: string | null;
  rating?: string | null;
  score?: string | null;
  status?: string | null;
  genres?: string[];
  totalEpisodes: number;
  seasons: SeasonInfo[];
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
}

interface Episode {
  episodeId: string;
  episodeNum: number;
  title?: string;
  thumbnail?: string | null;
  malUrl?: string | null;
  isFiller?: boolean;
  releasedDate?: string;
  isReleased?: boolean;
  description?: string;
  seasonNum?: number;
  seasonId?: string;
  seasonName?: string;
  seasonMalId?: number | null;
}

export default function AnimeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const { status: authStatus } = useSession();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(id);

  const playerRef = useRef<HTMLDivElement>(null);
  const seasonNumRef = useRef(1);

  function isEpisodeReleased(releasedDate: string | null | undefined): boolean {
    if (!releasedDate) return true;
    const d = new Date(releasedDate);
    if (isNaN(d.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d <= today;
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    seasonNumRef.current = 1;

    // Phase 1: lightweight metadata (instant) + determine active season
    const loadMeta = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJson<{ success: boolean; data: { anime: AnimeDetail } }>(`/api/anime/${id}/meta`);
        if (cancelled) return;
        if (data.success && data.data?.anime) {
          const a = data.data.anime;
          setAnime(a);
          setCurrentSeasonId(id);

          const seasons = a.seasons || [];
          const matchIdx = seasons.findIndex(s => s.id === id);
          seasonNumRef.current = matchIdx >= 0 ? matchIdx + 1 : 1;
          if (matchIdx >= 0 && matchIdx !== 0) {
            setCurrentPage(matchIdx);
          }
          loadActiveSeason(seasonNumRef.current);
        } else {
          throw new Error("Anime not found");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load anime");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadMeta();

    // Phase 2: fetch ONLY the active season's episodes (fast — single Jikan call)
    // NOTE: Called from loadMeta() AFTER seasonNumRef is correctly set
    const loadActiveSeason = async (seasonNum: number) => {
      setEpisodesLoading(true);
      try {
        const epData = await fetchJson<{ success: boolean; data: { episodes: Episode[] } }>(
          `/api/anime/${id}/episodes?seasonNum=${seasonNum}`
        );
        if (cancelled) return;
        if (epData.success && epData.data?.episodes?.length) {
          const sorted = epData.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
          const withRelease = sorted.map(ep => ({
            ...ep, isReleased: isEpisodeReleased(ep.releasedDate)
          }));
          setEpisodes(withRelease);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setEpisodesLoading(false); }
    };

    // Phase 3: silently fetch ALL seasons' episodes in the background
    const loadAllSeasons = async () => {
      try {
        const epData = await fetchJson<{ success: boolean; data: { episodes: Episode[] } }>(`/api/anime/${id}/episodes`);
        if (cancelled) return;
        if (epData.success && epData.data?.episodes) {
          const sorted = epData.data.episodes.sort((a, b) => {
            if ((a.seasonNum || 1) !== (b.seasonNum || 1)) return (a.seasonNum || 1) - (b.seasonNum || 1);
            return a.episodeNum - b.episodeNum;
          });
          const withRelease = sorted.map(ep => ({
            ...ep, isReleased: isEpisodeReleased(ep.releasedDate)
          }));
          setEpisodes(withRelease);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setEpisodesLoading(false); }
    };
    loadAllSeasons();

    return () => { cancelled = true; };
  }, [id]);

  // Autoplay via URL params (from ContinueWatching, etc.)
  useEffect(() => {
    const autoPlay = searchParams.get("autoplay") === "1";
    const seasonParam = Number(searchParams.get("season") || "");
    const episodeParam = Number(searchParams.get("episode") || "");
    if (autoPlay && episodes.length > 0) {
      const target = episodes.find(ep =>
        (ep.seasonNum === seasonParam || !seasonParam) &&
        ep.episodeNum === (episodeParam || 1)
      );
      if (target) {
        setSelectedEp(target);
        setIsPlaying(true);
      }
    }
  }, [searchParams, episodes]);

  useEffect(() => {
    if (!selectedEp || !isPlaying || episodesLoading) return;
    const id = requestAnimationFrame(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedEp?.episodeId, isPlaying, episodesLoading]);

  const fetchSeasonEpisodes = useCallback(async (seasonNum: number) => {
    setEpisodesLoading(true);
    try {
      const epData = await fetchJson<{ success: boolean; data: { episodes: Episode[] } }>(
        `/api/anime/${id}/episodes?seasonNum=${seasonNum}`
      );
      if (epData.success && epData.data?.episodes?.length) {
        const sorted = epData.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        const withRelease = sorted.map(ep => ({
          ...ep, isReleased: isEpisodeReleased(ep.releasedDate)
        }));
        setEpisodes(prev => {
          const existing = new Set(prev.map(e => e.episodeId));
          const unique = withRelease.filter(e => !existing.has(e.episodeId));
          if (unique.length === 0) return prev;
          return [...prev, ...unique].sort((a, b) => {
            if ((a.seasonNum || 1) !== (b.seasonNum || 1)) return (a.seasonNum || 1) - (b.seasonNum || 1);
            return a.episodeNum - b.episodeNum;
          });
        });
      }
    } catch { /* silent */ }
    finally { setEpisodesLoading(false); }
  }, [id]);

  const handleSeasonClick = (season: SeasonInfo) => {
    if (season.id === currentSeasonId) return;
    setCurrentSeasonId(season.id);
    setIsPlaying(false);
    setSelectedEp(null);
    const seasonIdx = seasons.findIndex(s => s.id === season.id);
    if (seasonIdx >= 0) setCurrentPage(seasonIdx);
    const sn = seasonIdx + 1;
    if (!episodeGroups[sn] || episodeGroups[sn].length === 0) {
      fetchSeasonEpisodes(sn);
    }
  };

  const handleWatchEpisode = (ep: Episode) => {
    if (ep.isReleased === false) return;
    setSelectedEp(ep);
    setIsPlaying(true);

    if (authStatus === "authenticated" && anime) {
      const numericId = parseInt(anime.id, 10);
      if (!Number.isNaN(numericId)) {
        fetch("/api/watch-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: numericId,
            mediaType: "anime",
            title: anime.name,
            posterPath: anime.poster || null,
            backdropPath: null,
            season: ep.seasonNum || 1,
            episode: ep.episodeNum,
            episodeName: ep.title || `Episode ${ep.episodeNum}`,
          }),
        }).catch(() => {});
      }
    }
  };

  const EPISODES_PER_PAGE = 20;

  const episodeGroups = useMemo(() => {
    return episodes.reduce((acc, ep) => {
      const group = ep.seasonNum || 1;
      if (!acc[group]) acc[group] = [];
      acc[group].push(ep);
      return acc;
    }, {} as Record<number, Episode[]>);
  }, [episodes]);

  const totalPages = Object.keys(episodeGroups).length;
  const currentIdx = episodes.findIndex(e => e.episodeId === selectedEp?.episodeId);

  const [visiblePerSeason, setVisiblePerSeason] = useState<Record<number, number>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const seasonPageRef = useRef<Record<number, number>>({});
  const seasonTotalRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (episodes.length === 0) return;
    const counts: Record<number, number> = {};
    for (const ep of episodes) {
      const sn = ep.seasonNum || 1;
      counts[sn] = (counts[sn] || 0) + 1;
    }
    seasonTotalRef.current = counts;
    seasonPageRef.current = {};
  }, [episodes]);

  const currentSeasonNum = currentPage + 1;
  const currentSeasonVisible = visiblePerSeason[currentSeasonNum] || EPISODES_PER_PAGE;
  const currentSeasonEps = episodeGroups[currentSeasonNum] || [];
  const displayedEps = currentSeasonEps.slice(0, currentSeasonVisible);
  const loadedForSeason = seasonTotalRef.current[currentSeasonNum] || currentSeasonEps.length;
  const hasMoreEps = currentSeasonVisible < currentSeasonEps.length;
  const seasons = anime?.seasons || [];
  const currentSeasonInfo = seasons.find(s => s.id === currentSeasonId);
  const seasonTotal = currentSeasonInfo?.totalEpisodes || loadedForSeason;
  const canFetchMore = currentSeasonVisible >= loadedForSeason && currentSeasonEps.length > 0 && loadedForSeason < seasonTotal;
  const isSpecialFormat = currentSeasonInfo?.seasonLabel?.toLowerCase().startsWith("movie")
    || currentSeasonInfo?.seasonLabel?.toLowerCase().startsWith("ova")
    || currentSeasonInfo?.seasonLabel?.toLowerCase().startsWith("ona")
    || currentSeasonInfo?.seasonLabel?.toLowerCase().startsWith("special");
  const isSingleItem = currentSeasonEps.length <= 1 && isSpecialFormat;

  const fetchMoreEpisodes = useCallback(async () => {
    const malId = currentSeasonEps[0]?.seasonMalId;
    if (!malId) return;
    const page = (seasonPageRef.current[currentSeasonNum] || 1) + 1;
    seasonPageRef.current[currentSeasonNum] = page;
    setLoadingMore(true);
    try {
      const data = await fetchJson<{ success: boolean; data: { episodes: Episode[] } }>(
        `/api/anime/${id}/episodes?seasonMalId=${malId}&page=${page}`
      );
      if (data.success && data.data?.episodes?.length) {
        const newEps: Episode[] = data.data.episodes.map(ep => ({
          episodeId: `${id}-${ep.episodeNum}`,
          episodeNum: ep.episodeNum,
          title: ep.title,
          thumbnail: ep.thumbnail,
          malUrl: ep.malUrl,
          isFiller: ep.isFiller,
          releasedDate: ep.releasedDate,
          description: ep.description,
          seasonNum: currentSeasonNum,
          seasonId: currentSeasonId,
          seasonName: currentSeasonEps[0]?.seasonName,
          seasonMalId: malId,
          isReleased: isEpisodeReleased(ep.releasedDate),
        }));
        setEpisodes(prev => {
          const existing = new Set(prev.map(e => e.episodeNum));
          const unique = newEps.filter(e => !existing.has(e.episodeNum));
          return [...prev, ...unique].sort((a, b) => a.episodeNum - b.episodeNum);
        });
      }
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [id, currentSeasonNum, currentSeasonId, currentSeasonEps]);

  const loadMoreEpisodes = () => {
    const nextCount = (visiblePerSeason[currentSeasonNum] || EPISODES_PER_PAGE) + EPISODES_PER_PAGE;
    setVisiblePerSeason(prev => ({
      ...prev,
      [currentSeasonNum]: nextCount,
    }));
    if (nextCount >= loadedForSeason) {
      fetchMoreEpisodes();
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prev = episodes[currentIdx - 1];
      if (prev.isReleased === false) return;
      handleWatchEpisode(prev);
    }
  };

  const handleNext = () => {
    if (currentIdx < episodes.length - 1) {
      const next = episodes[currentIdx + 1];
      if (next.isReleased === false) return;
      handleWatchEpisode(next);
    }
  };

  const handleSelectEp = (ep: Episode) => {
    handleWatchEpisode(ep);
  };

  const handleAutoNext = () => handleNext();

  // Lazy-load episode thumbnails (batch 3 at a time to avoid MAL rate limits)
  // When currentSeasonId changes, ONLY process that season's episodes
  const thumbnailFetchingRef = useRef(new Set<string>());
  const thumbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbEpVersionRef = useRef(0);
  useEffect(() => {
    thumbEpVersionRef.current++;
    thumbnailFetchingRef.current.clear();
  }, [episodes.length, currentSeasonId]);
  useEffect(() => {
    const loading = thumbnailFetchingRef.current;
    const currentEps = episodes.filter(ep => ep.seasonId === currentSeasonId);
    const needThumb = currentEps.filter(ep => !ep.thumbnail && ep.malUrl && !loading.has(ep.episodeId));
    if (needThumb.length === 0) return;

    const selectedEpId = selectedEp?.episodeId;
    if (selectedEpId) {
      const selIdx = needThumb.findIndex(ep => ep.episodeId === selectedEpId);
      if (selIdx > 0) {
        const [sel] = needThumb.splice(selIdx, 1);
        needThumb.unshift(sel);
      }
    }

    const BATCH = 6;
    const total = needThumb.length;
    let pos = 0;

    const tick = () => {
      const batch = needThumb.slice(pos, pos + BATCH);
      pos += BATCH;
      for (const ep of batch) {
        loading.add(ep.episodeId);
        fetch(`/api/anime/thumbnail?url=${encodeURIComponent(ep.malUrl!)}`)
          .then(r => r.json())
          .then(data => {
            if (data.success && data.thumbnail) {
              setEpisodes(prev => prev.map(e =>
                e.episodeId === ep.episodeId ? { ...e, thumbnail: data.thumbnail } : e
              ));
            }
          })
          .catch(() => {})
          .finally(() => loading.delete(ep.episodeId));
      }
      if (pos < total) thumbTimerRef.current = setTimeout(tick, 200);
    };
    tick();
  }, [thumbEpVersionRef.current, currentSeasonId, id]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-0 bleed-header">
        {isLoading ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-6 animate-pulse">
            <div className="w-full h-[55vh] md:h-[65vh] rounded-2xl bg-gradient-to-br from-[#111844]/20 to-background flex items-end p-8">
              <div className="flex gap-6 items-end w-full">
                <div className="shrink-0 w-28 sm:w-36 md:w-44 lg:w-52 aspect-[2/3] rounded-2xl bg-white/[0.06]" />
                <div className="flex-1 space-y-3 max-w-2xl pb-2">
                  <div className="h-3 w-16 rounded-full bg-white/[0.06]" />
                  <div className="h-8 w-3/4 rounded-lg bg-white/[0.06]" />
                  <div className="h-4 w-1/2 rounded-lg bg-white/[0.04]" />
                  <div className="flex gap-2 mt-2">
                    <div className="h-5 w-14 rounded-full bg-white/[0.05]" />
                    <div className="h-5 w-16 rounded-full bg-white/[0.05]" />
                    <div className="h-5 w-12 rounded-full bg-white/[0.05]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-16">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
              <div className="text-6xl mb-4">😔</div>
              <div className="text-xl font-bold text-white mb-2">Couldn&apos;t load anime</div>
              <div className="text-sm text-white/50 mb-4">{error}</div>
              <Link href="/anime" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4B5694] hover:bg-[#4B5694] text-white rounded-xl text-sm font-bold transition-all">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>
            </div>
          </div>
        ) : anime ? (
          <>
            {/* Hero Banner Section */}
            <div className="relative w-full h-[55vh] md:h-[65vh] flex items-end overflow-hidden">
              <div className="absolute inset-0">
                <img src={anime.poster} alt={anime.name} className="w-full h-full object-cover object-top scale-105 blur-sm brightness-45" onError={(e) => { e.currentTarget.src = ""; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.15)_0%,transparent_60%)]" />
              </div>
              
              <div className="relative z-10 pb-6 md:pb-16 px-5 md:px-12 flex flex-row items-center md:items-end gap-4 sm:gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
                {/* Poster Cover Art (Now visible on all screens!) */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  transition={{ duration: 0.5 }} 
                  className="shrink-0 w-28 sm:w-36 md:w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10"
                >
                  <img src={anime.poster} alt={anime.name} className="w-full h-full object-cover" />
                </motion.div>

                {/* Text Metadata Panel */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.2, duration: 0.5 }} 
                  className="flex flex-col gap-2 md:gap-3 max-w-3xl"
                >
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    <span className="bg-gradient-to-r from-[#111844] to-[#7288AE] text-white text-[9px] md:text-[10px] font-extrabold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase shadow-lg shadow-[#4B5694]/25">Anime</span>
                    {anime.type && <span className="bg-white/10 backdrop-blur-sm text-white/70 text-[9px] md:text-[10px] font-bold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase">{anime.type}</span>}
                    {anime.rating && <span className="bg-white/10 backdrop-blur-sm text-white/70 text-[9px] md:text-[10px] font-bold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase">{anime.rating}</span>}
                    {anime.status && (
                      <span className={`text-[9px] md:text-[10px] font-bold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase ${
                        anime.status === "Airing" || anime.status === "RELEASING" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                        anime.status === "Completed" || anime.status === "FINISHED" ? "bg-white/10 text-white/60 border border-white/20" :
                        "bg-white/10 text-white/60 border border-white/20"
                      }`}>{anime.status}</span>
                    )}
                  </div>
                  <h1 className="font-black text-2xl sm:text-4xl md:text-5xl text-white leading-tight tracking-tight">{anime.name}</h1>
                  {anime.jname && <p className="text-white/40 text-xs sm:text-sm font-medium">{anime.jname}</p>}
                  
                  {anime.genres && anime.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {anime.genres.slice(0, 5).map(g => <span key={g} className="text-[9px] text-[#7288AE] bg-[#4B5694]/10 border border-[#7288AE]/20 px-2 py-0.5 rounded-full font-bold backdrop-blur-sm">{g}</span>)}
                    </div>
                  )}

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
                    {!episodesLoading && episodes.length > 0 ? (
                      <button
                        onClick={() => {
                          const first = episodes.find(ep => ep.isReleased !== false) || episodes[0];
                          handleWatchEpisode(first);
                        }}
                        className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
                      >
                        <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                        {isSingleItem ? `Watch ${currentSeasonInfo?.seasonLabel || "Movie"}` : `Watch S${episodes[0].seasonNum || 1} E${episodes[0].episodeNum}`}
                      </button>
                    ) : !episodesLoading ? (
                      <button
                        disabled
                        className="flex items-center gap-2.5 bg-white/10 text-white/30 font-bold px-8 py-4 rounded-xl text-sm cursor-not-allowed"
                      >
                        No Episodes Available
                      </button>
                    ) : null}
                  </motion.div>
                </motion.div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-6">
              <Link href="/anime" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>

              {/* PLAYER + EPISODE QUEUE SIDEBAR */}
              <div className="flex flex-col gap-6">
                {/* Grid: Player | Queue */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
                  <div ref={playerRef} className="w-full min-w-0">
                    {isPlaying && selectedEp && !episodesLoading && (
                      <motion.div
                        key={selectedEp.episodeId}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <AnimePlayer
                          animeId={selectedEp.seasonId || currentSeasonId}
                          malId={selectedEp.seasonMalId != null ? String(selectedEp.seasonMalId) : anime.idMal}
                          animeTitle={selectedEp.seasonName || anime.name}
                          episode={selectedEp.episodeNum}
                          onAutoNext={handleAutoNext}
                        />
                      </motion.div>
                    )}

                    {episodesLoading && (
                      <div className="w-full aspect-video rounded-2xl bg-black/60 flex items-center justify-center border border-white/10">
                        <div className="text-center">
                          <div className="w-10 h-10 border-3 border-white/10 border-t-[#7288AE] rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-white/40 text-sm">Loading episodes...</p>
                        </div>
                      </div>
                    )}

                    {isPlaying && selectedEp && !episodesLoading && (
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {isSingleItem ? (
                            <span className="text-lg font-black text-white">{selectedEp.title || currentSeasonInfo?.name || anime?.name}</span>
                          ) : (
                            <>
                              <span className="text-lg font-black text-white">Episode {selectedEp.episodeNum}</span>
                              {selectedEp.title && <span className="text-sm text-white/50">— {selectedEp.title}</span>}
                            </>
                          )}
                          {selectedEp.isFiller && (
                            <span className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded font-bold uppercase">Filler</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handlePrev}
                            disabled={currentIdx <= 0 || (episodes[currentIdx - 1]?.isReleased === false)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-30 text-white/60 hover:text-white text-xs font-bold transition-all">
                            <ChevronLeft className="w-4 h-4" /> Prev
                          </button>
                          <span className="text-sm text-white/40 px-2 font-medium">{currentIdx + 1} / {episodes.length}</span>
                          <button onClick={handleNext}
                            disabled={currentIdx >= episodes.length - 1 || (episodes[currentIdx + 1]?.isReleased === false)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-30 text-white/60 hover:text-white text-xs font-bold transition-all">
                            Next <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Episode Queue Sidebar */}
                  {isPlaying && selectedEp && !episodesLoading && (
                    <aside className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col max-h-[60vh] xl:max-h-[70vh]">
                      <div className="p-4 border-b border-white/[0.06] bg-white/[0.01]">
                        <div className="text-sm font-bold text-white flex items-center justify-between">
                          <span>Episode Queue</span>
                          <span className="text-xs font-normal text-white/40">{currentSeasonEps.length} eps</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                        {currentSeasonEps.map((ep) => {
                          const isSelected = selectedEp?.episodeId === ep.episodeId;
                          return (
                            <button
                              key={ep.episodeId}
                              onClick={() => ep.isReleased !== false && handleSelectEp(ep)}
                              disabled={ep.isReleased === false}
                              className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-3 ${
                                isSelected
                                  ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/20"
                                  : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                              }`}
                            >
                              <span className="text-sm font-black w-10 shrink-0">E{ep.episodeNum}</span>
                              <span className="text-xs truncate flex-1 line-clamp-1">{ep.title || `Episode ${ep.episodeNum}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    </aside>
                  )}
                </div>

                {/* Structured Metadata & Synopsis Section */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Side: Synopsis */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-2xl h-full">
                      <h3 className="text-base font-bold text-white mb-3">Synopsis</h3>
                      <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{anime.description || "No synopsis available."}</p>
                    </div>
                  </div>

                  {/* Right Side: Structured Metadata Grid */}
                  <div>
                    <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-2xl space-y-4">
                      <h3 className="text-base font-bold text-white">Details</h3>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                        <div>
                          <span className="text-white/40 block mb-1">Format</span>
                          <span className="text-white font-bold text-sm bg-white/[0.06] px-2.5 py-1 rounded-lg uppercase">{anime.format || anime.type || "TV"}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block mb-1">Rating</span>
                          <span className="text-amber-400 font-bold text-sm bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg flex items-center gap-1 w-max">
                            <Star className="w-3.5 h-3.5 fill-current" /> {anime.rating || anime.score || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/40 block mb-1">Episodes</span>
                          <span className="text-white font-semibold text-sm">{anime.totalEpisodes || episodes.length || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block mb-1">Status</span>
                          <span className="text-white font-semibold text-sm">{anime.status || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block mb-1">Season</span>
                          <span className="text-white font-semibold text-sm uppercase">{anime.season || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-white/40 block mb-1">Year</span>
                          <span className="text-white font-semibold text-sm">{anime.seasonYear || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visually Stunning Episodes Section (Below the Player) */}
              <section className="max-w-5xl mx-auto space-y-4 mt-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full shadow-lg" />
                    <h2 className="text-2xl font-black text-white tracking-tight">Episodes</h2>
                    <span className="text-xs bg-white/[0.06] text-white/50 px-2.5 py-1 rounded-full font-semibold">
                      {episodes.length} Available
                    </span>
                  </div>

                  {/* Season Selector (single set of season buttons) */}
                  {seasons.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {seasons.map((season) => {
                        const isActive = season.id === currentSeasonId;
                        return (
                          <button
                            key={season.id}
                            onClick={() => handleSeasonClick(season)}
                            className={cn(
                              "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                                : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border border-white/[0.06]"
                            )}
                          >
                            {season.seasonLabel} ({season.totalEpisodes} eps)
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {episodesLoading ? (
                  <div className="space-y-3 pt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
                    ))}
                  </div>
                ) : displayedEps.length ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSeasonId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-3 pt-2"
                    >
                      {displayedEps.map((ep, epIdx) => {
                        const isSelected = selectedEp?.episodeId === ep.episodeId;
                        const isUnreleased = ep.isReleased === false;
                        const prevEp = epIdx > 0 ? displayedEps[epIdx - 1] : null;
                        const isNewSeason = !prevEp || prevEp.seasonNum !== ep.seasonNum;
                        return (
                        <div key={ep.episodeId}>
                          {isNewSeason && !isSpecialFormat && (
                            <div className="flex items-center gap-3 pt-2 pb-1">
                              <div className="w-1 h-5 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full shadow-lg shadow-[#7288AE]/20" />
                              <span className="text-sm font-bold text-white/70">{ep.seasonName || `Season ${ep.seasonNum || 1}`}</span>
                              <div className="flex-1 h-px bg-white/[0.06]" />
                            </div>
                          )}
                          <div
                            onClick={() => !isUnreleased && handleSelectEp(ep)}
                            className={cn(
                              "group flex gap-4 p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none touch-manipulation",
                              isSelected
                                ? "ring-2 ring-[#7288AE] bg-gradient-to-br from-[#4B5694]/15 to-[#7288AE]/10 border-transparent shadow-lg shadow-[#4B5694]/20"
                                : isUnreleased
                                ? "opacity-50 cursor-not-allowed bg-white/[0.01] border-white/[0.03]"
                                : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12]"
                            )}
                          >
                            {/* Episode Number Box (Desktop) */}
                            {!isSpecialFormat && (
                              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05] shrink-0 self-start mt-1">
                                <span className="text-sm font-bold text-white/40">{ep.episodeNum}</span>
                              </div>
                            )}

                            {/* Thumbnail */}
                            <div className={`${isSingleItem ? "w-48 md:w-56 aspect-[2/3]" : "w-36 md:w-48 aspect-video"} shrink-0 rounded-xl overflow-hidden bg-muted relative self-start`}>
                              {(ep.thumbnail || (isSingleItem && anime?.poster)) ? (
                                <img
                                  src={(isSingleItem && !ep.thumbnail) ? anime!.poster : ep.thumbnail!}
                                  alt={ep.title || `Episode ${ep.episodeNum}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-card">
                                  <Play className="w-6 h-6 text-white/20" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#4B5694] to-[#7288AE] flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                  <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                                </div>
                              </div>

                              {/* Playing Badge */}
                              {isSelected && (
                                <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-[#7288AE] text-white text-[8px] font-extrabold tracking-widest uppercase">
                                  Playing
                                </div>
                              )}

                              {/* Lock Overlay for Unreleased */}
                              {isUnreleased && (
                                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                                  <Lock className="w-5 h-5 text-white/30" />
                                </div>
                              )}
                            </div>

                            {/* Episode Details */}
                            <div className="flex-1 min-w-0 py-0.5">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h4 className="font-bold text-sm leading-tight text-white">
                                  {isSingleItem ? (
                                    currentSeasonInfo?.name || ep.title || anime?.name
                                  ) : (
                                    <>
                                      <span className="sm:hidden text-white/40 mr-1.5">E{ep.episodeNum}.</span>
                                      {ep.title || `Episode ${ep.episodeNum}`}
                                    </>
                                  )}
                                </h4>
                                {ep.isFiller && (
                                  <span className="text-[9px] text-amber-400 font-extrabold uppercase bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded shrink-0">
                                    Filler
                                  </span>
                                )}
                              </div>
                              <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
                                {isSingleItem ? (anime?.description || ep.description) : (ep.description || "")}
                              </p>
                            </div>
                          </div>
                      </div>
                      );
                    })}
                    {!isSingleItem && hasMoreEps && (
                      <div className="flex justify-center pt-2 pb-4">
                        <button
                          onClick={loadMoreEpisodes}
                          className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white text-sm font-bold hover:shadow-xl hover:shadow-[#4B5694]/25 transition-all"
                        >
                          Show {Math.min(EPISODES_PER_PAGE, currentSeasonEps.length - currentSeasonVisible)} More Episodes
                        </button>
                      </div>
                    )}
                    {!isSingleItem && canFetchMore && !hasMoreEps && (
                      <div className="flex justify-center pt-2 pb-4">
                        <button
                          onClick={loadMoreEpisodes}
                          disabled={loadingMore}
                          className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white text-sm font-bold hover:shadow-xl hover:shadow-[#4B5694]/25 transition-all disabled:opacity-50"
                        >
                          {loadingMore ? "Loading..." : `Load Next ${EPISODES_PER_PAGE} Episodes`}
                        </button>
                      </div>
                    )}
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="p-8 text-center text-white/30 text-sm">
                    No episodes available
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
