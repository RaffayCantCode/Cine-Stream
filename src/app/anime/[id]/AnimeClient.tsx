"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { AnimeCard } from "@/components/AnimeCard";
import { CinematicHero, useCinematicHero } from "@/components/CinematicHero";
import { WatchlistButton } from "@/components/WatchlistButton";
import { EpisodeViewSelector, EpisodeListView, EpisodeGridView, EpisodeNumbersView, EpisodePagination, EpisodeChunkBar, type EpisodeItem, type EpisodeViewMode } from "@/components/episodes/EpisodeViews";
import { usePageContentReady } from "@/lib/pageLoad";
import { useMediaLogo } from "@/components/MediaLogo";
import { AmbientBackdropGlow } from "@/components/AmbientBackdropGlow";
import { fetchJson, cn, getRecommendationReason } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";
import { useTheme } from "@/context/ThemeContext";
import { AnimeSeasonSelector } from "@/components/AnimeSeasonSelector";
import { Star, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Play, Film } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AnimeDetail {
  id: string;
  idMal?: string | null;
  name: string;
  jname?: string | null;
  poster: string;
  description?: string;
  type?: string | null;
  rating?: string | null;
  score?: string | null;
  status?: string | null;
  genres?: string[];
  totalEpisodes?: number;
  seasons: SeasonInfo[];
  season?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  openedSeasonId?: string | null;
  tmdbId?: number | null;
  duration?: number | null;
  trailerId?: string | null;
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number } | null;
  backdrop?: string | null;
  bannerImage?: string | null;
  logoUrl?: string | null;
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
  vote_count?: number;
  runtime?: number;
  seasonNum?: number;
  seasonId?: string;
  seasonName?: string;
  seasonMalId?: number | null;
}

