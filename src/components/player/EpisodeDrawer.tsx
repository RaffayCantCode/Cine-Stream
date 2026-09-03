"use client";

import { memo, useState, useMemo, useRef, useEffect, useCallback } from "react";
import { X, Play, Clock, Star, Calendar, Search, Layers, SkipForward, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { isEpisodeUpcoming } from "@/lib/episode-availability";
import Image from "next/image";

export interface DrawerEpisode {
  id: number | string;
  episode_number: number;
  season_number?: number;
  name: string;
  overview?: string;
  still_path?: string | null;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
  isFiller?: boolean;
}

export interface DrawerSeason {
  id: number;
  season_number: number;
  name: string;
  episodes?: DrawerEpisode[];
}

interface EpisodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  seasons: DrawerSeason[];
  currentSeason: number;
  currentEpisode: number;
  onSelectEpisode: (season: number, episode: number) => void;
  showTitle?: string;
  isAnime?: boolean;
}

export const EpisodeDrawer = memo(function EpisodeDrawer({
  isOpen,
  onClose,
  seasons,
  currentSeason,
  currentEpisode,
  onSelectEpisode,
  showTitle,
  isAnime = false,
}: EpisodeDrawerProps) {
  const [selectedSeason, setSelectedSeason] = useState<number>(currentSeason || 1);

  useEffect(() => {
    if (currentSeason && Number(currentSeason) > 0) {
      setSelectedSeason(Number(currentSeason));
    }
  }, [currentSeason]);

  const [searchQuery, setSearchQuery] = useState("");
  const episodeListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && episodeListRef.current) {
      const timer = setTimeout(() => {
        const el = (episodeListRef.current?.querySelector('[data-current="true"]') ||
          episodeListRef.current?.querySelector(`[data-episode="${currentEpisode}"]`)) as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedSeason, currentEpisode]);

  const activeSeasonData = useMemo(() => {
    return seasons.find((s) => s.season_number === selectedSeason) || seasons[0];
  }, [seasons, selectedSeason]);

  const filteredEpisodes = useMemo(() => {
    const eps = activeSeasonData?.episodes || [];
    if (!searchQuery.trim()) return eps;
    const q = searchQuery.toLowerCase();
    return eps.filter(
      (ep) =>
        ep.name.toLowerCase().includes(q) ||
        `episode ${ep.episode_number}`.includes(q) ||
        ep.overview?.toLowerCase().includes(q)
    );
  }, [activeSeasonData, searchQuery]);

  const isEpisodeUpcomingFn = useCallback((ep: DrawerEpisode, allEpisodes: DrawerEpisode[]): boolean => {
    if (!ep) return false;
    if (ep.air_date && isEpisodeUpcoming(ep.air_date)) return true;

    const epNum = Number(ep.episode_number);
    const idx = allEpisodes.findIndex((e) => Number(e.episode_number) === epNum);
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        const prev = allEpisodes[i];
        if (prev?.air_date && isEpisodeUpcoming(prev.air_date)) {
          return true;
        }
      }
    }

    if (!ep.air_date && !ep.still_path) {
      const hasUpcomingInSeason = allEpisodes.some(
        (e) => e.air_date && isEpisodeUpcoming(e.air_date) && Number(e.episode_number) <= epNum
      );
      if (hasUpcomingInSeason) return true;
    }

    return false;
  }, []);

  const nextEpisodeInfo = useMemo(() => {
    if (!seasons || seasons.length === 0) return null;
    const curSeasonNum = Number(currentSeason || 1);
    const curEpNum = Number(currentEpisode || 1);

    if (isAnime) {
      const allEps = activeSeasonData?.episodes || seasons[0]?.episodes || [];
      const nextEp = allEps.find((e) => Number(e.episode_number) === curEpNum + 1);
      if (nextEp) {
        if (isEpisodeUpcomingFn(nextEp, allEps)) return null;
        return { season: curSeasonNum, episode: Number(nextEp.episode_number) };
      }
      return null;
    }

    const curSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum);
    const curSeasonEps = curSeason?.episodes || [];
    const nextInSameSeason = curSeasonEps.find((e) => Number(e.episode_number) === curEpNum + 1);
    if (nextInSameSeason) {
      if (isEpisodeUpcomingFn(nextInSameSeason, curSeasonEps)) return null;
      return { season: curSeasonNum, episode: Number(nextInSameSeason.episode_number) };
    }

    const nextSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum + 1);
    if (nextSeason && nextSeason.episodes && nextSeason.episodes.length > 0) {
      const firstEpOfNextSeason = nextSeason.episodes[0];
      if (isEpisodeUpcomingFn(firstEpOfNextSeason, nextSeason.episodes)) return null;
      return { season: Number(nextSeason.season_number), episode: Number(firstEpOfNextSeason.episode_number || 1) };
    }

    return null;
  }, [seasons, currentSeason, currentEpisode, isAnime, activeSeasonData, isEpisodeUpcomingFn]);

  const prevEpisodeInfo = useMemo(() => {
    if (!seasons || seasons.length === 0) return null;
    const curSeasonNum = Number(currentSeason || 1);
    const curEpNum = Number(currentEpisode || 1);

    if (isAnime) {
      if (curEpNum <= 1) return null;
      const allEps = activeSeasonData?.episodes || seasons[0]?.episodes || [];
      const prevEp = allEps.find((e) => Number(e.episode_number) === curEpNum - 1);
      return {
        season: curSeasonNum,
        episode: prevEp ? Number(prevEp.episode_number) : curEpNum - 1,
      };
    }

    const curSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum);
    const curSeasonEps = curSeason?.episodes || [];
    if (curEpNum > 1) {
      const prevInSameSeason = curSeasonEps.find((e) => Number(e.episode_number) === curEpNum - 1);
      return {
        season: curSeasonNum,
        episode: prevInSameSeason ? Number(prevInSameSeason.episode_number) : curEpNum - 1,
      };
    }

    if (curSeasonNum > 1) {
      const prevSeason = seasons.find((s) => Number(s.season_number) === curSeasonNum - 1);
      if (prevSeason && prevSeason.episodes && prevSeason.episodes.length > 0) {
        const lastEpOfPrevSeason = prevSeason.episodes[prevSeason.episodes.length - 1];
        return {
          season: Number(prevSeason.season_number),
          episode: Number(lastEpOfPrevSeason.episode_number || prevSeason.episodes.length),
        };
      }
    }

    return null;
  }, [seasons, currentSeason, currentEpisode, isAnime, activeSeasonData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/75 backdrop-blur-sm animate-fade-in">
      {/* Click outside overlay */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md md:max-w-lg h-full bg-zinc-950/95 border-l border-white/10 p-5 sm:p-6 flex flex-col shadow-2xl z-10 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base tracking-tight truncate max-w-[260px]">
                {showTitle || "Episodes"}
              </h3>
              <p className="text-xs text-white/50">Season {selectedSeason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {prevEpisodeInfo && (
              <button
                onClick={() => {
                  onSelectEpisode(prevEpisodeInfo.season, prevEpisodeInfo.episode);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-black text-xs shadow-md border border-white/15 transition-all cursor-pointer group"
                title={`Jump to Previous Episode (${isAnime ? `EP ${prevEpisodeInfo.episode}` : `S${prevEpisodeInfo.season}E${prevEpisodeInfo.episode}`})`}
              >
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Prev Ep</span>
                <span className="text-[10px] font-bold opacity-75">
                  {isAnime ? `EP ${prevEpisodeInfo.episode}` : `S${prevEpisodeInfo.season}E${prevEpisodeInfo.episode}`}
                </span>
              </button>
            )}

            {nextEpisodeInfo && (
              <button
                onClick={() => {
                  onSelectEpisode(nextEpisodeInfo.season, nextEpisodeInfo.episode);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-black text-xs shadow-md border border-white/20 transition-all cursor-pointer group"
                title={`Jump to Next Episode (${isAnime ? `EP ${nextEpisodeInfo.episode}` : `S${nextEpisodeInfo.season}E${nextEpisodeInfo.episode}`})`}
              >
                <span>Next Ep</span>
                <span className="text-[10px] font-bold opacity-80">
                  {isAnime ? `EP ${nextEpisodeInfo.episode}` : `S${nextEpisodeInfo.season}E${nextEpisodeInfo.episode}`}
                </span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close episode drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Season Selector Tabs */}
        {seasons.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {seasons.map((season) => {
              const isSelected = season.season_number === selectedSeason;
              return (
                <button
                  key={season.id || season.season_number}
                  onClick={() => setSelectedSeason(season.season_number)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/40"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {season.name || `Season ${season.season_number}`}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search episode title or number..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/40 transition-all"
          />
        </div>

        {/* Episode List */}
        <div ref={episodeListRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredEpisodes.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-xs">No episodes found for this search.</div>
          ) : (
            filteredEpisodes.map((ep) => {
              const isCurrentPlaying = isAnime
                ? Number(ep.episode_number) === Number(currentEpisode)
                : Number(selectedSeason) === Number(currentSeason) && Number(ep.episode_number) === Number(currentEpisode);
              const isUpcoming = isEpisodeUpcomingFn(ep, activeSeasonData?.episodes || []);
              const thumbUrl = ep.still_path
                ? ep.still_path.startsWith("http")
                  ? ep.still_path
                  : `https://image.tmdb.org/t/p/w300${ep.still_path}`
                : null;

              return (
                <button
                  key={ep.id || ep.episode_number}
                  data-current={isCurrentPlaying ? "true" : undefined}
                  data-episode={ep.episode_number}
                  disabled={isUpcoming}
                  onClick={() => {
                    if (isUpcoming) return;
                    onSelectEpisode(selectedSeason, ep.episode_number);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-2xl border transition-all flex gap-3.5 group ${
                    isUpcoming
                      ? "bg-white/[0.015] border-white/5 opacity-60 cursor-not-allowed"
                      : isCurrentPlaying
                      ? "bg-emerald-950/30 border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-lg cursor-pointer"
                      : "bg-white/[0.03] border-white/8 hover:bg-white/[0.08] hover:border-white/15 cursor-pointer"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-24 h-16 sm:w-28 sm:h-18 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={ep.name}
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          isUpcoming ? "" : "group-hover:scale-105"
                        }`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px] font-bold">
                        EP {ep.episode_number}
                      </div>
                    )}
                    {!isUpcoming && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-current drop-shadow-md" />
                      </div>
                    )}
                    {isUpcoming && (
                      <div className="absolute inset-0 z-10 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1">
                        <Lock className="w-4 h-4 text-white/60" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/70">Upcoming</span>
                      </div>
                    )}
                    {isCurrentPlaying && (
                      <div className="absolute top-1 left-1 bg-emerald-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                        Current
                      </div>
                    )}
                    {ep.isFiller && !isUpcoming && (
                      <div className="absolute bottom-1 left-1 bg-amber-400 text-black text-[8px] font-black uppercase px-1 py-0.2 rounded shadow border border-amber-300">
                        Filler
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[11px] font-bold text-primary">EP {ep.episode_number}</span>
                      {ep.isFiller && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow">
                          Filler
                        </span>
                      )}
                      {ep.runtime ? (
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {ep.runtime}m
                        </span>
                      ) : null}
                      {ep.vote_average ? (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          {ep.vote_average.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <h4 className={`text-xs sm:text-sm font-bold line-clamp-1 transition-colors ${
                      isCurrentPlaying ? "text-emerald-400 font-extrabold" : "text-white group-hover:text-primary"
                    }`}>
                      {ep.name || `Episode ${ep.episode_number}`}
                    </h4>
                    {ep.overview && (
                      <p className="text-white/45 text-[11px] line-clamp-2 mt-0.5 leading-snug">
                        {ep.overview}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});
