"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { AnimePlayer } from "@/components/AnimePlayer";
import { AnimeRow } from "@/components/AnimeRow";
import { fetchJson, cn } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";
import { Star, ArrowLeft, ChevronLeft, ChevronRight, Lock, Play, ExternalLink, BookOpen, Loader2, LayoutGrid, List } from "lucide-react";


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
  openedSeasonId?: string | null;
  tmdbId?: number | null;
  duration?: number | null;
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
  vote_average?: number;
  runtime?: number;
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

  // Franchise node data for Season Guide
  const [franchiseNodes, setFranchiseNodes] = useState<FranchiseNode[]>([]);
  const [showSeasonGuide, setShowSeasonGuide] = useState(false);

  const tmdbIdRef = useRef<number | null>(null);
  const [seasonOverview, setSeasonOverview] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  interface FranchiseNode {
    id: number;
    idMal: number | null;
    title: string;
    episodes: number | null;
    season: string | null;
    seasonYear: number | null;
    format: string | null;
  }

  // currentSeasonId tracks the ACTIVE season by its AniList ID
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(id);

  const playerRef = useRef<HTMLDivElement>(null);

  // Tracks which seasonIds we have already loaded episodes for
  const loadedSeasonIds = useRef<Set<string>>(new Set());

  function isEpisodeReleased(releasedDate: string | null | undefined): boolean {
    // Keep episodes always unlocked so users can attempt to stream them
    // even if the release dates/times in the database are inaccurate.
    return true;
  }

  // ── Fetch episodes for a specific season by its AniList ID ─────────────
  // NOTE: Must be defined before the meta useEffect that calls it
  const loadSeasonEpisodes = useCallback(async (seasonId: string, forceReload = false) => {
    if (!forceReload && loadedSeasonIds.current.has(seasonId)) return;

    setEpisodesLoading(true);
    setSeasonOverview(null);
    try {
      const epData = await fetchJson<{ success: boolean; data: { episodes: Episode[]; seasonOverview?: string | null } }>(
        `/api/anime/${id}/episodes?seasonId=${encodeURIComponent(seasonId)}`
      );
      if (epData.success && epData.data?.episodes?.length) {
        const sorted = epData.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        const withRelease = sorted.map(ep => ({
          ...ep, isReleased: isEpisodeReleased(ep.releasedDate)
        }));
        setEpisodes(prev => {
          // Replace episodes for this season, keep others
          const otherSeasons = prev.filter(e => e.seasonId !== seasonId);
          const merged = [...otherSeasons, ...withRelease].sort((a, b) => {
            if ((a.seasonNum || 1) !== (b.seasonNum || 1)) return (a.seasonNum || 1) - (b.seasonNum || 1);
            return a.episodeNum - b.episodeNum;
          });
          return merged;
        });
        setSeasonOverview(epData.data.seasonOverview || null);
        loadedSeasonIds.current.add(seasonId);
      }
    } catch { /* silent */ }
    finally { setEpisodesLoading(false); }
  }, [id]);

  // ── Load meta (fast, skipEpisodes) ─────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadedSeasonIds.current.clear();
    tmdbIdRef.current = null;

    const loadMeta = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJson<{ success: boolean; data: { anime: AnimeDetail; franchiseNodes?: FranchiseNode[]; tmdbSeasonMap?: Record<string, number> } }>(`/api/anime/${id}/meta`);
        if (cancelled) return;
        if (data.success && data.data?.anime) {
          const a = data.data.anime;
          setAnime(a);
          if (data.data.franchiseNodes) setFranchiseNodes(data.data.franchiseNodes);
          tmdbIdRef.current = a.tmdbId || null;

          // Determine which season should be pre-selected:
          // 1) The openedSeasonId returned by the server (the URL ID resolves to its canonical season)
          // 2) Fallback: the first season in the list
          const seasons = a.seasons || [];
          const openedId = a.openedSeasonId || id;

          // Find it in the season list
          const matchingSeason = seasons.find(s => s.id === openedId);
          const activeSeason = matchingSeason || seasons[0];
          const activeSeasonId = activeSeason?.id || openedId;

          setCurrentSeasonId(activeSeasonId);

          // Load the active season's episodes immediately
          loadSeasonEpisodes(activeSeasonId);
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
    return () => { cancelled = true; };
  }, [id, loadSeasonEpisodes]);

  // ── Fetch You May Like recommendations ─────────────────────────────────
  useEffect(() => {
    if (!anime || !id) return;
    setRecsLoading(true);
    const genres = anime.genres?.length ? anime.genres.join(",") : "";
    const franchiseIds = franchiseNodes.map(n => n.id).filter(Boolean).join(",");
    const excludeIds = [id, franchiseIds].filter(Boolean).join(",");
    fetch(`/api/anime/recommendations/${id}?genres=${encodeURIComponent(genres)}&minItems=12&excludeIds=${encodeURIComponent(excludeIds)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.items?.length) {
          setRecommendations(data.items);
        }
      })
      .catch(() => {})
      .finally(() => setRecsLoading(false));
  }, [anime?.id, id, franchiseNodes]);

  // ── Autoplay via URL params ─────────────────────────────────────────────
  useEffect(() => {
    const autoPlay = searchParams.get("autoplay") === "1";
    const episodeParam = Number(searchParams.get("episode") || "");
    const seasonIdParam = searchParams.get("seasonId") || "";
    const legacySeasonParam = Number(searchParams.get("season") || "");

    if (autoPlay && episodes.length > 0) {
      const target = episodes.find(ep => {
        const matchesSeasonId = seasonIdParam ? ep.seasonId === seasonIdParam : true;
        const matchesLegacySeason = legacySeasonParam ? ep.seasonNum === legacySeasonParam : true;
        return matchesSeasonId && matchesLegacySeason && ep.episodeNum === (episodeParam || 1);
      });
      if (target) {
        setSelectedEp(target);
        setIsPlaying(true);
      }
    }
  }, [searchParams, episodes]);

  // ── Scroll to player on play ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedEp || !isPlaying || episodesLoading) return;
    const timer = setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedEp?.episodeId, isPlaying, episodesLoading]);

  // ── Season overview text from TMDB (included in episodes response) ────
  // The episodes endpoint now returns TMDB-enriched data directly with seasonOverview

  // ── Season click handler ────────────────────────────────────────────────
  const handleSeasonClick = useCallback((season: SeasonInfo) => {
    if (season.id === currentSeasonId) return;
    setCurrentSeasonId(season.id);
    setIsPlaying(false);
    setSelectedEp(null);
    loadSeasonEpisodes(season.id);
  }, [currentSeasonId, loadSeasonEpisodes]);

  // ── Watch episode handler ───────────────────────────────────────────────
  const handleWatchEpisode = useCallback((ep: Episode) => {
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
  }, [authStatus, anime]);

  const [gridMode, setGridMode] = useState(false);

  // ── Derived state ───────────────────────────────────────────────────────
  const EPISODES_PER_PAGE = 20;

  const seasons = useMemo(() => anime?.seasons || [], [anime]);

  // Group all loaded episodes by seasonId
  const episodesBySeason = useMemo(() => {
    return episodes.reduce((acc, ep) => {
      const key = ep.seasonId || "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(ep);
      return acc;
    }, {} as Record<string, Episode[]>);
  }, [episodes]);

  const currentSeasonEps = useMemo(
    () => (episodesBySeason[currentSeasonId] || []).sort((a, b) => a.episodeNum - b.episodeNum),
    [episodesBySeason, currentSeasonId]
  );

  const [visibleCount, setVisibleCount] = useState(EPISODES_PER_PAGE);

  // Reset visible count when season changes
  useEffect(() => {
    setVisibleCount(EPISODES_PER_PAGE);
  }, [currentSeasonId]);

  const currentIdx = useMemo(
    () => currentSeasonEps.findIndex(e => e.episodeId === selectedEp?.episodeId),
    [currentSeasonEps, selectedEp]
  );
  const currentSeasonInfo = useMemo(
    () => seasons.find(s => s.id === currentSeasonId),
    [seasons, currentSeasonId]
  );

  const isSpecialFormat = useMemo(
    () =>
      currentSeasonInfo?.seasonLabel?.toLowerCase().startsWith("movie") ||
      currentSeasonInfo?.seasonLabel?.toLowerCase().startsWith("ova") ||
      currentSeasonInfo?.seasonLabel?.toLowerCase().startsWith("special"),
    [currentSeasonInfo]
  );

  const isSingleItem = currentSeasonEps.length <= 1 && isSpecialFormat;

  // Ensure AnimePlayer always gets a valid numeric AniList ID for streaming URLs
  // Synthetic season IDs (generated by buildSeasonsFromTmdb for unmatched TMDB seasons)
  // start with "tmdb-" and won't work as streaming identifiers.
  // Fall back to the page's main AniList ID in that case.
  const streamingAnimeId = useMemo(() => {
    const id = selectedEp?.seasonId || currentSeasonId;
    if (id.startsWith("tmdb-")) return anime?.id || id;
    return id;
  }, [selectedEp?.seasonId, currentSeasonId, anime?.id]);

  const streamingMalId = useMemo(() => {
    if (selectedEp?.seasonMalId != null) return String(selectedEp.seasonMalId);
    return anime?.idMal || null;
  }, [selectedEp?.seasonMalId, anime?.idMal]);

  const rootSeason = useMemo(() => {
    return seasons[0] || null;
  }, [seasons]);

  const currentSeason = useMemo(() => {
    const sId = selectedEp?.seasonId || currentSeasonId;
    return seasons.find(s => s.id === sId) || null;
  }, [seasons, selectedEp?.seasonId, currentSeasonId]);

  const currentEpisodeOffset = useMemo(() => {
    return currentSeason?.episodeOffset || 0;
  }, [currentSeason]);

  const franchiseAbsoluteEp = useMemo(() => {
    const currentIdx = seasons.findIndex(s => s.id === currentSeasonId);
    if (currentIdx < 0) return 0;
    const prevTotal = seasons.slice(0, currentIdx).reduce((sum, s) => sum + (s.totalEpisodes || 0), 0);
    return prevTotal + (selectedEp?.episodeNum || 0);
  }, [seasons, currentSeasonId, selectedEp?.episodeNum]);

  // ── Prev / Next episode ─────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    if (currentIdx > 0) {
      const prev = currentSeasonEps[currentIdx - 1];
      if (prev.isReleased === false) return;
      handleWatchEpisode(prev);
    }
  }, [currentIdx, currentSeasonEps, handleWatchEpisode]);

  const handleNext = useCallback(() => {
    if (currentIdx < currentSeasonEps.length - 1) {
      const next = currentSeasonEps[currentIdx + 1];
      if (next.isReleased === false) return;
      handleWatchEpisode(next);
    }
  }, [currentIdx, currentSeasonEps, handleWatchEpisode]);

  const handleAutoNext = useCallback(() => handleNext(), [handleNext]);

  // ── Lazy thumbnail loading ──────────────────────────────────────────────
  const thumbnailFetchingRef = useRef(new Set<string>());
  const thumbEpVersionRef = useRef(0);

  useEffect(() => {
    thumbEpVersionRef.current++;
    thumbnailFetchingRef.current.clear();
  }, [currentSeasonId]);

  useEffect(() => {
    const loading = thumbnailFetchingRef.current;
    const currentEps = currentSeasonEps.slice(0, visibleCount);
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
    let pos = 0;
    const total = needThumb.length;

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
      if (pos < total) setTimeout(tick, 200);
    };
    tick();
  }, [visibleCount, currentSeasonId, id, currentSeasonEps.length]);

  // ── Render ──────────────────────────────────────────────────────────────
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
            {/* ── Hero Banner ── */}
            <div className="relative w-full h-[55vh] md:h-[65vh] flex items-end overflow-hidden">
              <div className="absolute inset-0">
                <img
                  src={anime.poster}
                  alt={anime.name}
                  className="w-full h-full object-cover object-center md:object-top scale-105 blur-sm brightness-45"
                  onError={(e) => { e.currentTarget.src = ""; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.15)_0%,transparent_60%)]" />
              </div>

              <div className="relative z-10 pb-6 md:pb-16 px-5 md:px-12 flex flex-row items-center md:items-end gap-4 sm:gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
                <div
                  className="shrink-0 w-28 sm:w-36 md:w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10"
                >
                  <img src={anime.poster} alt={anime.name} className="w-full h-full object-cover" />
                </div>

                <div
                  className="flex flex-col gap-2 md:gap-3 max-w-3xl"
                >
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    <span className="bg-gradient-to-r from-[#111844] to-[#7288AE] text-white text-[9px] md:text-[10px] font-extrabold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase shadow-lg shadow-[#4B5694]/25">Anime</span>
                    {anime.type && <span className="bg-white/10 backdrop-blur-sm text-white/70 text-[9px] md:text-[10px] font-bold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase">{anime.type}</span>}
                    {anime.rating && <span className="bg-white/10 backdrop-blur-sm text-white/70 text-[9px] md:text-[10px] font-bold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase">{anime.rating}</span>}
                    {anime.status && (
                      <span className={`text-[9px] md:text-[10px] font-bold tracking-widest px-2.5 py-0.5 md:py-1 rounded-full uppercase ${
                        anime.status === "Airing" || anime.status === "RELEASING"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-white/10 text-white/60 border border-white/20"
                      }`}>{anime.status}</span>
                    )}
                  </div>
                  <h1 className="font-black text-2xl sm:text-4xl md:text-5xl text-white leading-tight tracking-tight">{anime.name}</h1>
                  {anime.jname && <p className="text-white/40 text-xs sm:text-sm font-medium">{anime.jname}</p>}

                  {/* Season count pill */}
                  {seasons.length > 1 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-[#7288AE] bg-[#4B5694]/15 border border-[#7288AE]/20 px-2.5 py-0.5 rounded-full">
                        {seasons.filter(s => s.seasonLabel.startsWith("Season")).length} Seasons
                        {seasons.filter(s => !s.seasonLabel.startsWith("Season")).length > 0 && ` + ${seasons.filter(s => !s.seasonLabel.startsWith("Season")).length} More`}
                      </span>
                    </div>
                  )}

                  {anime.genres && anime.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {anime.genres.slice(0, 5).map(g => (
                        <span key={g} className="text-[9px] text-[#7288AE] bg-[#4B5694]/10 border border-[#7288AE]/20 px-2 py-0.5 rounded-full font-bold backdrop-blur-sm">{g}</span>
                      ))}
                    </div>
                  )}

                  <div>
                    {!episodesLoading && currentSeasonEps.length > 0 ? (
                      <button
                        onClick={() => {
                          const first = currentSeasonEps.find(ep => ep.isReleased !== false) || currentSeasonEps[0];
                          handleWatchEpisode(first);
                        }}
                        className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
                      >
                        <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                        {isSingleItem
                          ? `Watch ${anime.type === "MOVIE" ? "Movie" : "Anime"}`
                          : `Watch S${currentSeasonInfo ? seasons.findIndex(s => s.id === currentSeasonId) + 1 : 1} E${currentSeasonEps[0]?.episodeNum || 1}`
                        }
                      </button>
                    ) : !episodesLoading ? (
                      <button disabled className="flex items-center gap-2.5 bg-white/10 text-white/30 font-bold px-8 py-4 rounded-xl text-sm cursor-not-allowed">
                        No Episodes Available
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Main Content ── */}
            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-6">
              <Link href="/anime" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>

              <div className="flex flex-col gap-6">
                {/* ── Player + Queue ── */}
                {isPlaying && selectedEp && (
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
                    <div ref={playerRef} className="w-full min-w-0">
                      {!episodesLoading && (
                        <div
                          key={selectedEp.episodeId}
                        >
                          <AnimePlayer
                            animeId={streamingAnimeId}
                            malId={streamingMalId}
                            animeTitle={selectedEp.seasonName || anime.name}
                            episode={selectedEp.episodeNum}
                            rootAnimeId={rootSeason?.id || anime?.id}
                            rootMalId={rootSeason?.idMal ? String(rootSeason.idMal) : (anime?.idMal || null)}
                            episodeOffset={currentEpisodeOffset}
                            tmdbId={currentSeason?.tmdbId || anime?.tmdbId || null}
                            tmdbSeason={currentSeason?.tmdbSeasonNumber ?? null}
                            onAutoNext={handleAutoNext}
                          />
                        </div>
                      )}

                      {episodesLoading && (
                        <div className="w-full aspect-video rounded-2xl bg-black/60 flex items-center justify-center border border-white/10">
                          <div className="text-center">
                            <div className="w-10 h-10 border-3 border-white/10 border-t-[#7288AE] rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-white/40 text-sm">Loading episode...</p>
                          </div>
                        </div>
                      )}

                      {!episodesLoading && (
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
                            <button
                              onClick={handlePrev}
                              disabled={currentIdx <= 0 || (currentSeasonEps[currentIdx - 1]?.isReleased === false)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-30 text-white/60 hover:text-white text-xs font-bold transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" /> Prev
                            </button>
                            <span className="text-sm text-white/40 px-2 font-medium">{currentIdx + 1} / {currentSeasonEps.length}</span>
                            <button
                              onClick={handleNext}
                              disabled={currentIdx >= currentSeasonEps.length - 1 || (currentSeasonEps[currentIdx + 1]?.isReleased === false)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-30 text-white/60 hover:text-white text-xs font-bold transition-all"
                            >
                              Next <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Episode Queue Sidebar ── */}
                    {!episodesLoading && (
                      <aside className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col max-h-[60vh] xl:max-h-[70vh]">
                        <div className="p-4 border-b border-white/[0.06] bg-white/[0.01]">
                          <div className="text-sm font-bold text-white flex items-center justify-between">
                            <span>{currentSeasonInfo?.seasonLabel || "Episodes"}</span>
                            <span className="text-xs font-normal text-white/40">{currentSeasonEps.length} eps</span>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                          {currentSeasonEps.map((ep) => {
                            const isSelected = selectedEp?.episodeId === ep.episodeId;
                            const displayTitle = ep.title || `Episode ${ep.episodeNum}`;
                            return (
                              <button
                                key={ep.episodeId}
                                onClick={() => ep.isReleased !== false && handleWatchEpisode(ep)}
                                disabled={ep.isReleased === false}
                                className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-3 ${
                                  isSelected
                                    ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/20"
                                    : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                                }`}
                              >
                                <span className="text-sm font-black w-10 shrink-0">E{ep.episodeNum}</span>
                                <span className="text-xs truncate flex-1 line-clamp-1">{displayTitle}</span>
                                {ep.runtime && ep.runtime > 0 && (
                                  <span className="text-[10px] text-white/40 font-medium shrink-0">{ep.runtime}m</span>
                                )}
                                {ep.isFiller && (
                                  <span className="text-[9px] text-amber-400 font-extrabold uppercase bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded shrink-0">Filler</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </aside>
                    )}
                  </div>
                )}

                {/* ── Metadata + Synopsis ── */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-2xl h-full">
                      <h3 className="text-base font-bold text-white mb-3">Synopsis</h3>
                      <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{anime.description || "No synopsis available."}</p>
                    </div>
                  </div>

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
                          <span className="text-white/40 block mb-1">Seasons</span>
                          <span className="text-white font-semibold text-sm">{seasons.length || 1}</span>
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

                    {/* ── Source Reference ── */}
                    <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-2xl space-y-3">
                      <h3 className="text-base font-bold text-white">Anime Reference</h3>
                      <p className="text-[10px] text-white/40 leading-relaxed">
                        Verify this anime&apos;s information on the original source provider.
                      </p>
                      <div className="flex flex-col gap-2">
                        <a
                          href={`https://anilist.co/anime/${anime.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#4B5694]/20 to-[#7288AE]/10 border border-[#7288AE]/20 text-white/80 hover:text-white hover:border-[#7288AE]/40 text-xs font-bold transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          View on AniList
                        </a>
                        {anime.idMal && (
                          <a
                            href={`https://myanimelist.net/anime/${anime.idMal}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/20 text-white/60 hover:text-white text-xs font-bold transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            View on MyAnimeList
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Episodes Section ── */}
              <section className="max-w-5xl mx-auto space-y-4 mt-10">
                {/* ── Season Guide Section (franchise order reference) ── */}
                {franchiseNodes.length > 1 && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setShowSeasonGuide(!showSeasonGuide)}
                      className="flex items-center justify-between w-full text-left px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <BookOpen className="w-4 h-4 text-[#7288AE]" />
                        <h3 className="text-base font-bold text-white">Season Guide</h3>
                        <span className="text-[10px] text-white/30 font-medium">
                          {franchiseNodes.length} {franchiseNodes.length === 1 ? "entry" : "entries"}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-white/40 transition-transform ${showSeasonGuide ? "rotate-90" : ""}`} />
                    </button>

                    {showSeasonGuide && (
                      <div className="px-5 pb-5 space-y-2 border-t border-white/[0.06] pt-4">
                        {franchiseNodes.map((node) => {
                          const nodeId = String(node.id);
                          const isActive = nodeId === currentSeasonId || nodeId === anime?.id;
                          const formatLabel = node.format === "TV" ? "TV" : node.format || "";
                          return (
                            <Link
                              key={node.id}
                              href={`/anime/${node.id}`}
                              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                                isActive
                                  ? "bg-gradient-to-r from-[#111844]/30 to-[#7288AE]/20 border border-[#7288AE]/30 text-white"
                                  : "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[#7288AE] font-bold shrink-0 w-16 text-left uppercase">{formatLabel}</span>
                                <span className="truncate">{node.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {node.seasonYear && <span className="text-white/30 text-[10px]">{node.seasonYear}</span>}
                                <span className="text-white/40 text-[10px] bg-white/[0.06] px-2 py-0.5 rounded-md">{node.episodes || "?"} eps</span>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#7288AE] animate-pulse" />}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full shadow-lg" />
                      <h2 className="text-2xl font-black text-white tracking-tight">Episodes</h2>
                      {currentSeasonInfo && (
                        <span className="text-xs bg-white/[0.06] text-white/50 px-2.5 py-1 rounded-full font-semibold">
                          {currentSeasonInfo.seasonLabel}
                        </span>
                      )}
                      {!episodesLoading && currentSeasonEps.length > 0 && (
                        <button
                          onClick={() => setGridMode(g => !g)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white border border-white/[0.06]"
                          title={gridMode ? "Switch to list view" : "Switch to compact grid view"}
                        >
                          {gridMode ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                          {gridMode ? "List" : "Grid"}
                        </button>
                      )}
                    </div>

                  {/* ── Season Tabs ── */}
                  {seasons.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap max-w-xl justify-end">
                      {seasons.map((season) => {
                        const isActive = season.id === currentSeasonId;
                        return (
                          <button
                            key={season.id}
                            onClick={() => handleSeasonClick(season)}
                            className={cn(
                              "px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap flex items-center gap-1.5",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                                : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border border-white/[0.06]"
                            )}
                          >
                            {season.seasonLabel}
                            {isActive && episodesLoading && (
                              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Source disclaimer ── */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-xs leading-relaxed mb-4">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                  </svg>
                  <span>If an episode doesn&apos;t load, try switching to a different source &mdash; some sources may not have every title.</span>
                </div>

                {/* ── Episode Display (TMDB-enriched data from server) ── */}
                {(() => {
                  // Episodes are already TMDB-enriched from the server endpoint
                  // currentSeasonEps has titles, thumbnails, descriptions, ratings, runtimes from TMDB
                  if (episodesLoading && currentSeasonEps.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] min-h-[260px] text-center backdrop-blur-md relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#4B5694]/5 via-transparent to-[#7288AE]/5 animate-pulse" />
                        <div className="relative z-10 space-y-4">
                          <div className="relative w-16 h-16 mx-auto animate-spin">
                            <div className="absolute inset-0 border-4 border-[#7288AE]/10 rounded-full" />
                            <div className="absolute inset-0 border-4 border-t-primary rounded-full" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold text-white tracking-wide animate-pulse">Episodes Loading</h3>
                            <p className="text-sm text-white/40">Please wait while we fetch the latest episodes...</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (currentSeasonEps.length === 0) {
                    return (
                      <div className="p-8 text-center text-white/30 text-sm">
                        No episodes available
                      </div>
                    );
                  }

                  if (gridMode) {
                    const sliceEps = currentSeasonEps.slice(0, visibleCount);
                    const hasMore = visibleCount < currentSeasonEps.length;
                    return (
                        <div
                          key={`grid-${currentSeasonId}`}
                        >
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1.5">
                            {sliceEps.map((ep) => {
                              const isSelected = selectedEp?.episodeId === ep.episodeId;
                              const isUnreleased = ep.isReleased === false;
                              return (
                                <button
                                  key={ep.episodeId}
                                  onClick={() => { if (isUnreleased) return; handleWatchEpisode(ep); }}
                                  disabled={isUnreleased}
                                  className={cn(
                                    "aspect-square rounded-lg text-xs font-bold transition-all flex items-center justify-center relative",
                                    isSelected
                                      ? "bg-gradient-to-br from-[#4B5694] to-[#7288AE] text-white shadow-md shadow-[#4B5694]/30 scale-105"
                                      : isUnreleased
                                      ? "bg-white/[0.03] text-white/20 cursor-not-allowed"
                                      : "bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border border-white/[0.06] hover:border-white/20"
                                  )}
                                >
                                  {ep.isFiller && !isSelected && (
                                    <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-400" />
                                  )}
                                  {ep.episodeNum}
                                </button>
                              );
                            })}
                          </div>
                          {hasMore && (
                            <div className="flex justify-center pt-4 pb-2">
                              <button
                                onClick={() => setVisibleCount(c => c + EPISODES_PER_PAGE)}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white text-sm font-bold hover:shadow-xl hover:shadow-[#4B5694]/25 transition-all"
                              >
                                Show {Math.min(EPISODES_PER_PAGE, currentSeasonEps.length - visibleCount)} More Episodes
                              </button>
                            </div>
                          )}
                        </div>
                    );
                  }

                  const sliceEps = currentSeasonEps.slice(0, visibleCount);
                  const hasMore = visibleCount < currentSeasonEps.length;

                  return (
                      <div
                        key={currentSeasonId}
                      >
                        {/* Season description (TMDB overview from episodes response) */}
                        {seasonOverview && (
                          <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-2xl italic">
                            {seasonOverview}
                          </p>
                        )}

                        <div className="space-y-3">
                          {sliceEps.map((ep, i) => {
                            const isSelected = selectedEp?.episodeId === ep.episodeId;
                            const isUnreleased = ep.isReleased === false;
                            const thumbSrc = ep.thumbnail
                              || (isSingleItem && anime?.poster)
                              || null;
                            const displayTitle = ep.title || (isSingleItem ? (anime?.name || "") : `Episode ${ep.episodeNum}`);
                            return (
                              <div
                                key={`${currentSeasonId}-${ep.episodeNum}-${ep.episodeId || 'ep'}`}
                                onClick={() => {
                                  if (isUnreleased) return;
                                  handleWatchEpisode(ep);
                                }}
                                className={cn(
                                  "group flex gap-4 p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none touch-manipulation",
                                  isSelected
                                    ? "ring-2 ring-[#7288AE] bg-gradient-to-br from-[#4B5694]/15 to-[#7288AE]/10 border-transparent shadow-lg shadow-[#4B5694]/20"
                                    : isUnreleased
                                    ? "opacity-50 cursor-not-allowed bg-white/[0.01] border-white/[0.03]"
                                    : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12]"
                                )}
                              >
                                {/* Episode Number — show for any season with 2+ episodes */}
                                {currentSeasonEps.length > 1 && (
                                  <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05] shrink-0 self-start mt-1">
                                    <span className="text-sm font-bold text-white/40">{ep.episodeNum}</span>
                                  </div>
                                )}

                                {/* Thumbnail */}
                                <div className={`${isSingleItem ? "w-48 md:w-56 aspect-[2/3]" : "w-36 md:w-48 aspect-video"} shrink-0 rounded-xl overflow-hidden bg-muted relative self-start`}>
                                  {thumbSrc ? (
                                    <img
                                      src={thumbSrc}
                                      alt={displayTitle || `Episode ${ep.episodeNum}`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-card">
                                      <Play className="w-6 h-6 text-white/20" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                    <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-[#7288AE] text-white text-[8px] font-extrabold tracking-widest uppercase">
                                      Playing
                                    </div>
                                  )}
                                  {isUnreleased && (
                                    <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                                      <Lock className="w-5 h-5 text-white/30" />
                                    </div>
                                  )}
                                </div>

                                {/* Episode Info */}
                                <div className="flex-1 min-w-0 py-0.5">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <h4 className="font-bold text-sm leading-tight text-white">
                                      <span className="sm:hidden text-white/40 mr-1.5">E{ep.episodeNum}.</span>
                                      {displayTitle}
                                    </h4>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {ep.vote_average && ep.vote_average > 0 && (
                                        <div className="flex items-center gap-0.5 text-amber-400">
                                          <Star className="w-3 h-3 fill-current" />
                                          <span className="font-bold text-xs">{ep.vote_average.toFixed(1)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {ep.releasedDate && (
                                    <p className="text-[10px] text-white/30 mb-1 font-medium">
                                      {new Date(ep.releasedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                    </p>
                                  )}
                                  {ep.description && (
                                    <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
                                      {ep.description}
                                    </p>
                                  )}
                                  {ep.runtime && ep.runtime > 0 && (
                                    <p className="text-white/30 text-xs mt-1.5">{ep.runtime} min</p>
                                  )}
                                </div>

                                {/* Right side end of the episode card: Filler golden tag */}
                                {ep.isFiller && (
                                  <div className="flex items-center shrink-0 self-center pl-2">
                                    <span className="text-[10px] text-amber-400 font-extrabold uppercase bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-xl shadow-lg shadow-amber-400/5">
                                      Filler
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {hasMore && (
                            <div className="flex justify-center pt-2 pb-4">
                              <button
                                onClick={() => setVisibleCount(c => c + EPISODES_PER_PAGE)}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white text-sm font-bold hover:shadow-xl hover:shadow-[#4B5694]/25 transition-all"
                              >
                                Show {Math.min(EPISODES_PER_PAGE, currentSeasonEps.length - visibleCount)} More Episodes
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                  );
                })()}
              </section>

              {recommendations.length > 0 && (
                <div className="-mx-5 md:-mx-0">
                  <AnimeRow title="You May Like" items={recommendations} />
                </div>
              )}
              {recsLoading && !recommendations.length && (
                <div className="-mx-5 md:-mx-0">
                  <AnimeRow title="You May Like" isLoading items={[]} />
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
