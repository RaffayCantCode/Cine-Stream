"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { ChevronDown, ChevronRight, ChevronLeft, CheckCircle2, Film, Grid2x2, List, ListOrdered, Loader2, Play, Star } from "lucide-react";
import { CinematicHero, useCinematicHero } from "@/components/CinematicHero";
import { WatchlistButton } from "@/components/WatchlistButton";
import { AnimeCard } from "@/components/AnimeCard";
import { cn, fetchJson, formatDate } from "@/lib/utils";
import { usePageContentReady } from "@/lib/pageLoad";
import type { AnimeCatalog, AnimeItem, EpisodeDetail, SeasonInfo } from "@/lib/anime/types";

const AnimePlayer = dynamic(() => import("@/components/AnimePlayer").then((m) => m.AnimePlayer), { ssr: false });

function AnimeHeroTrailerButton() {
  const { playTrailer, hasTrailer } = useCinematicHero();
  if (!hasTrailer) return null;
  return (
    <button
      onClick={playTrailer}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold px-6 py-4 rounded-xl text-sm transition-all border border-white/15 backdrop-blur-md shadow-lg"
    >
      <Film className="w-4 h-4 text-fuchsia-400 shrink-0" />
      <span>Trailer</span>
    </button>
  );
}

function isSpecialSeason(season: SeasonInfo): boolean {
  const label = (season.seasonLabel || "").toLowerCase();
  const name = (season.name || "").toLowerCase();
  const format = (season.format || "").toUpperCase();
  return (
    format === "SPECIAL" ||
    format === "OVA" ||
    label.startsWith("special") ||
    label.startsWith("ova") ||
    name.includes("special") ||
    name.includes("ova") ||
    (name.includes("hitorigoto") && !name.includes("kusuriya"))
  );
}

function isMovieSeason(season: SeasonInfo): boolean {
  const label = (season.seasonLabel || "").toLowerCase();
  return season.format === "MOVIE" || label.startsWith("movie");
}

function isOngoingStatus(status: string | null | undefined): boolean {
  const normalized = (status || "").toUpperCase();
  if (!normalized) return false;
  return normalized === "RELEASING" || normalized === "NOT_YET_RELEASED";
}

