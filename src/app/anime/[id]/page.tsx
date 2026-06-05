"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { AnimePlayer } from "@/components/AnimePlayer";
import { fetchJson, cn } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";
import { Star, ArrowLeft, Tv2, Clock, ChevronLeft, ChevronRight, List, Calendar, Lock, Play } from "lucide-react";
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
  isFiller?: boolean;
  releasedDate?: string;
  isReleased?: boolean;
  description?: string;
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
  const [currentPage, setCurrentPage] = useState(0);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(id);

  const playerRef = useRef<HTMLDivElement>(null);

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
    await loadEpisodes(season.id);
  };

  const episodeGroups = useMemo(() => {
    return episodes.reduce((acc, ep) => {
      const group = Math.floor((ep.episodeNum - 1) / 30);
      if (!acc[group]) acc[group] = [];
      acc[group].push(ep);
      return acc;
    }, {} as Record<number, Episode[]>);
  }, [episodes]);

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
  };

  const handleAutoNext = () => handleNext();
  const seasons = anime?.seasons || [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-0 bleed-header">
        {isLoading ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-6">
            <div className="w-full h-[60vh] rounded-2xl bg-gradient-to-br from-[#462C7D]/20 to-background animate-pulse" />
          </div>
        ) : error ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-16">
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
                    <span className="bg-gradient-to-r from-[#462C7D] to-[#D552A3] text-white text-[9px] md:text-[10px] font-extrabold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase shadow-lg shadow-[#831C91]/25">Anime</span>
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
                      {anime.genres.slice(0, 5).map(g => <span key={g} className="text-[9px] text-[#D552A3] bg-[#831C91]/10 border border-[#D552A3]/20 px-2 py-0.5 rounded-full font-bold backdrop-blur-sm">{g}</span>)}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-6">
              <Link href="/anime" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>

              {/* SINGLE FULL-WIDTH PLAYER & REDESIGNED SYNOPSIS/METADATA */}
              <div className="flex flex-col gap-6">
                <div ref={playerRef} className="w-full max-w-5xl mx-auto min-w-0">
                  {selectedEp && !episodesLoading && (
                    <motion.div
                      key={selectedEp.episodeId}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Pass malId for highly reliable VidLink Sub/Dub streams */}
                      <AnimePlayer
                        animeId={currentSeasonId}
                        malId={anime.idMal}
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

                {/* Structured Metadata & Synopsis Section */}
                <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
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

              {/* Season Selector */}
              {seasons.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap max-w-5xl mx-auto">
                  <span className="text-xs text-white/40 font-bold uppercase tracking-widest mr-1">Seasons:</span>
                  {seasons.map(season => (
                    <button
                      key={season.id}
                      onClick={() => handleSeasonClick(season)}
                      disabled={season.id === currentSeasonId}
                      className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                        season.id === currentSeasonId
                          ? "bg-gradient-to-r from-[#462C7D] to-[#D552A3] text-white shadow-lg shadow-[#831C91]/25"
                          : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      {season.seasonLabel}
                      <span className={`ml-1.5 text-[9px] ${season.id === currentSeasonId ? "text-white/60" : "text-white/30"}`}>
                        ({season.totalEpisodes} eps)
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Visually Stunning Episodes Section (Below the Player) */}
              <section className="max-w-5xl mx-auto space-y-4 mt-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-gradient-to-b from-[#D552A3] to-[#831C91] rounded-full shadow-lg" />
                    <h2 className="text-2xl font-black text-white tracking-tight">Episodes</h2>
                    <span className="text-xs bg-white/[0.06] text-white/50 px-2.5 py-1 rounded-full font-semibold">
                      {episodes.length} Available
                    </span>
                  </div>

                  {/* Range Tabs Selector (Jump directly between sets of 30 episodes) */}
                  {totalPages > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: totalPages }).map((_, idx) => {
                        const start = idx * 30 + 1;
                        const end = Math.min((idx + 1) * 30, episodes.length);
                        const isCurrentPage = currentPage === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setCurrentPage(idx)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                              isCurrentPage 
                                ? "bg-gradient-to-r from-[#831C91] to-[#D552A3] text-white shadow-md shadow-[#831C91]/25" 
                                : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                            )}
                          >
                            {start}-{end}
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
                ) : episodeGroups[currentPage]?.length ? (
                  <div className="space-y-3 pt-2">
                    {episodeGroups[currentPage].map((ep) => {
                      const isSelected = selectedEp?.episodeId === ep.episodeId;
                      const isUnreleased = ep.isReleased === false;
                      return (
                        <div
                          key={ep.episodeId}
                          onClick={() => !isUnreleased && handleSelectEp(ep)}
                          className={cn(
                            "group flex gap-4 p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none touch-manipulation",
                            isSelected 
                              ? "ring-2 ring-[#D552A3] bg-gradient-to-br from-[#831C91]/15 to-[#D552A3]/10 border-transparent shadow-lg shadow-[#831C91]/20" 
                              : isUnreleased
                              ? "opacity-50 cursor-not-allowed bg-white/[0.01] border-white/[0.03]"
                              : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12]"
                          )}
                        >
                          {/* Episode Number Box (Desktop) */}
                          <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05] shrink-0 self-start mt-1">
                            <span className="text-sm font-bold text-white/40">{ep.episodeNum}</span>
                          </div>

                          {/* Cover Thumbnail aspect-video */}
                          <div className="w-36 md:w-48 shrink-0 aspect-video rounded-xl overflow-hidden bg-muted relative self-start">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
                            
                            {/* Episode thumbnail with anime poster fallback */}
                            <img
                              src={ep.thumbnail || anime.poster}
                              alt={ep.title || `Episode ${ep.episodeNum}`}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { e.currentTarget.src = anime.poster; }}
                            />
                            
                            {/* Play Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#831C91] to-[#D552A3] flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                              </div>
                            </div>

                            {/* Playing Badge */}
                            {isSelected && (
                              <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-[#D552A3] text-white text-[8px] font-extrabold tracking-widest uppercase">
                                Playing
                              </div>
                            )}

                            {/* Lock Icon for Unreleased */}
                            {isUnreleased && (
                              <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                                <Lock className="w-5 h-5 text-white/30" />
                              </div>
                            )}

                            {/* EP tag bottom right */}
                            {!isUnreleased && (
                              <div className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-white/90 text-[10px] font-black">
                                EP {ep.episodeNum}
                              </div>
                            )}
                          </div>

                          {/* Episode Details */}
                          <div className="flex-1 min-w-0 py-0.5">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h4 className="font-bold text-sm leading-tight text-white flex items-center gap-2">
                                <span className="sm:hidden text-white/40">E{ep.episodeNum}.</span>
                                <span>{ep.title || `Episode ${ep.episodeNum}`}</span>
                                {ep.isFiller && (
                                  <span className="text-[9px] text-amber-400 font-extrabold uppercase bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                                    Filler
                                  </span>
                                )}
                              </h4>
                            </div>
                            <p className="text-white/45 text-xs leading-relaxed line-clamp-2">
                              {ep.description || `Watch Episode ${ep.episodeNum} of ${anime.name} in high quality with English subtitles.`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
