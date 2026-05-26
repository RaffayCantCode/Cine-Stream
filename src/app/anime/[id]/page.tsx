"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { AnimePlayer } from "@/components/AnimePlayer";
import { fetchJson } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";
import { Star, ArrowLeft, Tv2, Clock, ChevronLeft, ChevronRight, List, Calendar, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimeDetail {
  id: string;
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
}

interface Episode {
  episodeId: string;
  episodeNum: number;
  title?: string;
  isFiller?: boolean;
  releasedDate?: string;
  isReleased?: boolean;
}

export default function AnimeDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [showMobileEpisodes, setShowMobileEpisodes] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(id);

  const playerRef = useRef<HTMLDivElement>(null);
  const episodeListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJson<{ success: boolean; data: { anime: AnimeDetail } }>(`/api/anime/${id}`);
        if (data.success && data.data?.anime) {
          const a = data.data.anime;
          setAnime(a);
          setCurrentSeasonId(id);
        } else {
          throw new Error("Anime not found");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load anime");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const loadEpisodes = useCallback(async (seasonId: string) => {
    setEpisodesLoading(true);
    setEpisodes([]);
    setSelectedEp(null);
    setCurrentPage(0);
    try {
      const data = await fetchJson<{ success: boolean; data: { episodes: Episode[]; totalEpisodes: number } }>(`/api/anime/${seasonId}/episodes`);
      if (data.success && data.data?.episodes) {
        const sorted = data.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        const withRelease = sorted.map(ep => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return { ...ep, isReleased: !ep.releasedDate || new Date(ep.releasedDate) <= today };
        });
        setEpisodes(withRelease);
        const first = withRelease.find(ep => ep.isReleased !== false) || withRelease[0];
        if (first) setSelectedEp(first);
      }
    } catch { /* silent */ }
    finally { setEpisodesLoading(false); }
  }, []);

  useEffect(() => {
    if (!id) return;
    loadEpisodes(id);
  }, [id, loadEpisodes]);

  useEffect(() => {
    if (selectedEp) {
      setTimeout(() => {
        playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [selectedEp?.episodeId]);

  const handleSeasonClick = async (season: SeasonInfo) => {
    if (season.isCurrent) return;
    setCurrentSeasonId(season.id);
    setAnime(prev => prev ? { ...prev, totalEpisodes: season.totalEpisodes } : prev);
    setShowMobileEpisodes(false);
    await loadEpisodes(season.id);
  };

  const episodeGroups = episodes.reduce((acc, ep) => {
    const group = Math.floor((ep.episodeNum - 1) / 30);
    if (!acc[group]) acc[group] = [];
    acc[group].push(ep);
    return acc;
  }, {} as Record<number, Episode[]>);

  const totalPages = Object.keys(episodeGroups).length;
  const currentIdx = episodes.findIndex(e => e.episodeId === selectedEp?.episodeId);

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prev = episodes[currentIdx - 1];
      if (prev.isReleased === false) return;
      setSelectedEp(prev);
    }
  };

  const handleNext = () => {
    if (currentIdx < episodes.length - 1) {
      const next = episodes[currentIdx + 1];
      if (next.isReleased === false) return;
      setSelectedEp(next);
    }
  };

  const handleSelectEp = (ep: Episode) => {
    if (ep.isReleased === false) return;
    setSelectedEp(ep);
    setShowMobileEpisodes(false);
  };

  const handleAutoNext = () => handleNext();
  const seasons = anime?.seasons || [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-0">
        {isLoading ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto">
            <div className="w-full h-[60vh] rounded-2xl bg-gradient-to-br from-[#462C7D]/20 to-background animate-pulse" />
          </div>
        ) : error ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
              <div className="text-6xl mb-4">😔</div>
              <div className="text-xl font-bold text-white mb-2">Couldn&apos;t load anime</div>
              <div className="text-sm text-white/50 mb-4">{error}</div>
              <Link href="/anime" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#831C91] hover:bg-[#831C91] text-white rounded-xl text-sm font-bold transition-all">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>
            </div>
          </div>
        ) : anime ? (
          <>
            {/* Hero */}
            <div className="relative w-full h-[55vh] md:h-[65vh] flex items-end overflow-hidden">
              <div className="absolute inset-0">
                <img src={anime.poster} alt={anime.name} className="w-full h-full object-cover object-top scale-105 blur-sm brightness-40" onError={(e) => { e.currentTarget.src = ""; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.15)_0%,transparent_60%)]" />
              </div>
              <div className="relative z-10 pb-10 md:pb-16 px-5 md:px-12 flex items-end gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="hidden md:block shrink-0 w-40 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                  <img src={anime.poster} alt={anime.name} className="w-full h-full object-cover" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex flex-col gap-3 max-w-3xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-gradient-to-r from-[#462C7D] to-[#D552A3] text-white text-[10px] font-extrabold tracking-widest px-3 py-1 rounded-full uppercase shadow-lg shadow-[#831C91]/25">Anime</span>
                    {anime.type && <span className="bg-white/10 backdrop-blur-sm text-white/70 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">{anime.type}</span>}
                    {anime.rating && <span className="bg-white/10 backdrop-blur-sm text-white/70 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">{anime.rating}</span>}
                    {anime.status && (
                      <span className={`text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase ${
                        anime.status === "Airing" || anime.status === "RELEASING" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                        anime.status === "Completed" || anime.status === "FINISHED" ? "bg-white/10 text-white/60 border border-white/20" :
                        "bg-white/10 text-white/60 border border-white/20"
                      }`}>{anime.status}</span>
                    )}
                  </div>
                  <h1 className="font-black text-3xl md:text-5xl text-white leading-tight tracking-tight">{anime.name}</h1>
                  {anime.jname && <p className="text-white/40 text-sm md:text-base font-medium">{anime.jname}</p>}
                  <div className="flex items-center gap-5 flex-wrap text-xs text-white/50">
                    {anime.score && <span className="flex items-center gap-1 text-amber-400 font-bold"><Star className="w-3.5 h-3.5 fill-current" /> {anime.score}</span>}
                    {anime.totalEpisodes > 0 && <span className="flex items-center gap-1"><Tv2 className="w-3.5 h-3.5" /> {anime.totalEpisodes} eps</span>}
                  </div>
                  {anime.genres && anime.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {anime.genres.slice(0, 6).map(g => <span key={g} className="text-[10px] text-[#D552A3] bg-[#831C91]/10 border border-[#D552A3]/20 px-2.5 py-1 rounded-full font-bold backdrop-blur-sm">{g}</span>)}
                    </div>
                  )}
                  <p className="text-white/50 text-sm leading-relaxed line-clamp-3 max-w-2xl">{anime.description}</p>
                </motion.div>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-6">
              <Link href="/anime" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>

              {/* Season Selector */}
              {seasons.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white/40 font-bold uppercase tracking-widest mr-1">Seasons:</span>
                  {seasons.map(season => (
                    <button
                      key={season.id}
                      onClick={() => handleSeasonClick(season)}
                      disabled={season.isCurrent}
                      className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                        season.isCurrent
                          ? "bg-gradient-to-r from-[#462C7D] to-[#D552A3] text-white shadow-lg shadow-[#831C91]/25"
                          : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      {season.seasonLabel}
                      <span className={`ml-1.5 text-[9px] ${season.isCurrent ? "text-white/60" : "text-white/30"}`}>
                        ({season.totalEpisodes} eps)
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Mobile: Episodes toggle + info */}
              <div className="flex md:hidden items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {selectedEp && (
                    <span className="text-base font-bold text-white">Ep {selectedEp.episodeNum}</span>
                  )}
                </div>
                <button onClick={() => setShowMobileEpisodes(!showMobileEpisodes)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white text-sm font-medium transition-all border border-white/[0.06]">
                  <List className="w-4 h-4" />
                  {showMobileEpisodes ? "Hide Episodes" : `Episodes (${episodes.length})`}
                </button>
              </div>

              {/* Mobile: collapsible episode grid */}
              <AnimatePresence>
                {showMobileEpisodes && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="md:hidden overflow-hidden"
                  >
                    <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                      {episodes.map(ep => {
                        const isSelected = selectedEp?.episodeId === ep.episodeId;
                        const isUnreleased = ep.isReleased === false;
                        return (
                          <button key={ep.episodeId} onClick={() => handleSelectEp(ep)} disabled={isUnreleased}
                            className={`aspect-square rounded-xl text-sm font-bold transition-all flex items-center justify-center ${
                              isSelected ? "bg-gradient-to-r from-[#462C7D] to-[#D552A3] text-white shadow-lg" :
                              isUnreleased ? "bg-white/[0.03] text-white/20 cursor-not-allowed" :
                              "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
                            }`}>
                            {isUnreleased ? <Lock className="w-3.5 h-3.5" /> : ep.episodeNum}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* SINGLE PLAYER */}
              <div className="flex gap-6 items-start flex-col md:flex-row">
                <div ref={playerRef} className="w-full md:flex-1 min-w-0">
                  {selectedEp && !episodesLoading && (
                    <motion.div
                      key={selectedEp.episodeId}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <AnimePlayer
                        animeId={currentSeasonId}
                        animeTitle={anime.name}
                        episode={selectedEp.episodeNum}
                        onAutoNext={handleAutoNext}
                      />
                    </motion.div>
                  )}

                  {episodesLoading && (
                    <div className="w-full aspect-video rounded-2xl bg-black/60 flex items-center justify-center border border-white/10">
                      <div className="text-center">
                        <div className="w-10 h-10 border-3 border-white/10 border-t-[#D552A3] rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-white/40 text-sm">Loading episodes...</p>
                      </div>
                    </div>
                  )}

                  {selectedEp && !episodesLoading && (
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-white">Episode {selectedEp.episodeNum}</span>
                        {selectedEp.title && <span className="text-sm text-white/50">— {selectedEp.title}</span>}
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

                {/* Desktop Episode Sidebar */}
                <div className="hidden md:flex w-80 xl:w-96 shrink-0 bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden sticky top-6 max-h-[85vh] flex-col">
                  <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Tv2 className="w-4 h-4 text-[#D552A3]" />
                      Episodes
                      <span className="text-xs text-white/30 font-normal">({episodes.length})</span>
                    </h3>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}
                          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-30 text-white/50 transition-all">
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-white/40 px-1.5 font-medium">{currentPage + 1}/{totalPages}</span>
                        <button onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1}
                          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-30 text-white/50 transition-all">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div ref={episodeListRef} className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                    {episodesLoading ? (
                      <div className="p-4 space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-10 rounded-xl bg-white/[0.05] animate-pulse" />
                        ))}
                      </div>
                    ) : episodeGroups[currentPage]?.length ? (
                      episodeGroups[currentPage]?.map(ep => {
                        const isSelected = selectedEp?.episodeId === ep.episodeId;
                        const isUnreleased = ep.isReleased === false;
                        return (
                          <button key={ep.episodeId} onClick={() => handleSelectEp(ep)} disabled={isUnreleased}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                              isSelected ? "bg-gradient-to-r from-[#462C7D] to-[#D552A3] text-white shadow-lg shadow-[#831C91]/20" :
                              isUnreleased ? "bg-white/[0.02] text-white/20 cursor-not-allowed" :
                              "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                            }`}>
                            <span className={`text-sm font-black w-12 shrink-0 ${isSelected ? "text-white" : ""}`}>
                              {isUnreleased ? <Lock className="w-4 h-4 mx-auto" /> : `Ep ${ep.episodeNum}`}
                            </span>
                            <span className="text-xs truncate flex-1 line-clamp-1">{ep.title || (isUnreleased ? "Not Yet Released" : "No title")}</span>
                            {ep.isFiller && !isSelected && <span className="text-[9px] text-amber-400 font-bold shrink-0">FL</span>}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-white/30 text-sm">
                        {episodesLoading ? "Loading..." : "No episodes available"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