interface FranchiseNode {
  id: string;
  idMal?: number | null;
  title: string;
  episodes?: number | null;
  totalEpisodes?: number | null;
  format?: string | null;
  seasonYear?: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ANIME_API_VERSION = "v52-clean-architecture";

function formatAnimeStatus(raw?: string | null): { label: string; style: "finished" | "airing" | "upcoming" } {
  if (!raw) return { label: "FINISHED", style: "finished" };
  const s = raw.toUpperCase().replace(/_/g, " ").trim();
  if (s.includes("RELEASING") || s.includes("CURRENTLY AIRING") || s === "AIRING") return { label: "CURRENTLY AIRING", style: "airing" };
  if (s.includes("NOT YET") || s.includes("UPCOMING") || s.includes("CANCELLED")) return { label: "NOT YET AIRED", style: "upcoming" };
  return { label: "FINISHED", style: "finished" };
}


const FRANCHISE_CACHE = new Map<string, FranchiseNode[]>();

// ─────────────────────────────────────────────────────────────────────────────
// TRAILER BUTTON (inner component, reads CinematicHero context)
// ─────────────────────────────────────────────────────────────────────────────

function TrailerButton() {
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


// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AnimeClient({ initialData }: { initialData?: any | null } = {}) {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { data: session } = useSession();

  // ── Core state ───────────────────────────────────────────────────────────
  const [anime, setAnime] = useState<AnimeDetail | null>(() => {
    if (initialData?.id) return initialData as AnimeDetail;
    if (typeof window !== "undefined") {
      try {
        const seed = sessionStorage.getItem(`cs_anime_seed_${id}`) || sessionStorage.getItem(`cinestream_anime_${id}`);
        if (seed) {
          const p = JSON.parse(seed);
          if (p && String(p.id) === String(id)) return p as AnimeDetail;
        }
      } catch {}
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (initialData?.id) return false;
    if (typeof window !== "undefined") {
      try {
        const seed = sessionStorage.getItem(`cs_anime_seed_${id}`);
        if (seed) { const p = JSON.parse(seed); if (p && String(p.id) === String(id)) return false; }
      } catch {}
    }
    return true;
  });

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [episodeNotice, setEpisodeNotice] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [franchiseNodes, setFranchiseNodes] = useState<FranchiseNode[]>(() => {
    if (initialData?.franchiseNodes?.length > 1) return initialData.franchiseNodes;
    const mem = FRANCHISE_CACHE.get(String(id));
    if (mem && mem.length > 1) return mem;
    return [];
  });
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(() => {
    return initialData?.openedSeasonId || initialData?.seasons?.find((s: any) => s.isCurrent)?.id || initialData?.id || id;
  });
  const [seasonOverview, setSeasonOverview] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [episodeView, setEpisodeView] = useState<EpisodeViewMode>("grid");
  const [episodePage, setEpisodePage] = useState(1);
  const [listChunkIndex, setListChunkIndex] = useState(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const prevIdRef = useRef<string | null>(null);
  const loadedSeasonIds = useRef<Set<string>>(new Set());
  const animeStatusRef = useRef<string | null>(null);

  // ── Derived: logo, banner, title ─────────────────────────────────────────
  const animeTitle = anime?.name || (anime as any)?.title || "";
  const effectiveInitialLogo = (initialData as any)?.logoUrl || (anime as any)?.logoUrl || null;
  const { logoUrl, backdropUrl: mediaBackdropUrl, loading: logoLoading } = useMediaLogo(id, "anime", animeTitle, effectiveInitialLogo);
  const effectiveLogo = (anime as any)?.logoUrl || (initialData as any)?.logoUrl || logoUrl;

  const seasons = useMemo(() => anime?.seasons || [], [anime]);
  const currentSeason = useMemo(() => seasons.find(s => String(s.id) === String(currentSeasonId)) || null, [seasons, currentSeasonId]);
  const currentSeasonInfo = useMemo(() => {
    const target = String(currentSeasonId || "").trim();
    const cleanTarget = target.replace(/\D/g, "");

    const fromSeason = seasons.find(s =>
      String(s.id) === target ||
      (cleanTarget && String(s.id).replace(/\D/g, "") === cleanTarget) ||
      (s.idMal && cleanTarget && String(s.idMal) === cleanTarget)
    );
    if (fromSeason) return fromSeason;

    const fromNodes = franchiseNodes.find(n =>
      String(n.id) === target ||
      (cleanTarget && String(n.id).replace(/\D/g, "") === cleanTarget) ||
      (n.idMal && cleanTarget && String(n.idMal) === cleanTarget)
    );
    if (fromNodes) return fromNodes;

    return null;
  }, [seasons, franchiseNodes, currentSeasonId]);

  const displayPoster = (currentSeasonInfo as any)?.coverImage || (currentSeason as any)?.coverImage || anime?.poster || "";
  const displayBanner =
    (currentSeasonInfo as any)?.bannerImage ||
    (anime as any)?.bannerImage ||
    (initialData as any)?.bannerImage ||
    (anime?.backdrop ? (anime.backdrop.startsWith("http") ? anime.backdrop : `https://image.tmdb.org/t/p/original${anime.backdrop}`) : null) ||
    mediaBackdropUrl ||
    anime?.poster || "";
  const displayTitle = (currentSeasonInfo as any)?.title || (currentSeasonInfo as any)?.name || currentSeason?.name || anime?.name || "";
  const displayYear = (currentSeasonInfo as any)?.seasonYear || currentSeason?.seasonYear || anime?.seasonYear || null;
  const displayFormat = (currentSeasonInfo as any)?.format || (currentSeasonInfo as any)?.type || anime?.format || anime?.type || "Anime";
  const displayStatus = currentSeason?.status || (currentSeasonInfo as any)?.status || anime?.status || "";

  const isPageReady = Boolean((!isLoading && Boolean(anime)) || error || (anime as any)?.isHidden);
  usePageContentReady(isPageReady);

  // ── Episodes for current season ───────────────────────────────────────────
  const currentSeasonEps = useMemo(() => {
    const target = String(currentSeasonId || id || "").trim();
    // 1. Try direct match
    const direct = episodes.filter(e => String(e.seasonId) === target);
    if (direct.length) return direct.sort((a, b) => a.episodeNum - b.episodeNum);

    // 2. Numeric match fallback
    const clean = target.replace(/\D/g, "");
    if (clean) {
      const numeric = episodes.filter(e => String(e.seasonId || "").replace(/\D/g, "") === clean);
      if (numeric.length) return numeric.sort((a, b) => a.episodeNum - b.episodeNum);
    }

    // 3. Season object lookup fallback
    const activeSeason = seasons.find(s =>
      String(s.id) === target ||
      (clean && String(s.id).replace(/\D/g, "") === clean) ||
      (s.idMal && String(s.idMal) === target) ||
      (clean && s.idMal && String(s.idMal).replace(/\D/g, "") === clean)
    );
    if (activeSeason) {
      const byId = episodes.filter(e =>
        String(e.seasonId) === String(activeSeason.id) ||
        (activeSeason.idMal && String(e.seasonId) === String(activeSeason.idMal)) ||
        (clean && String(e.seasonId).replace(/\D/g, "") === String(activeSeason.id).replace(/\D/g, ""))
      );
      if (byId.length) return byId.sort((a, b) => a.episodeNum - b.episodeNum);
    }

    // 4. Anime ID or openedSeasonId match fallback
    if (anime?.id) {
      const byAnimeId = episodes.filter(e => String(e.seasonId) === String(anime.id));
      if (byAnimeId.length) return byAnimeId.sort((a, b) => a.episodeNum - b.episodeNum);
    }
    if ((anime as any)?.openedSeasonId) {
      const byOpened = episodes.filter(e => String(e.seasonId) === String((anime as any).openedSeasonId));
      if (byOpened.length) return byOpened.sort((a, b) => a.episodeNum - b.episodeNum);
    }

    // 5. Ultimate fallback: if episodes are loaded, return them rather than empty
    if (episodes.length > 0) {
      return [...episodes].sort((a, b) => a.episodeNum - b.episodeNum);
    }

    return [];
  }, [episodes, currentSeasonId, id, seasons, anime]);

  // Deduplicate
  const dedupedCurrentEps = useMemo(() => {
    const seen = new Set<number>();
    const out: Episode[] = [];
    for (const ep of currentSeasonEps) {
      if (!seen.has(ep.episodeNum)) { seen.add(ep.episodeNum); out.push(ep); }
    }
    return out;
  }, [currentSeasonEps]);

  const isMovieFormat = anime?.format === "MOVIE" || anime?.type === "MOVIE" || (currentSeasonInfo as any)?.seasonLabel?.toLowerCase().startsWith("movie") || (currentSeasonInfo as any)?.format === "MOVIE";
  const isSpecialFormat = isMovieFormat || (currentSeasonInfo as any)?.seasonLabel?.toLowerCase().startsWith("ova") || (currentSeasonInfo as any)?.seasonLabel?.toLowerCase().startsWith("special") || (currentSeasonInfo as any)?.format === "OVA" || (currentSeasonInfo as any)?.format === "SPECIAL";
  const isSingleItem = (dedupedCurrentEps.length <= 1 && isSpecialFormat) || isMovieFormat;

  // ── Scroll to top on id change ────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  useEffect(() => {
    if (typeof document !== "undefined" && displayTitle) {
      document.title = `${displayTitle} - CineStream`;
    }
  }, [displayTitle]);

  useEffect(() => { setDescExpanded(false); }, [currentSeasonId, seasonOverview]);
  useEffect(() => { setEpisodePage(1); setListChunkIndex(0); }, [currentSeasonId]);

  // ── Episode page auto-scroll to selected ep ───────────────────────────────
  useEffect(() => {
    if (!selectedEp) return;
    const gridSize = dedupedCurrentEps.length > 500 ? 50 : 25;
    setEpisodePage(Math.floor((selectedEp.episodeNum - 1) / gridSize) + 1);
    setListChunkIndex(Math.floor((selectedEp.episodeNum - 1) / 10));
  }, [selectedEp?.episodeId, selectedEp?.episodeNum, dedupedCurrentEps.length]);

  // ── LOAD SEASON EPISODES (called from one place only) ────────────────────
  const loadSeasonEpisodes = useCallback(async (
    seasonId: string,
    force = false,
    tmdbId?: number | null,
    tmdbSeason?: number | null,
    episodeOffset?: number | null
  ) => {
    if (!force && loadedSeasonIds.current.has(seasonId)) return;
    setEpisodesLoading(true);
    setSeasonOverview(null);

    const EP_KEY = `cs_anime_eps_${id}_${seasonId}_${ANIME_API_VERSION}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(EP_KEY);
        if (cached) {
          const p = JSON.parse(cached);
          if (p?.episodes?.length && p._cachedAt) {
            const age = Date.now() - p._cachedAt;
            const maxAge = (p.status || "").toUpperCase().includes("RELEASING") ? 2 * 60 * 1000 : 5 * 60 * 1000;
            if (age < maxAge) {
              setEpisodes(prev => {
                const other = prev.filter(e => String(e.seasonId) !== String(seasonId));
                return [...other, ...p.episodes].sort((a, b) => a.episodeNum - b.episodeNum);
              });
              if (p.seasonOverview) setSeasonOverview(p.seasonOverview);
              loadedSeasonIds.current.add(seasonId);
              setEpisodesLoading(false);
              return;
            } else {
              sessionStorage.removeItem(EP_KEY);
            }
          }
        }
      } catch {}
    }
    try {
      const matchingSeason = anime?.seasons?.find(s => String(s.id) === String(seasonId));
      const sName = matchingSeason?.name || anime?.name || "";
      const sTot = matchingSeason?.totalEpisodes || anime?.totalEpisodes || 0;
      const tmdbQ = tmdbId != null ? `&tmdbId=${tmdbId}` : "";
      const tsQ = tmdbSeason != null ? `&tmdbSeason=${tmdbSeason}` : "";
      const offQ = episodeOffset != null ? `&episodeOffset=${episodeOffset}` : "";
      const nameQ = sName ? `&seasonName=${encodeURIComponent(sName)}` : "";
      const totQ = sTot > 0 ? `&totalEpisodes=${sTot}` : "";
      const data = await fetchJson<{ success: boolean; data: { episodes: Episode[]; seasonOverview?: string | null; isUpcoming?: boolean; isUnavailable?: boolean } }>(
        `/api/anime/${id}/episodes?seasonId=${encodeURIComponent(seasonId)}${tmdbQ}${tsQ}${offQ}${nameQ}${totQ}&v=${ANIME_API_VERSION}`
      );
      const isUpcoming = Boolean((anime as any)?.isUpcoming || (matchingSeason as any)?.isUpcoming || data.data?.isUpcoming);
      const isUnavailable = Boolean((anime as any)?.isUnavailable || (matchingSeason as any)?.isUnavailable || data.data?.isUnavailable);

      if (isUpcoming || isUnavailable) {
        setEpisodes(prev => prev.filter(e => String(e.seasonId) !== String(seasonId)));
        setSeasonOverview(data.data?.seasonOverview || null);
        loadedSeasonIds.current.add(seasonId);
        setEpisodesLoading(false);
        return;
      }

      if (data.success && data.data?.episodes?.length) {
        const sorted = data.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        setEpisodes(prev => {
          const other = prev.filter(e => String(e.seasonId) !== String(seasonId));
          const seen = new Set<number>();
          const deduped: Episode[] = [];
          for (const ep of sorted) {
            if (!seen.has(ep.episodeNum)) { seen.add(ep.episodeNum); deduped.push({ ...ep, seasonId: String(ep.seasonId || seasonId) }); }
          }
          return [...other, ...deduped].sort((a, b) => {
            if ((a.seasonNum || 1) !== (b.seasonNum || 1)) return (a.seasonNum || 1) - (b.seasonNum || 1);
            return a.episodeNum - b.episodeNum;
          });
        });
        setSeasonOverview(data.data.seasonOverview || null);
        loadedSeasonIds.current.add(seasonId);
        setEpisodesLoading(false);
        try {
          sessionStorage.setItem(EP_KEY, JSON.stringify({ episodes: sorted.map(ep => ({ ...ep, seasonId: String(ep.seasonId || seasonId) })), seasonOverview: data.data.seasonOverview || null, status: animeStatusRef.current || "", _cachedAt: Date.now() }));
        } catch {}
        return;
      }
    } catch (err) {
      console.warn(`[AnimeClient] Episode API failed for ${seasonId}:`, err);
    }

    // Fallback: generate placeholder episodes
    const matchSeason = anime?.seasons?.find(s => String(s.id) === String(seasonId)) || franchiseNodes.find(n => String(n.id) === String(seasonId));
    const isMov = ((matchSeason as any)?.seasonLabel || "").startsWith("Movie") || (matchSeason as any)?.format === "MOVIE" || anime?.format === "MOVIE";
    const count = isMov ? 1 : Math.max((matchSeason as any)?.totalEpisodes || (matchSeason as any)?.episodes || 1, 1);
    const fallback: Episode[] = Array.from({ length: count }, (_, i) => ({
      episodeId: `${seasonId}-${i + 1}`,
      episodeNum: i + 1,
      title: isMov ? ((matchSeason as any)?.name || (matchSeason as any)?.title || anime?.name || "Complete Movie") : `Episode ${i + 1}`,
      description: isMov ? anime?.description : undefined,
      thumbnail: isMov ? ((matchSeason as any)?.coverImage || anime?.poster) : undefined,
      isReleased: true,
      seasonId: String(seasonId),
      seasonNum: 1,
    }));
    setEpisodes(prev => {
      const other = prev.filter(e => String(e.seasonId) !== String(seasonId));
      return [...other, ...fallback].sort((a, b) => a.episodeNum - b.episodeNum);
    });
    loadedSeasonIds.current.add(seasonId);
    setEpisodesLoading(false);
  }, [id, anime, franchiseNodes]);

  // ── MAIN DATA LOADING EFFECT ─────────────────────────────────────────────
  // One clean sequential effect: meta → episodes → background extras
  // Prevents ALL race conditions from the old 4-effect system.
  useEffect(() => {
    if (!id) return;
    if (prevIdRef.current === id) return;
    const isFirstMount = prevIdRef.current === null;
    prevIdRef.current = id;

    // On first mount with valid initial data — skip meta fetch, just load episodes
    if (isFirstMount && initialData) {
      // anime is already set from useState initializer
      animeStatusRef.current = initialData.status || null;
      if (initialData.franchiseNodes?.length > 1) {
        setFranchiseNodes(initialData.franchiseNodes);
        for (const n of initialData.franchiseNodes) {
          FRANCHISE_CACHE.set(String(n.id), initialData.franchiseNodes);
          if ((n as any).idMal) FRANCHISE_CACHE.set(String((n as any).idMal), initialData.franchiseNodes);
        }
      }
      const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const seasonIdParam = urlParams.get("seasonId") || initialData.openedSeasonId || initialData.seasons?.find((s: SeasonInfo) => s.isCurrent)?.id || initialData.id || id;
      setCurrentSeasonId(seasonIdParam);
      const matchSeason = (initialData.seasons || []).find((s: SeasonInfo) => String(s.id) === String(seasonIdParam)) || initialData.seasons?.find((s: SeasonInfo) => s.isCurrent) || initialData.seasons?.[0];
      loadSeasonEpisodes(matchSeason?.id || seasonIdParam, true, matchSeason?.tmdbId, matchSeason?.tmdbSeasonNumber, matchSeason?.episodeOffset);
      return;
    }

    // Navigating to a new anime: reset state first
    if (!isFirstMount) {
      setAnime(null);
      setEpisodes([]);
      setSelectedEp(null);
      setIsPlaying(false);
      setSeasonOverview(null);
      setRecommendations([]);
      setFranchiseNodes([]);
      setIsLoading(true);
      setEpisodesLoading(true);
      setError(null);
      loadedSeasonIds.current.clear();
    }

    let cancelled = false;

    const run = async () => {
      // 1) If there's a session seed, use it immediately and start episodes right away
      let seedData: AnimeDetail | null = null;
      if (typeof window !== "undefined") {
        try {
          const s = sessionStorage.getItem(`cs_anime_seed_${id}`) || sessionStorage.getItem(`cinestream_anime_${id}`);
          if (s) {
            const p = JSON.parse(s);
            if (p && String(p.id) === String(id)) seedData = p as AnimeDetail;
          }
        } catch {}
      }

      if (seedData && !cancelled) {
        setAnime(seedData);
        setIsLoading(false);
        animeStatusRef.current = seedData.status || null;
        const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const targetSeason = urlParams.get("seasonId") || id;
        setCurrentSeasonId(targetSeason);
        // Instantly kick off episode loading in parallel with meta fetch
        loadSeasonEpisodes(targetSeason, false).catch(() => {});
      }

      // 2) Fetch full meta from server (check session cache first)
      const META_KEY = `cs_anime_meta_${id}_${ANIME_API_VERSION}`;
      let metaData: any = null;
      try {
        const cached = sessionStorage.getItem(META_KEY);
        if (cached) {
          const p = JSON.parse(cached);
          if (p?.success && p?.data?.anime && p._cachedAt) {
            const age = Date.now() - p._cachedAt;
            const maxAge = (p.data.anime?.status || "").toUpperCase().includes("RELEASING") ? 2 * 60 * 1000 : 5 * 60 * 1000;
            if (age < maxAge) metaData = p;
          } else sessionStorage.removeItem(META_KEY);
        }
      } catch {}

      if (!metaData) {
        try {
          metaData = await fetchJson<{ success: boolean; data: { anime: AnimeDetail; franchiseNodes?: FranchiseNode[]; tmdbSeasonMap?: Record<string, number> } }>(
            `/api/anime/${id}/meta?v=${ANIME_API_VERSION}`,
            { signal: AbortSignal.timeout(10000) }
          );
          if (metaData?.success && metaData?.data?.anime) {
            try { sessionStorage.setItem(META_KEY, JSON.stringify({ ...metaData, _cachedAt: Date.now() })); } catch {}
          }
        } catch {
          // Try direct anime API as fallback
          try {
            const direct = await fetchJson<{ success: boolean; data: AnimeDetail }>(`/api/anime/${id}`);
            if (direct?.success && direct.data) metaData = { success: true, data: { anime: direct.data } };
          } catch {}
        }
      }

      if (cancelled) return;

      if (!metaData?.success || !metaData?.data?.anime) {
        if (!seedData) {
          setError("Anime not found");
          setIsLoading(false);
          setEpisodesLoading(false);
        } else {
          const target = seedData.id || id;
          try {
            await loadSeasonEpisodes(target, true);
          } catch {}
          if (!cancelled) setEpisodesLoading(false);
        }
        return;
      }

      const a = metaData.data.anime as AnimeDetail;
      if (!a.logoUrl && effectiveLogo) a.logoUrl = effectiveLogo;
      animeStatusRef.current = a.status || null;

      if (!cancelled) {
        setAnime(a);
        setIsLoading(false);
      }

      // Update franchise nodes if available
      const newNodes = metaData.data.franchiseNodes;
      if (!cancelled && newNodes?.length > 1) {
        setFranchiseNodes(newNodes);
        for (const n of newNodes) {
          FRANCHISE_CACHE.set(String(n.id), newNodes);
          if ((n as any).idMal) FRANCHISE_CACHE.set(String((n as any).idMal), newNodes);
        }
      }

      // 3) Determine which season to load and load episodes ONCE
      const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const urlSeasonId = urlParams.get("seasonId");
      const urlSeasonNum = Number(urlParams.get("season") || "");
      const availableSeasons = a.seasons || [];
      const tmdbSeasonMap = metaData.data.tmdbSeasonMap || {};

      const defaultSeasonId = metaData.data.openedSeasonId || a.openedSeasonId || (availableSeasons.find((s: SeasonInfo) => s.isCurrent)?.id) || a.id || id;
      let targetSeasonId = defaultSeasonId;
      if (urlSeasonId) {
        const found = availableSeasons.find((s: SeasonInfo) => String(s.id) === String(urlSeasonId));
        if (found) targetSeasonId = found.id;
        else targetSeasonId = urlSeasonId;
      } else if (urlSeasonNum > 0) {
        const entry = Object.entries(tmdbSeasonMap).find(([, num]) => num === urlSeasonNum);
        if (entry) {
          const found = availableSeasons.find((s: SeasonInfo) => String(s.id) === String(entry[0]));
          if (found) targetSeasonId = found.id;
        }
      }

      if (!cancelled) setCurrentSeasonId(targetSeasonId);

      const targetSeason = availableSeasons.find((s: SeasonInfo) => String(s.id) === String(targetSeasonId)) || availableSeasons.find((s: SeasonInfo) => s.isCurrent) || availableSeasons[0];
      await loadSeasonEpisodes(
        targetSeason?.id || targetSeasonId,
        true,
        targetSeason?.tmdbId,
        targetSeason?.tmdbSeasonNumber,
        targetSeason?.episodeOffset
      );
    };

    run().catch(e => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : "Failed to load anime");
        setIsLoading(false);
        setEpisodesLoading(false);
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Watch order background hydration ─────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const mem = FRANCHISE_CACHE.get(String(id));
    if (mem && mem.length > franchiseNodes.length) {
      setFranchiseNodes(mem);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetchJson<{ success: boolean; data: { franchiseNodes: FranchiseNode[] } }>(
          `/api/anime/${id}/watch-order?v=${ANIME_API_VERSION}&title=${encodeURIComponent(animeTitle)}`
        );
        if (cancelled) return;
        const nodes = res?.data?.franchiseNodes;
        if (nodes && nodes.length > 1) {
          if (nodes.length >= franchiseNodes.length) {
            setFranchiseNodes(nodes);
          }
          for (const n of nodes) {
            FRANCHISE_CACHE.set(String(n.id), nodes);
            if ((n as any).idMal) FRANCHISE_CACHE.set(String((n as any).idMal), nodes);
          }
        }
      } catch {}
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [id, animeTitle, franchiseNodes.length]);

  // ── Recommendations ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !anime) return;
    let active = true;
    setRecsLoading(true);

    const targetId = anime.id || id;
    const excludeIds = new Set([String(id), String(anime.id || ""), ...franchiseNodes.map(n => String(n.id))]);
    const genres = anime.genres || [];
    const title = anime.name || (anime as any)?.title || "";

    const RECS_KEY = `cs_recs_v3_${targetId}`;
    try {
      const cached = sessionStorage.getItem(RECS_KEY);
      if (cached) {
        const p = JSON.parse(cached);
        if (Array.isArray(p) && p.length > 0) {
          const withReasons = p.map((item: any) => ({ ...item, reason: getRecommendationReason(genres.map((g: string) => g.charCodeAt(0)), item.genres?.map((g: string) => g.charCodeAt(0)) || []) }));
          setRecommendations(withReasons);
          setRecsLoading(false);
          return;
        }
      }
    } catch {}

    const t = setTimeout(async () => {
      try {
        const excludeParam = [...excludeIds].filter(Boolean).join(",");
        const res = await fetch(`/api/anime/recommendations/${encodeURIComponent(targetId)}?title=${encodeURIComponent(title)}&genres=${encodeURIComponent(genres.join(","))}&format=${encodeURIComponent(displayFormat || "")}&excludeIds=${encodeURIComponent(excludeParam)}`);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          const items = data?.items || [];
          if (items.length > 0) {
            const withReasons = items.map((item: any) => ({ ...item, reason: getRecommendationReason(genres.map((g: string) => g.charCodeAt(0)), item.genres?.map((g: string) => g.charCodeAt(0)) || []) }));
            setRecommendations(withReasons);
            try { sessionStorage.setItem(RECS_KEY, JSON.stringify(items)); } catch {}
          }
        }
      } catch {}
      if (active) setRecsLoading(false);
    }, 150);

    return () => { active = false; clearTimeout(t); };
  }, [anime?.id, anime?.name, anime?.genres, id, franchiseNodes.length, displayFormat]);

  // ── URL param restoration (autoplay/episode) ──────────────────────────────
  useEffect(() => {
    if (!episodes.length) return;
    const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const episodeParam = Number(urlParams.get("episode") || "");
    const seasonIdParam = urlParams.get("seasonId") || "";
    const autoPlay = urlParams.get("autoplay") === "1";

    if (episodeParam > 0) {
      const target = episodes.find(ep => (seasonIdParam ? ep.seasonId === seasonIdParam : true) && ep.episodeNum === episodeParam);
      if (target && (!selectedEp || selectedEp.episodeNum === 1)) {
        setSelectedEp(target);
        if (autoPlay) {
          router.push(`/watch/anime/${target.seasonId || currentSeasonId || anime?.id || id}/${target.episodeNum}`);
        }
      }
    }
  }, [episodes, id]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSeasonClick = useCallback((season: SeasonInfo) => {
    if (String(season.id) === String(currentSeasonId)) return;
    setCurrentSeasonId(season.id);
    setEpisodesLoading(true);
    setIsPlaying(false);
    setSelectedEp(null);
    setEpisodeNotice(null);
    setSeasonOverview(null);
    loadSeasonEpisodes(season.id, true, (season as any).tmdbId, season.tmdbSeasonNumber, (season as any).episodeOffset);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("seasonId", season.id);
      url.searchParams.delete("episode");
      window.history.replaceState({}, "", url.toString());
    }
  }, [currentSeasonId, loadSeasonEpisodes]);

  const handleWatchEpisode = useCallback((ep: Episode) => {
    if (ep.isReleased === false) { setEpisodeNotice(`Episode ${ep.episodeNum} hasn't been released yet.`); return; }
    setEpisodeNotice(null);
    const target = ep.seasonId || currentSeasonId || anime?.id || id;
    router.push(`/watch/anime/${target}/${ep.episodeNum}`);
  }, [anime?.id, currentSeasonId, id, router]);

  const handleViewChange = useCallback((view: EpisodeViewMode) => setEpisodeView(view), []);

  // ── Episode list conversion ───────────────────────────────────────────────
  const episodeToItem = useCallback((ep: Episode): EpisodeItem => {
    const unreleased = ep.isReleased === false;
    const backdropFallback = (anime as any)?.bannerImage || initialData?.bannerImage || displayPoster || null;
    const thumbSrc = unreleased ? (ep.thumbnail || null) : (ep.thumbnail || (isSingleItem && displayPoster) || backdropFallback);
    const isSelected = selectedEp?.episodeId === ep.episodeId || Number(selectedEp?.episodeNum) === Number(ep.episodeNum);
    return {
      key: `${currentSeasonId}-${ep.episodeNum}-${ep.episodeId || "ep"}`,
      number: ep.episodeNum,
      title: ep.title || (isSingleItem ? displayTitle : `Episode ${ep.episodeNum}`),
      description: ep.description || null,
      thumbnail: thumbSrc || null,
      airDate: ep.releasedDate || null,
      runtime: ep.runtime || null,
      rating: ep.vote_average || null,
      hasRating: Boolean(ep.vote_average && ep.vote_average > 0 && ep.vote_count && ep.vote_count > 5),
      isFiller: Boolean(ep.isFiller),
      isReleased: ep.isReleased !== false,
      isSelected,
      isPlaying: isPlaying && isSelected,
      portrait: isSingleItem,
      onClick: () => handleWatchEpisode(ep),
    };
  }, [anime, currentSeasonId, displayPoster, displayTitle, handleWatchEpisode, isPlaying, isSingleItem, selectedEp]);

  const episodeItems = useMemo(() => dedupedCurrentEps.map(episodeToItem), [dedupedCurrentEps, episodeToItem]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const { theme } = useTheme();
  const pageBgClass = useMemo(() => {
    const map: Record<string, string> = { global: "bg-[#07080d]", glass: "bg-transparent", oled: "bg-[#000000]", cinema: "bg-[#140509]", wisteria: "bg-[#0e071c]", solaris: "bg-[#100b05]" };
    return map[theme] || "bg-[#07080d]";
  }, [theme]);

  const animeScore = (() => { const r = Number(anime?.rating || anime?.score || 0); return r > 10 ? r / 10 : r; })();
  const animeDescription = seasonOverview || (currentSeasonInfo as any)?.description || (currentSeason as any)?.description || anime?.description || "";
  const isLongDescription = animeDescription.length > 200;
  const animeBackdropUrl = displayBanner || displayPoster || null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`relative min-h-screen ${pageBgClass} text-foreground pb-20 overflow-x-clip transition-colors duration-500`}>
      {isPageReady && Boolean(anime) && <AmbientBackdropGlow backdropUrl={animeBackdropUrl} />}
      <Sidebar />

      <main className="relative z-10 w-full pt-0 bleed-header select-none">
        {!isPageReady ? (
          <div className="min-h-screen w-full" />
        ) : (error || (anime as any)?.isHidden) ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-16">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl max-w-lg mx-auto space-y-3">
              <div className="text-xl font-bold text-white mb-2">Title Unavailable</div>
              <div className="text-sm text-white/50 mb-4">This anime is currently not available to view. Please check back later or explore other anime.</div>
              <Link href="/anime" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4B5694] hover:bg-[#4B5694] text-white rounded-xl text-sm font-bold transition-all">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>
            </div>
          </div>
        ) : anime ? (
          <>
            {/* Hero */}
            <CinematicHero backdropPath={displayBanner} trailerId={anime.trailerId} title={displayTitle} theme="anime">
              <div className="relative z-10 pb-4 md:pb-8 px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 flex flex-col lg:flex-row lg:items-end justify-between gap-6 w-full">
                <div className="flex flex-row items-center gap-3.5 sm:gap-6 md:gap-8 min-w-0 flex-1">
                  <div className="shrink-0 w-24 sm:w-36 md:w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10">
                    <img src={displayPoster} alt={displayTitle} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                    <div>
                      {effectiveLogo ? (
                        <div className="mb-4 sm:mb-5 max-w-[280px] sm:max-w-[340px] md:max-w-[420px] lg:max-w-[480px]">
                          <img src={effectiveLogo} alt={displayTitle} className="max-h-20 sm:max-h-24 md:max-h-28 lg:max-h-32 w-auto object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]" />
                          {displayTitle && anime?.name && displayTitle.toLowerCase() !== anime.name.toLowerCase() ? (
                            <div className="mt-2 text-sm sm:text-base font-black text-white/90 tracking-wide drop-shadow-md">
                              {displayTitle}
                            </div>
                          ) : currentSeason?.seasonLabel && !currentSeason.seasonLabel.toLowerCase().includes("season 1") ? (
                            <div className="mt-1.5 inline-block px-2.5 py-0.5 rounded-lg bg-primary/30 border border-primary/40 text-xs sm:text-sm font-bold text-white shadow">
                              {currentSeason.seasonLabel}
                            </div>
                          ) : null}
                        </div>
                      ) : !logoLoading ? (
                        <h1 className="font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight select-text">{displayTitle}</h1>
                      ) : (
                        <div className="h-10 sm:h-14 md:h-16 w-48 sm:w-64 rounded-xl bg-white/5 animate-pulse mb-3" />
                      )}
                      {anime.jname && <p className="text-primary/90 font-semibold italic text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1 select-text">{anime.jname}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-sm sm:text-base font-extrabold">
                      {animeScore > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 font-black shadow-sm text-sm sm:text-base">
                          <Star className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current text-emerald-400" />
                          <span className="tracking-tight">{animeScore.toFixed(1)}</span>
                          <span className="text-white/40 font-bold text-xs">/10</span>
                        </div>
                      )}
                      {displayStatus && (() => {
                        const fmt = formatAnimeStatus(displayStatus);
                        return (
                          <span className={`text-[10px] sm:text-xs font-black tracking-wider px-3 py-1 rounded-xl uppercase border shadow-sm ${
                            fmt.style === "airing" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" :
                            fmt.style === "upcoming" ? "text-sky-300 bg-sky-500/20 border-sky-500/30" :
                            "text-white bg-white/10 border-white/20"
                          }`}>{fmt.label}</span>
                        );
                      })()}
                      <span className="px-3 py-1 bg-white/[0.08] border border-white/15 rounded-xl text-xs sm:text-sm font-extrabold text-white shadow-sm">{displayFormat}</span>
                      <div className="flex flex-wrap gap-2 ml-0.5">
                        {anime.genres?.slice(0, 5).map(g => (
                          <span key={g} className="px-3.5 py-1 bg-fuchsia-500/15 border border-fuchsia-400/30 rounded-full text-xs sm:text-sm font-extrabold text-fuchsia-200 shadow-sm">{g}</span>
                        ))}
                      </div>
                    </div>

                    {animeDescription && (
                      <div>
                        <p className={cn("text-white/65 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl select-text", isLongDescription && !descExpanded && "line-clamp-2 sm:line-clamp-3")}>{animeDescription}</p>
                        {isLongDescription && (
                          <button onClick={() => setDescExpanded(v => !v)} className="mt-1 inline-flex items-center gap-1 text-primary hover:text-primary/85 text-xs sm:text-sm font-bold transition-colors">
                            {descExpanded ? "Read less" : "Read more"}<ChevronDown className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform", descExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="pt-1">
                      {(anime as any)?.isUpcoming || (anime as any)?.status === "upcoming" || (currentSeasonInfo as any)?.isUpcoming ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs sm:text-sm font-semibold shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                            <span>This entry is upcoming. Please check back later.</span>
                          </div>
                          <WatchlistButton mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0} mediaType="anime" title={anime.name} posterPath={anime.poster || null} />
                          <TrailerButton />
                        </div>
                      ) : (anime as any)?.isUnavailable || (anime as any)?.status === "unavailable" || (currentSeasonInfo as any)?.isUnavailable ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-300 text-xs sm:text-sm font-semibold shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                            <span>This title is currently unavailable on this site. Please check back later.</span>
                          </div>
                          <WatchlistButton mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0} mediaType="anime" title={anime.name} posterPath={anime.poster || null} />
                          <TrailerButton />
                        </div>
                      ) : dedupedCurrentEps.length > 0 ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <button
                            onClick={() => { const first = dedupedCurrentEps.find(ep => ep.isReleased !== false) || dedupedCurrentEps[0]; if (first) handleWatchEpisode(first); }}
                            className="group flex items-center gap-2 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-xl shadow-black/30"
                          >
                            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current group-hover:scale-110 transition-transform" />
                            {isMovieFormat ? `Watch ${dedupedCurrentEps.length > 1 ? `Movie ${dedupedCurrentEps[0]?.episodeNum || 1}` : "Movie"}` : `Watch Ep ${selectedEp?.episodeNum || dedupedCurrentEps[0]?.episodeNum || 1}`}
                          </button>
                          <WatchlistButton mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0} mediaType="anime" title={anime.name} posterPath={anime.poster || null} />
                          <TrailerButton />
                        </div>
                      ) : episodesLoading ? (
                        <div className="flex items-center gap-4 w-full">
                          <div className="h-12 w-36 rounded-xl bg-white/10 animate-pulse" />
                          <TrailerButton />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 w-full">
                          <button disabled className="flex items-center gap-2 bg-white/10 text-white/30 font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm cursor-not-allowed">No Episodes Available</button>
                          <TrailerButton />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CinematicHero>

            {/* Main Content */}
            <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 mt-6 space-y-6">
              <Link href="/anime" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>

              {/* Title & metadata row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-white">{displayTitle || anime.name}</h2>
                    {isMovieFormat && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Movie</span>}
                    {((anime as any)?.isUpcoming || anime.status === "upcoming") && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Upcoming</span>}
                    {((anime as any)?.isUnavailable || anime.status === "unavailable") && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-700/40 text-zinc-300 border border-zinc-600/40">Unavailable</span>}
                  </div>
                  {anime.jname && anime.jname !== anime.name && <p className="text-xs text-white/40 mt-0.5">{anime.jname}</p>}
                  {animeScore > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-current" /><span>{animeScore.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5 bg-black/50 backdrop-blur-xl border border-white/15 rounded-2xl shadow-xl shrink-0 self-start sm:self-center">
                  <span className="text-sm font-bold text-white/90 uppercase tracking-wider">{displayFormat}</span>
                  {displayYear && (<><div className="w-px h-4 bg-white/15" /><span className="text-sm font-semibold text-white/70">{displayYear}</span></>)}
                  <div className="w-px h-4 bg-white/15" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-black text-white">{isMovieFormat ? 1 : (dedupedCurrentEps.length || (currentSeasonInfo as any)?.totalEpisodes || (currentSeasonInfo as any)?.episodes || currentSeason?.totalEpisodes || (anime as any)?.totalEpisodes || 1)}</span>
                    <span className="text-xs text-white/50 font-semibold">{isMovieFormat ? "Movie" : (((dedupedCurrentEps.length || (currentSeasonInfo as any)?.totalEpisodes || (currentSeasonInfo as any)?.episodes || currentSeason?.totalEpisodes || (anime as any)?.totalEpisodes) === 1) ? "Episode" : "Episodes")}</span>
                  </div>
                  <div className="w-px h-4 bg-white/15" />
                  {(() => {
                    const fmt = formatAnimeStatus(displayStatus);
                    const dot = fmt.style === "airing" ? "bg-emerald-400" : fmt.style === "upcoming" ? "bg-sky-400" : "bg-white/60";
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dot} ${fmt.style === "airing" ? "animate-pulse" : ""}`} />
                        <span className="text-sm font-bold text-white">{fmt.style === "airing" ? "Ongoing" : fmt.style === "upcoming" ? "Upcoming" : "Completed"}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {episodeNotice && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">{episodeNotice}</div>
              )}

              {/* Episodes Section */}
              <section id="anime-episodes-section" className="mt-10 space-y-4">
                {/* TV-Style Seasons, Movies & Specials Selector */}
                <AnimeSeasonSelector
                  franchiseNodes={franchiseNodes}
                  currentSeasons={seasons}
                  currentAnimeId={id}
                  currentSeasonId={currentSeasonId}
                  animeTitle={anime.name}
                />

                {/* Episodes header */}
                <div id="anime-episodes-list" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full shadow-lg" />
                    <h2 className="text-2xl font-black text-white tracking-tight">Episodes</h2>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap max-w-xl justify-end">
                    {dedupedCurrentEps.length > 0 && <EpisodeViewSelector mode={episodeView} onChange={handleViewChange} views={["list", "grid", "numbers"]} />}
                  </div>
                </div>

                {/* Episode Display */}
                {(() => {
                  if (episodesLoading && dedupedCurrentEps.length === 0) {
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

                  if ((anime as any)?.isUpcoming || anime.status === "upcoming" || (currentSeasonInfo as any)?.isUpcoming) {
                    return (
                      <div className="p-10 text-center rounded-2xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-md my-4">
                        <div className="text-4xl mb-3">⏳</div>
                        <h3 className="text-lg font-black text-amber-300 mb-1">Upcoming Anime Release</h3>
                        <p className="text-xs text-zinc-300/80 max-w-md mx-auto leading-relaxed">This entry is scheduled as Upcoming. Episodes and streaming will be available as soon as it premieres!</p>
                      </div>
                    );
                  }

                  if ((anime as any)?.isUnavailable || anime.status === "unavailable" || (currentSeasonInfo as any)?.isUnavailable) {
                    return (
                      <div className="p-10 text-center rounded-2xl border border-zinc-700/50 bg-zinc-900/40 backdrop-blur-md my-4">
                        <div className="text-4xl mb-3">🔒</div>
                        <h3 className="text-lg font-black text-zinc-300 mb-1">Currently Unavailable</h3>
                        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">This title is currently unavailable for streaming on this site. Please check back later.</p>
                      </div>
                    );
                  }

                  if (dedupedCurrentEps.length === 0) {
                    const isNotYet = anime.status === "NOT_YET_RELEASED" || anime.status === "NOT_YET_AIRED" || anime.status === "Not Yet Aired";
                    return (
                      <div className="p-10 text-center rounded-2xl border border-emerald-500/25 bg-emerald-950/20 backdrop-blur-md my-4">
                        <div className="text-4xl mb-3">📅</div>
                        <h3 className="text-lg font-black text-emerald-300 mb-1">{isNotYet ? "Not Yet Released" : "No Episodes Available"}</h3>
                        <p className="text-xs text-zinc-300/80 max-w-md mx-auto leading-relaxed">
                          {isNotYet ? `This anime season (${anime.seasonYear || "Upcoming"}) has not started broadcasting yet.` : "No episodes are currently available for this season."}
                        </p>
                      </div>
                    );
                  }

                  if (episodeView === "numbers") {
                    return <div key={`numbers-${currentSeasonId}`}><EpisodeNumbersView items={episodeItems} /></div>;
                  }

                  if (episodeView === "grid") {
                    const gridSize = episodeItems.length > 500 ? 50 : 25;
                    const totalPages = Math.ceil(episodeItems.length / gridSize);
                    const activePage = Math.min(Math.max(1, episodePage), Math.max(1, totalPages));
                    const sliced = episodeItems.slice((activePage - 1) * gridSize, activePage * gridSize);
                    const onPageChange = (p: number) => { setEpisodePage(p); document.getElementById("anime-episodes-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
                    return (
                      <div key={`grid-${currentSeasonId}-${activePage}`}>
                        {totalPages > 1 && <div className="mb-6"><EpisodePagination currentPage={activePage} totalPages={totalPages} totalItems={episodeItems.length} itemsPerPage={gridSize} onPageChange={onPageChange} /></div>}
                        <EpisodeGridView items={sliced} />
                        {totalPages > 1 && <div className="mt-8"><EpisodePagination currentPage={activePage} totalPages={totalPages} totalItems={episodeItems.length} itemsPerPage={gridSize} onPageChange={onPageChange} /></div>}
                      </div>
                    );
                  }

                  const CHUNK = 10;
                  const totalChunks = Math.ceil(episodeItems.length / CHUNK);
                  const activeChunk = Math.min(Math.max(0, listChunkIndex), Math.max(0, totalChunks - 1));
                  const slicedChunk = episodeItems.slice(activeChunk * CHUNK, activeChunk * CHUNK + CHUNK);
                  const onChunkChange = (c: number) => { setListChunkIndex(c); document.getElementById("anime-episodes-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

                  return (
                    <div key={`list-${currentSeasonId}-${activeChunk}`}>
                      {episodeItems.length > CHUNK && <div className="flex justify-end mt-2 mb-6"><EpisodeChunkBar totalEpisodes={episodeItems.length} chunkSize={CHUNK} activeChunkIndex={activeChunk} onChunkChange={onChunkChange} activeEpisodeNumber={selectedEp?.episodeNum} /></div>}
                      <EpisodeListView items={slicedChunk} />
                      {episodeItems.length > CHUNK && <div className="flex justify-end mt-8 pt-4 border-t border-white/[0.06]"><EpisodeChunkBar totalEpisodes={episodeItems.length} chunkSize={CHUNK} activeChunkIndex={activeChunk} onChunkChange={onChunkChange} activeEpisodeNumber={selectedEp?.episodeNum} /></div>}
                    </div>
                  );
                })()}
              </section>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <>
                  <div className="mt-16 mb-6 px-5 md:px-0">
                    <h2 className="text-lg md:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full" />
                      You May Like
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-x-4 gap-y-6 px-5 md:px-0 pt-3 -mt-3">
                    {recommendations.slice(0, 20).map((item: any, i: number) => {
                      const cls = i < 4 ? "block" : i < 6 ? "hidden sm:block" : i < 8 ? "hidden md:block" : i < 10 ? "hidden lg:block" : i < 12 ? "hidden xl:block" : i < 14 ? "hidden 2xl:block" : i < 16 ? "hidden 3xl:block" : "hidden 4xl:block";
                      return <div key={item.id} className={cls}><AnimeCard item={item} index={i} /></div>;
                    })}
                  </div>
                </>
              )}

              {recsLoading && !recommendations.length && (
                <>
                  <div className="mt-16 mb-6 px-5 md:px-0">
                    <h2 className="text-lg md:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full" />
                      You May Like
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-x-4 gap-y-6 px-5 md:px-0 pt-3 -mt-3">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const cls = i < 4 ? "block" : i < 6 ? "hidden sm:block" : i < 8 ? "hidden md:block" : i < 10 ? "hidden lg:block" : i < 12 ? "hidden xl:block" : i < 14 ? "hidden 2xl:block" : i < 16 ? "hidden 3xl:block" : "hidden 4xl:block";
                      return <div key={i} className={cn("aspect-[2/3] w-full shrink-0 rounded-2xl shimmer", cls)} style={{ animationDelay: `${i * 80}ms` }} />;
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