/** Format a Unix timestamp (seconds or ms) as "Fri, Feb 6, 2026". */
function formatAirDate(timestamp: number): string {
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface EpisodesResponse {
  success: boolean;
  data?: { episodes: EpisodeDetail[]; seasonOverview: string | null };
}

interface AnimeClientProps {
  initialData: AnimeCatalog | null;
}

export default function AnimeClient() {
  const params = useParams();
  const rawId = String(params.id);
  const { data: session, status } = useSession();

  const [catalog, setCatalog] = useState<AnimeCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [seasonData, setSeasonData] = useState<{ episodes: EpisodeDetail[]; seasonOverview: string | null } | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSeasonId, setPlayingSeasonId] = useState<string>("");
  const [playingEpisode, setPlayingEpisode] = useState(1);
  const [hasEverWatched, setHasEverWatched] = useState(false);
  const [episodeNotice, setEpisodeNotice] = useState<string | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  const [specialsOpen, setSpecialsOpen] = useState(false);
  const [moviesOpen, setMoviesOpen] = useState(false);
  const [watchOrderOpen, setWatchOrderOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "number">("grid");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sv_anime_episode_view");
      if (saved === "grid" || saved === "list" || saved === "number") {
        setViewMode(saved);
      }
    } catch {}
  }, []);
  const [descExpanded, setDescExpanded] = useState(false);

  const [recommendations, setRecommendations] = useState<AnimeItem[]>([]);

  const playerRef = useRef<HTMLDivElement>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const selectedEpRef = useRef<HTMLButtonElement>(null);
  const autoplayHandledRef = useRef(false);

  usePageContentReady(!isLoading);

  // Fetch catalog on mount / id change (exactly like TvClient)
  useEffect(() => {
    let isActive = true;
    const fetchCatalog = async () => {
      setIsLoading(true);
      setError(null);
      setCatalog(null);
      setIsStateLoaded(false);
      try {
        const res = await fetchJson<{ success: boolean; data: AnimeCatalog; error?: string }>(
          `/api/anime/${encodeURIComponent(rawId)}`
        );
        if (!isActive) return;
        if (res.success && res.data) {
          setCatalog(res.data);
          setSelectedSeasonId(res.data.openedSeasonId || "");
          setPlayingSeasonId(res.data.openedSeasonId || "");
        } else {
          setError(res.error || "Anime not found");
        }
      } catch (e) {
        if (isActive) setError(e instanceof Error ? e.message : "Failed to load anime");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchCatalog();
    return () => { isActive = false; };
  }, [rawId]);

  // ── Scroll to top on id change ───────────────────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [rawId]);

  // ── Restore state (URL params > localStorage) ────────────────────────────
  useEffect(() => {
    if (!catalog || isStateLoaded) return;
    setIsLoading(false);
    if (!catalog.openedSeasonId) {
      setIsStateLoaded(true);
      return;
    }

    let initSeasonId = catalog.openedSeasonId;
    let initEp = 1;
    let hadSavedState = false;

    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSeasonId = searchParams.get("seasonId");
      const urlSeasonNum = Number(searchParams.get("season") || "");
      const urlEpisode = Number(searchParams.get("episode") || "");

      if (urlSeasonNum > 0) {
        const match = catalog.seasons.find((s) => s.tmdbSeasonNumber === urlSeasonNum);
        if (match) initSeasonId = match.id;
        hadSavedState = true;
      } else if (urlSeasonId) {
        const match = catalog.seasons.find((s) => s.id === urlSeasonId);
        if (match) initSeasonId = match.id;
        hadSavedState = true;
      }
      if (urlEpisode > 0) initEp = urlEpisode;

      if (!hadSavedState) {
        try {
          const userId = session?.user?.id || "guest";
          const savedKey = `sv_anime_state_${userId}_${rawId}`;
          const saved = localStorage.getItem(savedKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.hasEverWatched === true && parsed?.episode) {
              if (parsed?.seasonId && catalog.seasons.some((s) => s.id === parsed.seasonId)) {
                initSeasonId = parsed.seasonId;
              }
              initEp = parsed.episode;
              hadSavedState = true;
            } else {
              localStorage.removeItem(savedKey);
            }
          }
        } catch {}
      }
    }

    setSelectedSeasonId(initSeasonId);
    setPlayingSeasonId(initSeasonId);
    setPlayingEpisode(initEp);
    setHasEverWatched(hadSavedState);
    setIsStateLoaded(true);
  }, [catalog, isStateLoaded, rawId, session]);

  // ── Load episodes for the selected season ────────────────────────────────
  useEffect(() => {
    if (!catalog || !selectedSeasonId) return;
    let isActive = true;

    const loadSeason = async () => {
      setSeasonLoading(true);
      setEpisodesError(null);
      try {
        const data = await fetchJson<EpisodesResponse>(
          `/api/anime/${encodeURIComponent(rawId)}/episodes?seasonId=${encodeURIComponent(selectedSeasonId)}`
        );
        if (!isActive) return;
        if (data.success && data.data) {
          setSeasonData(data.data);
        } else {
          throw new Error("Season not found");
        }
      } catch (e) {
        if (isActive) {
          setSeasonData(null);
          setEpisodesError(e instanceof Error ? e.message : "Failed to load episodes");
        }
      } finally {
        if (isActive) setSeasonLoading(false);
      }
    };

    loadSeason();
    return () => {
      isActive = false;
    };
  }, [catalog, rawId, selectedSeasonId]);

  // ── Autoplay from URL (?autoplay=1&seasonId=...&episode=...) ─────────────
  useEffect(() => {
    if (!catalog || !isStateLoaded || autoplayHandledRef.current) return;
    if (status === "loading") return;
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("autoplay") !== "1") return;

    autoplayHandledRef.current = true;
    setIsPlaying(true);

    if (status === "authenticated") {
      const numericId = Number(catalog.anime.id);
      if (!Number.isNaN(numericId)) {
        const autoSeason = catalog.seasons.find((s) => s.id === playingSeasonId);
        fetch("/api/watch-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: numericId,
            mediaType: "anime",
            title: catalog.anime.name,
            posterPath: autoSeason?.coverImage || catalog.anime.poster || null,
            backdropPath: autoSeason?.bannerImage || catalog.anime.bannerImage || null,
            season: autoSeason?.tmdbSeasonNumber ?? 1,
            episode: playingEpisode,
            episodeName: `Episode ${playingEpisode}`,
          }),
        }).catch(() => {});
      }
    }
  }, [catalog, isStateLoaded, status, playingEpisode, playingSeasonId]);

  // ── Persist state ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!catalog || !isStateLoaded || status === "loading" || !hasEverWatched) return;
    if (typeof window !== "undefined") return;
    try {
      const userId = session?.user?.id || "guest";
      localStorage.setItem(
        `sv_anime_state_${userId}_${rawId}`,
        JSON.stringify({ seasonId: playingSeasonId, episode: playingEpisode, hasEverWatched: true })
      );
    } catch {}
  }, [catalog, isStateLoaded, status, session, rawId, playingSeasonId, playingEpisode, hasEverWatched]);

  // ── Fetch recommendations ────────────────────────────────────────────────
  useEffect(() => {
    if (!catalog) return;
    let isActive = true;
    const franchiseIds = catalog.seasons.map((s) => s.id).join(",");
    const genres = (catalog.anime.genres || []).slice(0, 4).join(",");

    (async () => {
      try {
        const res = await fetch(
          `/api/anime/recommendations/${catalog.anime.id}?genres=${encodeURIComponent(genres)}&excludeIds=${encodeURIComponent(franchiseIds)}`,
          { signal: AbortSignal.timeout(15000) }
        );
        const data = await res.json();
        if (isActive && data.success && Array.isArray(data.items)) {
          setRecommendations(data.items);
        }
      } catch {
        /* recommendations are non-critical */
      }
    })();

    return () => {
      isActive = false;
    };
  }, [catalog]);

  // ── Derived values ───────────────────────────────────────────────────────
  const seasons = useMemo(() => catalog?.seasons || [], [catalog]);
  const mainSeasons = useMemo(() => seasons.filter((s) => !isSpecialSeason(s) && !isMovieSeason(s)), [seasons]);
  const specialSeasons = useMemo(() => seasons.filter((s) => isSpecialSeason(s)), [seasons]);
  const movieSeasons = useMemo(() => seasons.filter((s) => isMovieSeason(s)), [seasons]);

  // ── Auto-open Specials/Movies when such a season is selected ─────────────
  useEffect(() => {
    if (!selectedSeasonId) return;
    const selected = seasons.find((s) => s.id === selectedSeasonId);
    if (!selected) return;
    if (isSpecialSeason(selected)) setSpecialsOpen(true);
    if (isMovieSeason(selected)) setMoviesOpen(true);
  }, [selectedSeasonId, seasons]);

  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === selectedSeasonId) ?? seasons.find((s) => s.id === catalog?.openedSeasonId),
    [seasons, selectedSeasonId, catalog]
  );
  const playingSeason =
    seasons.find((s) => s.id === playingSeasonId) ?? selectedSeason;

  // Announce when the next episode airs for ongoing TV seasons. Prefers the
  // authoritative AniList nextAiringEpisode (only known for the opened entry);
  // otherwise falls back to the first unaired episode in the loaded list.
  const nextAiringText = useMemo(() => {
    if (!selectedSeason) return null;
    if (!isOngoingStatus(selectedSeason.status || catalog?.anime.status)) return null;

    if (selectedSeason.id === catalog?.openedSeasonId && catalog?.anime.nextAiringEpisode?.airingAt) {
      return {
        episode: catalog.anime.nextAiringEpisode.episode,
        airingAt: catalog.anime.nextAiringEpisode.airingAt,
      };
    }
    const upcoming = seasonData?.episodes?.find((e) => e.isReleased === false && e.releasedDate);
    if (upcoming?.releasedDate) {
      const t = new Date(upcoming.releasedDate).getTime();
      if (!Number.isNaN(t)) return { episode: upcoming.episodeNum, airingAt: t };
    }
    return null;
  }, [selectedSeason, catalog, seasonData]);

  const isUpcomingEpisode = useCallback(
    (episode?: EpisodeDetail | null) => {
      if (!episode) return false;
      // Gate on the OPENED season's status (not just the show) — a finished
      // main entry with an ongoing special must still tag its unaired eps.
      const seasonStatus = selectedSeason?.status || catalog?.anime.status;
      if (!isOngoingStatus(seasonStatus)) return false;
      if (episode.isReleased === false) return true;
      if (episode.isUpcoming === true) return true;
      const isFutureDate = (dateValue?: string | null) => {
        if (!dateValue) return false;
        const dateOnlyStr = dateValue.split("T")[0];
        const t = new Date(`${dateOnlyStr}T00:00:00`).getTime();
        if (Number.isNaN(t)) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return t > today.getTime();
      };
      if (isFutureDate(episode.releasedDate)) return true;
      // Cascade: if any earlier episode in this season hasn't aired yet, this
      // one can't be out either (matches the TV section's behaviour).
      if (!seasonData?.episodes) return false;
      const idx = seasonData.episodes.findIndex((e) => e.episodeNum === episode.episodeNum);
      if (idx <= 0) return false;
      for (let i = 0; i < idx; i++) {
        if (isFutureDate(seasonData.episodes[i].releasedDate)) return true;
      }
      return false;
    },
    [catalog, selectedSeason, seasonData]
  );

  const currentEpisode =
    playingSeasonId === selectedSeasonId
      ? seasonData?.episodes.find((ep) => ep.episodeNum === playingEpisode) ?? null
      : null;
  const nextEpisode =
    playingSeasonId === selectedSeasonId && seasonData
      ? seasonData.episodes.find((ep) => ep.episodeNum === playingEpisode + 1) ?? null
      : null;

  const currentIdx = useMemo(
    () => (seasonData?.episodes.findIndex((ep) => ep.episodeNum === playingEpisode) ?? -1),
    [seasonData, playingEpisode]
  );

  // ── Watch an episode ─────────────────────────────────────────────────────
  const handleWatchEpisode = useCallback(
    (seasonId: string, episodeNum: number, episodeName?: string) => {
      const targetEp =
        seasonId === selectedSeasonId ? seasonData?.episodes.find((ep) => ep.episodeNum === episodeNum) : undefined;

      if (isUpcomingEpisode(targetEp)) {
        setSelectedSeasonId(seasonId);
        setEpisodeNotice(`Episode ${episodeNum} hasn't been released yet.`);
        return;
      }

      setEpisodeNotice(null);
      setHasEverWatched(true);
      setSelectedSeasonId(seasonId);
      setPlayingSeasonId(seasonId);
      setPlayingEpisode(episodeNum);

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("seasonId", seasonId);
        url.searchParams.set("episode", episodeNum.toString());
        window.history.replaceState({}, "", url.toString());
      }

      if (status === "authenticated" && catalog) {
        const targetSeason = seasons.find((s) => s.id === seasonId);
        const targetMediaId = Number(targetSeason?.id || catalog.anime.id);
        const targetTitle = targetSeason?.name || catalog.anime.name;
        if (!Number.isNaN(targetMediaId)) {
          fetch("/api/watch-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId: targetMediaId,
              mediaType: "anime",
              title: targetTitle,
              posterPath: targetSeason?.coverImage || catalog.anime.poster || null,
              backdropPath: targetSeason?.bannerImage || catalog.anime.bannerImage || null,
              season: targetSeason?.tmdbSeasonNumber ?? 1,
              episode: episodeNum,
              episodeName: episodeName || `Episode ${episodeNum}`,
            }),
          }).catch(() => {});
        }
      }

      setIsPlaying(true);
    },
    [catalog, isUpcomingEpisode, seasonData, selectedSeasonId, seasons, status]
  );

  // ── Prev / Next ──────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    const eps = seasonData?.episodes || [];
    if (currentIdx <= 0) return;
    const prev = eps[currentIdx - 1];
    if (!prev || prev.isReleased === false) return;
    handleWatchEpisode(selectedSeasonId, prev.episodeNum, prev.title);
  }, [seasonData, currentIdx, selectedSeasonId, handleWatchEpisode]);

  const handleNext = useCallback(() => {
    const eps = seasonData?.episodes || [];
    if (currentIdx >= eps.length - 1) return;
    const next = eps[currentIdx + 1];
    if (!next || next.isReleased === false) return;
    handleWatchEpisode(selectedSeasonId, next.episodeNum, next.title);
  }, [seasonData, currentIdx, selectedSeasonId, handleWatchEpisode]);

  // ── Autoplay next episode / next season ──────────────────────────────────
  const handleAutoPlayNext = useCallback(() => {
    if (playingSeasonId === selectedSeasonId && seasonData) {
      const eps = seasonData.episodes;
      const next = eps[currentIdx + 1];
      if (next && next.isReleased !== false) {
        handleWatchEpisode(playingSeasonId, next.episodeNum, next.title);
        return;
      }
    } else if (playingSeasonId !== selectedSeasonId) {
      // Watcher navigated to another season tab while playing — increment boldly.
      handleWatchEpisode(playingSeasonId, playingEpisode + 1);
      return;
    }
    const order = [...mainSeasons, ...movieSeasons, ...specialSeasons];
    const idx = order.findIndex((s) => s.id === playingSeasonId);
    if (idx >= 0 && idx < order.length - 1) {
      handleWatchEpisode(order[idx + 1].id, 1);
    }
  }, [seasonData, currentIdx, mainSeasons, movieSeasons, specialSeasons, playingSeasonId, selectedSeasonId, playingEpisode, handleWatchEpisode]);

  // ── Scroll to player on play ─────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  // ── Keep the episode queue anchored at the current episode ───────────────
  // When jumping into (say) episode 100, the queue scrolls so that episode is
  // at the top instead of forcing the user to scroll down from episode 1.
  // Scrolls ONLY the queue container so the page stays anchored at the player.
  useEffect(() => {
    if (!isPlaying || seasonLoading) return;
    const timer = setTimeout(() => {
      const container = queueScrollRef.current;
      const item = selectedEpRef.current;
      if (container && item) {
        const offset = item.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTo({ top: container.scrollTop + offset, behavior: "smooth" });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isPlaying, seasonLoading, playingEpisode, playingSeasonId]);

  // ── Stop playback if the playing episode is (or becomes) upcoming ────────
  useEffect(() => {
    if (!isPlaying || seasonLoading) return;
    const activeEpisode = seasonData?.episodes.find((ep) => ep.episodeNum === playingEpisode);
    if (!activeEpisode || !isUpcomingEpisode(activeEpisode)) return;
    setIsPlaying(false);
    setEpisodeNotice(`Episode ${playingEpisode} hasn't been released yet.`);
  }, [isPlaying, seasonLoading, playingEpisode, playingSeasonId, seasonData, isUpcomingEpisode]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (!catalog) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64">
          <div className="pt-0 px-6 md:px-12 max-w-screen-2xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80">
              <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load this anime</div>
              {error ? (
                <div className="text-sm text-white/50 break-words">{error}</div>
              ) : (
                <div className="text-sm text-white/50">Not found.</div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const anime = catalog.anime;
  const activeCover = selectedSeason?.coverImage || anime.poster;
  const activeBackdrop = selectedSeason?.bannerImage || anime.bannerImage || activeCover;
  const backdrop = activeBackdrop;
  const score = Number(anime.rating || 0);
  const scoreColor = score >= 7.5 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";
  const seasonCount = mainSeasons.length;
  const isMovieEntry = anime.format === "MOVIE" || anime.format === "SPECIAL";

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 bleed-header select-none">
        <CinematicHero
          backdropPath={backdrop || undefined}
          trailerId={anime.trailerId}
          title={anime.name}
          theme="anime"
        >
          <div className="pb-12 px-5 md:px-10 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-8 items-end">
            {activeCover && (
              <img
                src={activeCover}
                alt={anime.name}
                className="hidden md:block w-48 lg:w-60 shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/10"
                fetchPriority="high"
                decoding="async"
                width={240}
                height={360}
              />
            )}

            <div className="flex-1 space-y-4">
              <div>
                <h1 className="font-bold text-5xl md:text-7xl text-white leading-none tracking-wide mb-2 select-text">
                  {selectedSeason && selectedSeason.name && selectedSeason.name !== anime.name
                    ? selectedSeason.name
                    : anime.name}
                </h1>
                {anime.jname && (
                  <p className="text-primary/90 font-semibold italic text-base md:text-lg select-text">
                    {anime.jname}
                  </p>
                )}
                {selectedSeason && selectedSeason.name !== anime.name && (
                  <div className="mt-2">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary text-[11px] font-extrabold uppercase tracking-wider">
                      {selectedSeason.seasonLabel}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px]">
                {score > 0 && (
                  <div className={`flex items-center gap-1.5 font-bold ${scoreColor}`}>
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-base">{score.toFixed(1)}</span>
                    <span className="text-white/50 font-normal text-xs">/ 10</span>
                  </div>
                )}
                {anime.seasonYear && (
                  <span className="text-white/80 font-bold">{anime.seasonYear}</span>
                )}
                {!isMovieEntry && seasonCount > 0 && (
                  <span className="text-white/80 font-bold">
                    {seasonCount} Season{seasonCount > 1 ? "s" : ""}
                  </span>
                )}
                {anime.duration && (
                  <span className="text-white/80 font-bold">{anime.duration} min</span>
                )}
                <div className="flex flex-wrap gap-1.5 ml-1">
                  {anime.genres?.map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-0.5 bg-white/[0.07] border border-white/[0.08] rounded-full text-xs font-semibold text-white/70"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              {anime.description && (
                <div>
                  <p
                    className={cn(
                      "text-white/65 text-base leading-relaxed max-w-2xl select-text",
                      !descExpanded && "line-clamp-3"
                    )}
                  >
                    {anime.description}
                  </p>
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-2 text-xs font-bold text-primary/90 hover:text-primary transition-colors"
                  >
                    {descExpanded ? "Read less" : "Read more"}
                  </button>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-4 w-full">
                <button
                  onClick={() => handleWatchEpisode(selectedSeasonId, playingEpisode, currentEpisode?.title)}
                  className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-black/30"
                >
                  <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                  {isMovieEntry ? "Watch Movie" : `Watch E${playingEpisode}`}
                </button>

                <WatchlistButton
                  key={`watchlist-${selectedSeason?.id ?? anime.id}`}
                  mediaId={Number(selectedSeason?.id ?? anime.id)}
                  mediaType="anime"
                  title={selectedSeason?.name ?? anime.name}
                  posterPath={selectedSeason?.coverImage || activeCover || null}
                  backdropPath={selectedSeason?.bannerImage || anime.bannerImage || null}
                />

                <AnimeHeroTrailerButton />
              </div>
            </div>
          </div>
        </CinematicHero>

        <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-10 space-y-14">
          {episodeNotice && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
              {episodeNotice}
            </div>
          )}

          {/* ── Player + Queue ── */}
          {isPlaying && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start select-none">
              <div ref={playerRef}>
                <AnimePlayer
                  key={currentEpisode?.episodeId ?? `${playingSeasonId}-${playingEpisode}`}
                  animeId={playingSeason?.id ?? anime.id}
                  malId={playingSeason?.idMal ? String(playingSeason.idMal) : anime.idMal}
                  animeTitle={currentEpisode?.seasonName || anime.name}
                  episode={playingEpisode}
                  rootAnimeId={playingSeason?.id ?? anime.id}
                  rootMalId={playingSeason?.idMal ? String(playingSeason.idMal) : anime.idMal}
                  episodeOffset={playingSeason?.episodeOffset ?? 0}
                  tmdbId={playingSeason?.tmdbId ?? catalog.tmdbId}
                  tmdbSeason={playingSeason?.tmdbSeasonNumber ?? null}
                  isMovie={isMovieEntry || Boolean(playingSeason?.seasonLabel?.startsWith("Movie"))}
                  startProgress={typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("t") || 0) : 0}
                  onAutoNext={handleAutoPlayNext}
                />

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-white">Episode {playingEpisode}</span>
                    {currentEpisode?.title && currentEpisode.title !== `Episode ${playingEpisode}` && (
                      <span className="text-sm text-white/50">— {currentEpisode.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrev}
                      disabled={currentIdx <= 0}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-30 text-white/60 hover:text-white text-xs font-bold transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    {seasonData && seasonData.episodes.length > 0 && (
                      <span className="text-sm text-white/40 px-2 font-medium">
                        {Math.max(currentIdx + 1, 1)} / {seasonData.episodes.length}
                      </span>
                    )}
                    <button
                      onClick={handleNext}
                      disabled={currentIdx >= (seasonData?.episodes.length ?? 1) - 1}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4B5694] hover:bg-[#7288AE] disabled:opacity-30 text-white text-xs font-bold transition-all shadow-lg"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {nextEpisode && nextEpisode.isReleased !== false && (
                  <button
                    onClick={() => handleWatchEpisode(playingSeasonId, nextEpisode.episodeNum, nextEpisode.title)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/85 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Play Next: E{nextEpisode.episodeNum}
                  </button>
                )}
              </div>

              <aside className="w-full xl:w-80 shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col max-h-[60vh] xl:max-h-[70vh]">
                <div className="p-4 border-b border-white/[0.06] bg-white/[0.01]">
                  <div className="text-sm font-bold text-white flex items-center justify-between">
                    <span>Episode Queue</span>
                    <span className="text-xs font-normal text-white/40">{selectedSeason?.seasonLabel || selectedSeason?.name}</span>
                  </div>
                </div>
                <div ref={queueScrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                  {seasonLoading ? (
                    <div className="flex items-center justify-center py-8 text-white/30 text-xs">Loading episodes...</div>
                  ) : !seasonData?.episodes?.length ? (
                    <div className="flex items-center justify-center py-8 text-white/30 text-xs">No episodes found</div>
                  ) : (
                    seasonData.episodes.map((episode) => {
                      const isWatching = hasEverWatched && playingSeasonId === selectedSeasonId && playingEpisode === episode.episodeNum;
                      const isUpcoming = isUpcomingEpisode(episode);
                      return (
                        <button
                          key={`queue-${episode.episodeId}`}
                          ref={isWatching ? selectedEpRef : undefined}
                          onClick={() => handleWatchEpisode(selectedSeasonId, episode.episodeNum, episode.title)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                            isWatching
                              ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/20"
                              : isUpcoming
                              ? "bg-white/[0.025] text-white/30 hover:bg-amber-400/10 hover:text-amber-200 border border-amber-400/10"
                              : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                          }`}
                        >
                          <span className={`text-sm font-black w-10 shrink-0 ${isWatching ? "text-white" : ""}`}>
                            E{episode.episodeNum}
                          </span>
                          <span className="text-xs truncate flex-1 line-clamp-1">{episode.title}</span>
                          {episode.isFiller && !isWatching && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-400/90 text-black text-[8px] font-black uppercase tracking-wide">
                              Filler
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-[9px] text-sky-300 font-extrabold uppercase bg-sky-300/10 border border-sky-300/20 px-1.5 py-0.5 rounded shrink-0">
                              Upcoming
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>
            </div>
          )}

          {/* ── Episodes ── */}
          <section>
            <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 bg-primary rounded-full shrink-0" />
                <h2 className="text-base font-bold text-white tracking-wide">Episodes</h2>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {mainSeasons.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {mainSeasons.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSeasonId(s.id)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5",
                          selectedSeasonId === s.id
                            ? "bg-primary text-primary-foreground shadow-md shadow-black/30"
                            : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border border-white/[0.06]"
                        )}
                      >
                        {s.seasonLabel}
                        {selectedSeasonId === s.id && seasonLoading && (
                          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {specialSeasons.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSpecialsOpen((o) => !o)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border",
                        specialSeasons.some((s) => s.id === selectedSeasonId)
                          ? "bg-primary text-primary-foreground shadow-md shadow-black/30 border-transparent"
                          : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border-white/[0.06]"
                      )}
                    >
                      {specialsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      Specials
                    </button>
                    {specialsOpen && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {specialSeasons.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSeasonId(s.id)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 border",
                              selectedSeasonId === s.id
                                ? "bg-primary text-primary-foreground shadow-md shadow-black/30 border-transparent"
                                : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border-white/[0.06]"
                            )}
                          >
                            {s.seasonLabel}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {movieSeasons.length > 0 && (mainSeasons.length > 0 || movieSeasons.length > 1) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMoviesOpen((o) => !o)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border",
                        movieSeasons.some((s) => s.id === selectedSeasonId)
                          ? "bg-primary text-primary-foreground shadow-md shadow-black/30 border-transparent"
                          : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border-white/[0.06]"
                      )}
                    >
                      {moviesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      Movies
                    </button>
                    {moviesOpen && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {movieSeasons.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSeasonId(s.id)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 border",
                              selectedSeasonId === s.id
                                ? "bg-primary text-primary-foreground shadow-md shadow-black/30 border-transparent"
                                : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border-white/[0.06]"
                            )}
                          >
                            {s.seasonLabel}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isMovieEntry && (
                  <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.05] p-0.5 gap-0.5">
                    {(
                      [
                        { key: "list", label: "List", icon: <List className="w-3.5 h-3.5" /> },
                        { key: "grid", label: "Grid", icon: <Grid2x2 className="w-3.5 h-3.5" /> },
                        { key: "number", label: "Numbers", icon: <ListOrdered className="w-3.5 h-3.5" /> },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setViewMode(opt.key);
                          try {
                            localStorage.setItem("sv_anime_episode_view", opt.key);
                          } catch {}
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 active:scale-95",
                          viewMode === opt.key
                            ? "bg-primary text-primary-foreground shadow-md shadow-black/20"
                            : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                        )}
                        aria-pressed={viewMode === opt.key}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedSeason && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 md:py-3.5 mb-5 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-white truncate">{selectedSeason.name}</span>
                    {selectedSeason.format && (
                      <span className="shrink-0 px-2 py-0.5 rounded bg-white/[0.08] border border-white/[0.1] text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                        {selectedSeason.format}
                      </span>
                    )}
                    {selectedSeason.seasonYear && (
                      <span className="shrink-0 text-xs font-semibold text-white/50">{selectedSeason.seasonYear}</span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs md:text-sm">
                    {selectedSeason.seasonLabel && (
                      <span className="font-extrabold text-amber-300">{selectedSeason.seasonLabel}</span>
                    )}
                    {(seasonData?.episodes?.length ?? selectedSeason.totalEpisodes) ? (
                      <>
                        {selectedSeason.seasonLabel && <span className="text-white/40 font-medium">·</span>}
                        <span className="font-extrabold text-emerald-300">
                          {seasonData?.episodes?.length
                            ? `${seasonData.episodes.length} episode${seasonData.episodes.length === 1 ? "" : "s"}`
                            : `${selectedSeason.totalEpisodes} episodes`}
                        </span>
                      </>
                    ) : null}
                    {!selectedSeason.isCurrent && catalog.franchiseNodes.length > 1 ? (
                      <span className="text-xs font-medium text-white/40">· Related series — opens its own page</span>
                    ) : selectedSeason.isCurrent ? (
                      <span className="text-xs font-medium text-white/40">· This entry</span>
                    ) : null}
                  </p>
                </div>
                {selectedSeason.status && (
                  <span
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border",
                      selectedSeason.status === "FINISHED"
                        ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-300"
                        : selectedSeason.status === "RELEASING"
                        ? "bg-amber-400/15 border-amber-400/30 text-amber-300"
                        : selectedSeason.status === "NOT_YET_RELEASED"
                        ? "bg-sky-400/15 border-sky-400/30 text-sky-300"
                        : "bg-white/[0.05] border-white/[0.08] text-white/50"
                    )}
                  >
                    {selectedSeason.status === "FINISHED"
                      ? "Completed"
                      : selectedSeason.status === "RELEASING"
                      ? "Ongoing"
                      : selectedSeason.status === "NOT_YET_RELEASED"
                      ? "Upcoming"
                      : selectedSeason.status}
                  </span>
                )}
                {nextAiringText && (
                  <p className="w-full text-xs font-bold text-sky-300 flex items-center gap-1.5 pt-1.5 border-t border-white/[0.06]">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse shrink-0" />
                    {selectedSeason.status === "NOT_YET_RELEASED"
                      ? `Premieres (E${nextAiringText.episode}) on ${formatAirDate(nextAiringText.airingAt)}`
                      : `Next episode (E${nextAiringText.episode}) airs on ${formatAirDate(nextAiringText.airingAt)}`}
                  </p>
                )}
              </div>
            )}

            {!seasonLoading && episodesError && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                Couldn&apos;t load episodes: {episodesError}
              </div>
            )}

            {seasonLoading && (
              <div className="space-y-3" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`ep-shimmer-${i}`}
                    className="flex gap-4 p-3.5 rounded-2xl border border-white/[0.05] bg-white/[0.015]"
                  >
                    <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.04] shrink-0 self-start mt-1">
                      <div className="w-4 h-3 rounded shimmer" />
                    </div>
                    <div className="w-40 sm:w-48 md:w-52 lg:w-56 shrink-0 aspect-video rounded-xl shimmer" />
                    <div className="flex-1 min-w-0 py-1 space-y-2.5">
                      <div className="h-3.5 w-1/3 rounded shimmer" />
                      <div className="h-3 w-3/4 rounded shimmer" />
                      <div className="h-3 w-1/2 rounded shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!seasonLoading && seasonData && (
              <div key={selectedSeasonId}>
                {seasonData.seasonOverview && (
                  <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-2xl italic select-text">
                    {seasonData.seasonOverview}
                  </p>
                )}

                <div key={viewMode} className="animate-view-in">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-6">
                    {seasonData.episodes.map((episode, i) => {
                      const isWatching = hasEverWatched && playingSeasonId === selectedSeasonId && playingEpisode === episode.episodeNum;
                      const isUpcoming = isUpcomingEpisode(episode);
                      const epRating = episode.vote_average && episode.vote_average > 0
                        ? episode.vote_average
                        : score > 0
                        ? score
                        : null;
                      return (
                        <button
                          key={`grid-${episode.episodeId}`}
                          onClick={() => handleWatchEpisode(selectedSeasonId, episode.episodeNum, episode.title)}
                          className="group text-left"
                        >
                          <div
                            className={cn(
                              "relative aspect-video rounded-xl overflow-hidden bg-muted border transition-all duration-300",
                              isWatching
                                ? "ring-2 ring-primary border-transparent"
                                : isUpcoming
                                ? "opacity-50 border-amber-400/10"
                                : "border-white/[0.06] group-hover:border-white/[0.15]"
                            )}
                          >
                            {episode.thumbnail || selectedSeason?.coverImage || anime.poster ? (
                              <img
                                src={episode.thumbnail || selectedSeason?.coverImage || anime.poster || undefined}
                                alt={episode.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-card">
                                <Play className="w-6 h-6 text-white/20" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                              </div>
                            </div>
                            {isUpcoming && (
                              <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-2">
                                <span className="px-3 py-1.5 rounded-lg bg-sky-500/30 border border-sky-300/40 text-xs md:text-sm font-black uppercase tracking-widest text-sky-200 shadow-xl">
                                  UPCOMING
                                </span>
                              </div>
                            )}
                            {isWatching && (
                              <div className="absolute top-2.5 left-2.5 z-30 px-2.5 py-1 rounded-md bg-primary/90 text-white text-[10px] font-extrabold tracking-widest uppercase shadow-md">
                                {isPlaying ? "Playing" : "Watching"}
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 z-30 px-2.5 py-1.5 bg-gradient-to-t from-black/90 to-transparent w-full">
                              <span className="text-xs font-black text-white">EP {episode.episodeNum}</span>
                            </div>
                            {episode.isFiller && !isWatching && (
                              <div className="absolute top-2.5 left-2.5 z-30 px-2.5 py-1 rounded-md bg-amber-400 text-black text-xs font-black uppercase tracking-wider shadow-lg shadow-black/60 border border-amber-300">
                                FILLER
                              </div>
                            )}
                          </div>
                          <div className="mt-2 px-0.5">
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-xs md:text-sm font-bold text-white/90 line-clamp-2 leading-snug flex-1">{episode.title}</p>
                              {epRating ? (
                                <div className="flex items-center gap-0.5 text-amber-400 shrink-0 text-xs font-extrabold mt-0.5">
                                  <Star className="w-3 h-3 fill-current" />
                                  <span>{epRating.toFixed(1)}</span>
                                </div>
                              ) : null}
                            </div>
                            {episode.releasedDate && (
                              <p className="text-[10px] md:text-xs text-white/35 mt-0.5">
                                {episode.isReleased === false ? "Airs" : "Aired"} {formatDate(episode.releasedDate)}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : viewMode === "list" ? (
                  <div className="space-y-2.5">
                    {seasonData.episodes.map((episode) => {
                      const isWatching = hasEverWatched && playingSeasonId === selectedSeasonId && playingEpisode === episode.episodeNum;
                      const isUpcoming = isUpcomingEpisode(episode);
                      const epRating = episode.vote_average && episode.vote_average > 0
                        ? episode.vote_average
                        : score > 0
                        ? score
                        : null;
                      const epStill = episode.thumbnail || selectedSeason?.coverImage || anime.poster;

                      return (
                        <div
                          key={episode.episodeId}
                          onClick={() => handleWatchEpisode(selectedSeasonId, episode.episodeNum, episode.title)}
                          className={cn(
                            "group flex gap-3.5 sm:gap-4 p-3 rounded-2xl border bg-card/60 backdrop-blur-md transition-all duration-300 cursor-pointer select-none touch-manipulation hover:bg-white/[0.07] hover:border-white/20 hover:shadow-xl",
                            isWatching
                              ? "ring-2 ring-primary border-transparent bg-gradient-to-r from-primary/20 via-primary/5 to-card shadow-lg shadow-black/40"
                              : isUpcoming
                              ? "bg-white/[0.015] border-amber-400/10 hover:bg-amber-400/10 hover:border-amber-400/20"
                              : "bg-white/[0.03] border-white/[0.08]"
                          )}
                        >
                          {/* Compact HD Thumbnail */}
                          <div className="w-36 sm:w-48 md:w-56 lg:w-60 shrink-0 aspect-video rounded-xl overflow-hidden bg-black/40 relative border border-white/10 shadow-sm group-hover:border-white/25 transition-colors self-start">
                            {epStill ? (
                              <img
                                src={epStill}
                                alt={episode.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-card">
                                <Play className="w-6 h-6 text-white/20" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

                            {/* Hover Play Button */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>

                            {/* EP Badge & Status Tags */}
                            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-20">
                              <span className="bg-black/80 backdrop-blur-md border border-white/15 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md shadow-md">
                                EP {episode.episodeNum}
                              </span>
                              {isWatching && hasEverWatched && (
                                <span className="bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase shadow-md animate-pulse">
                                  {isPlaying ? "Playing" : "Watching"}
                                </span>
                              )}
                            </div>

                            {episode.isFiller && !isWatching && (
                              <div className="absolute top-1.5 left-1.5 z-20 px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider shadow-md border border-amber-300">
                                FILLER
                              </div>
                            )}

                            {isUpcoming && (
                              <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-1.5">
                                <span className="px-2.5 py-1 rounded-lg bg-sky-500/30 border border-sky-300/40 text-[10px] font-black uppercase tracking-widest text-sky-200 shadow-md">
                                  UPCOMING
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Content Details */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-bold text-sm sm:text-base leading-snug text-white group-hover:text-primary transition-colors flex items-center flex-wrap gap-1.5">
                                  <span>{episode.title}</span>
                                  {episode.isFiller && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider border border-amber-300">
                                      FILLER
                                    </span>
                                  )}
                                </h4>

                                {epRating ? (
                                  <div className="flex items-center gap-1 text-amber-300 shrink-0 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-md text-xs font-bold shadow-sm">
                                    <Star className="w-3 h-3 fill-current text-amber-300" />
                                    <span>{epRating.toFixed(1)}</span>
                                    <span className="text-[9px] text-white/40 font-normal">/ 10</span>
                                  </div>
                                ) : null}
                              </div>

                              {episode.description && (
                                <p className="text-xs text-white/50 leading-relaxed line-clamp-2 mt-0.5 font-normal">
                                  {episode.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 text-[11px] font-semibold text-white/35 mt-1.5 flex-wrap">
                              {episode.releasedDate && (
                                <span>Aired {formatDate(episode.releasedDate)}</span>
                              )}
                              {episode.runtime && (
                                <span>{episode.runtime} min</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2.5">
                    {seasonData.episodes.map((episode) => {
                      const isWatching = hasEverWatched && playingSeasonId === selectedSeasonId && playingEpisode === episode.episodeNum;
                      const isUpcoming = isUpcomingEpisode(episode);
                      const epRating = episode.vote_average && episode.vote_average > 0
                        ? episode.vote_average
                        : score > 0
                        ? score
                        : null;
                      return (
                        <button
                          key={`num-${episode.episodeId}`}
                          onClick={() => handleWatchEpisode(selectedSeasonId, episode.episodeNum, episode.title)}
                          className={cn(
                            "relative flex items-center justify-center aspect-square rounded-xl text-base font-black transition-all duration-200 border",
                            isWatching
                              ? "bg-primary text-primary-foreground border-transparent shadow-md shadow-black/30"
                              : isUpcoming
                              ? "bg-white/[0.02] text-white/40 border-sky-300/15 hover:border-sky-300/30 hover:text-white/60"
                              : episode.isFiller
                              ? "bg-amber-500/20 text-amber-300 border-amber-400/50 hover:border-amber-400 hover:bg-amber-500/30"
                              : "bg-white/[0.04] text-white/70 border-white/[0.06] hover:border-white/[0.2] hover:bg-white/[0.08]"
                          )}
                          title={`${episode.title}${epRating ? ` (★ ${epRating.toFixed(1)}/10)` : ""}${episode.isFiller ? " (Filler)" : ""}${isUpcoming ? " (Upcoming)" : ""}`}
                        >
                          {episode.episodeNum}
                          {isUpcoming && (
                            <span className="absolute bottom-1 inset-x-0 text-center text-[8px] font-black uppercase tracking-wider text-sky-300 leading-none">
                              UPCOMING
                            </span>
                          )}
                          {episode.isFiller && !isWatching && (
                            <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-md bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow-md border border-amber-300">
                              FILLER
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                </div>
              </div>
            )}

            {!seasonLoading && !seasonData && !episodesError && (
              <div className="flex items-center justify-center py-12 text-white/30 text-sm">No episodes found</div>
            )}
          </section>

          {/* ── Watch Order ── */}
          {catalog.franchiseNodes.length > 1 && (
            <section>
              <button
                onClick={() => setWatchOrderOpen((o) => !o)}
                aria-expanded={watchOrderOpen}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl border text-left transition-all duration-200",
                  watchOrderOpen
                    ? "border-white/[0.14] bg-white/[0.05]"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.16]"
                )}
              >
                <div className="w-1 h-5 bg-primary rounded-full shrink-0" />
                <div className="flex-1">
                  <h2 className="text-base font-bold text-white tracking-wide">Watch Order</h2>
                  <p className="text-xs text-white/35 mt-0.5">
                    {catalog.franchiseNodes.length} titles in this franchise, ordered chronologically.
                  </p>
                </div>
                <span
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-200",
                    watchOrderOpen
                      ? "bg-primary/20 border-primary/40 text-white"
                      : "bg-white/[0.04] border-white/[0.08] text-white/40 group-hover:text-white/70"
                  )}
                >
                  {watchOrderOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
              </button>
              {watchOrderOpen && (
                <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="divide-y divide-white/[0.05]">
                    {catalog.franchiseNodes.map((node, i) => {
                      const isCurrent = node.id === Number(anime.id);
                      const statusText =
                        node.status === "FINISHED"
                          ? "Completed"
                          : node.status === "RELEASING"
                          ? "Ongoing"
                          : node.status === "NOT_YET_RELEASED"
                          ? "Upcoming"
                          : null;
                      return (
                        <Link
                          key={node.id}
                          href={`/anime/${node.id}`}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 transition-all duration-200 group",
                            isCurrent ? "bg-primary/[0.10]" : "hover:bg-white/[0.05]"
                          )}
                        >
                          <span
                            className={cn(
                              "w-6 text-center text-xs font-black shrink-0",
                              isCurrent ? "text-primary" : "text-white/30"
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="w-20 shrink-0 text-[10px] font-black uppercase tracking-wide text-[#7288AE] leading-tight">
                            {node.seasonLabel || node.format || "Anime"}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span
                              className={cn(
                                "block text-sm font-bold truncate",
                                isCurrent ? "text-primary" : "text-white/90"
                              )}
                            >
                              {node.title}
                            </span>
                            <span className="block text-[10px] text-white/40 mt-0.5 truncate">
                              {node.seasonYear || ""}
                              {node.episodes ? ` · ${node.episodes} eps` : ""}
                              {statusText ? ` · ${statusText}` : ""}
                            </span>
                          </span>
                          {isCurrent && (
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-primary/90 text-white text-[9px] font-extrabold tracking-widest uppercase">
                              Watching
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-white/25 shrink-0 group-hover:text-white/70 transition-colors" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── You May Like ── */}
          {recommendations.length > 0 && (
            <section>
              <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">You May Like</h2>
                    <p className="text-xs text-white/35 mt-0.5">Recommended based on this anime.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                {recommendations.slice(0, 18).map((item, i) => (
                  <AnimeCard key={item.id} item={item} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}