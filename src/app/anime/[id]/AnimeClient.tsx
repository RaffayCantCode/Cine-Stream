"use client";

import React, { Component, type ReactNode, useEffect, useState, useRef, useCallback, useMemo } from "react";
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
  isPlaceholder?: boolean;
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

const ANIME_API_VERSION = "v55-resilient";

export function getSafeAnimeTitle(raw: any): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    return raw.english || raw.romaji || raw.native || raw.name || raw.title || "";
  }
  return String(raw);
}

export function getSafeAnimeDescription(raw: any): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw.replace(/<[^>]*>/g, "").trim();
  if (typeof raw === "object") {
    return getSafeAnimeTitle(raw);
  }
  return String(raw);
}

function safeSessionSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith("cs_anime_") || k.startsWith("cs_recs_") || k.startsWith("logo_") || k.startsWith("artwork_"))) {
          sessionStorage.removeItem(k);
        }
      }
      sessionStorage.setItem(key, value);
    } catch {}
  }
}

function formatAnimeStatus(raw?: string | null): { label: string; style: "finished" | "airing" | "upcoming" } {
  if (!raw) return { label: "FINISHED", style: "finished" };
  const s = raw.toUpperCase().replace(/_/g, " ").trim();
  if (s.includes("RELEASING") || s.includes("CURRENTLY AIRING") || s === "AIRING") return { label: "CURRENTLY AIRING", style: "airing" };
  if (s.includes("NOT YET") || s.includes("UPCOMING") || s.includes("CANCELLED")) return { label: "NOT YET AIRED", style: "upcoming" };
  return { label: "FINISHED", style: "finished" };
}

// Direct browser fallback from residential IP when server API is blocked or unreachable
async function clientFetchAnimeFallback(
  rawId: string,
  signal?: AbortSignal
): Promise<{ anime: AnimeDetail; franchiseNodes?: FranchiseNode[]; tmdbSeasonMap?: Record<string, number> } | null> {
  const idStr = String(rawId || "").trim();
  const isKitsu = idStr.startsWith("kitsu-");
  const numOnly = parseInt(idStr.replace(/\D/g, ""), 10);

  // 1. Direct AniList GraphQL query from browser (residential IP)
  if (!isKitsu && !isNaN(numOnly) && numOnly > 0) {
    try {
      const q = `query ($id: Int) {
        Media(id: $id, type: ANIME, isAdult: false) {
          id
          idMal
          title { romaji english native }
          coverImage { large extraLarge }
          bannerImage
          format
          season
          seasonYear
          status
          averageScore
          genres
          description
          episodes
          duration
          trailer { id site }
          nextAiringEpisode { episode airingAt timeUntilAiring }
          relations {
            edges {
              relationType
              node {
                id
                idMal
                title { romaji english native }
                episodes
                status
                season
                seasonYear
                format
                duration
                bannerImage
                coverImage { large extraLarge }
              }
            }
          }
        }
      }`;

      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query: q, variables: { id: numOnly } }),
        signal: signal || AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json = await res.json();
        const media = json?.data?.Media;
        if (media) {
          const title = getSafeAnimeTitle(media.title?.english || media.title?.romaji || media.title?.native || "Anime");
          const poster = media.coverImage?.extraLarge || media.coverImage?.large || "";
          const banner = media.bannerImage || null;
          const isMovie = media.format === "MOVIE";
          const eps = isMovie ? 1 : (media.episodes || 12);
          const score = media.averageScore ? (media.averageScore / 10).toFixed(1) : null;
          const desc = getSafeAnimeDescription(media.description);

          const nodes: FranchiseNode[] = [{
            id: String(media.id),
            idMal: media.idMal ? Number(media.idMal) : null,
            title,
            episodes: eps,
            totalEpisodes: eps,
            format: media.format || "TV",
            seasonYear: media.seasonYear || null,
            coverImage: poster,
            bannerImage: banner,
          }];

          if (Array.isArray(media.relations?.edges)) {
            for (const edge of media.relations.edges) {
              const rel = edge.relationType;
              if (["SEQUEL", "PREQUEL", "ALTERNATIVE", "SIDE_STORY", "SPIN_OFF"].includes(rel) && edge.node?.id) {
                const n = edge.node;
                nodes.push({
                  id: String(n.id),
                  idMal: n.idMal ? Number(n.idMal) : null,
                  title: getSafeAnimeTitle(n.title?.english || n.title?.romaji || n.title?.native || "Season"),
                  episodes: n.episodes || null,
                  totalEpisodes: n.episodes || null,
                  format: n.format || "TV",
                  seasonYear: n.seasonYear || null,
                  coverImage: n.coverImage?.extraLarge || n.coverImage?.large || null,
                  bannerImage: n.bannerImage || null,
                });
              }
            }
          }

          const seasons: SeasonInfo[] = nodes.map((node, idx) => ({
            id: String(node.id),
            name: node.title,
            seasonLabel: node.format === "MOVIE" ? `Movie ${idx + 1}` : (nodes.length > 1 ? `Season ${idx + 1}` : "Season 1"),
            totalEpisodes: node.totalEpisodes || node.episodes || eps,
            isCurrent: String(node.id) === String(media.id),
            idMal: node.idMal,
            seasonYear: node.seasonYear,
            status: media.status,
            coverImage: node.coverImage || poster,
            bannerImage: node.bannerImage || banner,
          }));

          const anime: AnimeDetail = {
            id: String(media.id),
            idMal: media.idMal ? String(media.idMal) : null,
            name: title,
            jname: media.title?.native || null,
            poster,
            bannerImage: banner,
            description: desc,
            type: media.format || "TV",
            format: media.format || "TV",
            rating: score,
            score,
            status: media.status || null,
            genres: media.genres || [],
            totalEpisodes: eps,
            seasons,
            season: media.season || null,
            seasonYear: media.seasonYear || null,
            openedSeasonId: String(media.id),
            trailerId: media.trailer?.site === "youtube" ? media.trailer.id : null,
            duration: media.duration || null,
            nextAiringEpisode: media.nextAiringEpisode || null,
          };

          return { anime, franchiseNodes: nodes };
        }
      }
    } catch (err) {
      console.warn("[AnimeClient] AniList direct client query failed:", err);
    }
  }

  // 2. Direct Kitsu API query from browser
  try {
    const cleanKitsuId = idStr.replace(/^kitsu-/, "").trim();
    const kRes = await fetch(`https://kitsu.io/api/edge/anime/${encodeURIComponent(cleanKitsuId)}?include=categories`, {
      headers: { "Accept": "application/vnd.api+json" },
      signal: signal || AbortSignal.timeout(6000),
    });

    if (kRes.ok) {
      const kJson = await kRes.json();
      const kData = kJson?.data;
      if (kData) {
        const attr = kData.attributes || {};
        const title = getSafeAnimeTitle(attr.titles?.en || attr.canonicalTitle || attr.titles?.en_jp || "Anime");
        const poster = attr.posterImage?.large || attr.posterImage?.original || "";
        const banner = attr.coverImage?.large || attr.coverImage?.original || null;
        const eps = attr.episodeCount || 1;
        const score = attr.averageRating ? (parseFloat(attr.averageRating) / 10).toFixed(1) : null;
        const desc = getSafeAnimeDescription(attr.synopsis || attr.description);

        const seasonInfo: SeasonInfo = {
          id: `kitsu-${kData.id}`,
          name: title,
          seasonLabel: "Season 1",
          totalEpisodes: eps,
          isCurrent: true,
          coverImage: poster,
          bannerImage: banner,
        };

        const anime: AnimeDetail = {
          id: `kitsu-${kData.id}`,
          name: title,
          jname: attr.titles?.ja_jp || null,
          poster,
          bannerImage: banner,
          description: desc,
          type: (attr.subtype || "TV").toUpperCase(),
          format: (attr.subtype || "TV").toUpperCase(),
          rating: score,
          score,
          status: attr.status === "current" ? "RELEASING" : (attr.status === "finished" ? "FINISHED" : "NOT_YET_RELEASED"),
          genres: [],
          totalEpisodes: eps,
          seasons: [seasonInfo],
          openedSeasonId: `kitsu-${kData.id}`,
        };

        return { anime, franchiseNodes: [] };
      }
    }
  } catch (err) {
    console.warn("[AnimeClient] Kitsu direct client query failed:", err);
  }

  // 3. Direct AniZip mappings query from browser
  try {
    const param = isKitsu
      ? `kitsu_id=${idStr.replace("kitsu-", "")}`
      : !isNaN(numOnly) && numOnly > 0
      ? `anilist_id=${numOnly}`
      : null;

    if (param) {
      const azRes = await fetch(`https://api.ani.zip/mappings?${param}`, {
        signal: signal || AbortSignal.timeout(4000),
      });
      if (azRes.ok) {
        const az = await azRes.json();
        const titles = az?.titles || {};
        const title = getSafeAnimeTitle(titles.en || titles["x-jat"] || titles.ja || az?.mappings?.canonicalTitle || "Anime");
        const poster = az?.images?.[0]?.url || "";
        const eps = az?.episodes ? Object.keys(az.episodes).length : 12;

        const seasonInfo: SeasonInfo = {
          id: idStr,
          name: title,
          seasonLabel: "Season 1",
          totalEpisodes: eps,
          isCurrent: true,
          coverImage: poster,
          bannerImage: null,
        };

        const anime: AnimeDetail = {
          id: idStr,
          name: title,
          jname: titles.ja || null,
          poster,
          bannerImage: null,
          description: "Anime details loaded from secondary metadata service.",
          type: (az?.mappings?.type || "TV").toUpperCase(),
          format: (az?.mappings?.type || "TV").toUpperCase(),
          rating: null,
          score: null,
          status: "FINISHED",
          genres: [],
          totalEpisodes: eps,
          seasons: [seasonInfo],
          openedSeasonId: idStr,
        };

        return { anime, franchiseNodes: [] };
      }
    }
  } catch {}

  return null;
}

class AnimeContentErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AnimeContentErrorBoundary] Caught exception in anime content:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-16">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <div className="text-xl font-black text-white">Something went wrong displaying this anime</div>
            <div className="text-sm text-white/60">An unexpected rendering issue occurred. You can retry or head back to the anime directory.</div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-md"
              >
                Retry
              </button>
              <Link
                href="/anime"
                className="px-5 py-2.5 rounded-xl bg-[#4B5694] hover:bg-[#5a67ad] text-white text-sm font-bold transition-all active:scale-95 shadow-md"
              >
                Back to Anime
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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
  const { data: session, status } = useSession();
  const [playingSeason, setPlayingSeason] = useState<number>(1);
  const [playingEpisode, setPlayingEpisode] = useState<number>(1);
  const [hasActiveProgress, setHasActiveProgress] = useState(false);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  // ── Core state ───────────────────────────────────────────────────────────
  const [anime, setAnime] = useState<AnimeDetail | null>(() => {
    if (initialData?.id) return initialData as AnimeDetail;
    return null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (initialData?.id) return false;
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
  const animeTitle = getSafeAnimeTitle(anime?.name || (anime as any)?.title || "");
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

    const fromNodes = (franchiseNodes || []).find(n =>
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
    (typeof anime?.backdrop === "string" ? (anime.backdrop.startsWith("http") ? anime.backdrop : `https://image.tmdb.org/t/p/original${anime.backdrop}`) : null) ||
    mediaBackdropUrl ||
    anime?.poster || "";
  const displayTitle = getSafeAnimeTitle((currentSeasonInfo as any)?.title || (currentSeasonInfo as any)?.name || currentSeason?.name || anime?.name || "");
  const displayYear = (currentSeasonInfo as any)?.seasonYear || currentSeason?.seasonYear || anime?.seasonYear || null;
  const displayFormat = getSafeAnimeTitle((currentSeasonInfo as any)?.format || (currentSeasonInfo as any)?.type || anime?.format || anime?.type || "Anime");
  const displayStatus = getSafeAnimeTitle(currentSeason?.status || (currentSeasonInfo as any)?.status || anime?.status || "");

  const isPageReady = Boolean(!isLoading || error || (anime as any)?.isHidden);
  usePageContentReady(isPageReady);

  // ── Episodes for current season ───────────────────────────────────────────
  const currentSeasonEps = useMemo(() => {
    // While loading, always return empty — prevents previous season's episodes from showing
    if (episodesLoading) return [];

    const target = String(currentSeasonId || id || "").trim();
    const clean = target.replace(/\D/g, "");

    // 1. Try direct match
    const direct = episodes.filter(e => String(e.seasonId) === target);
    if (direct.length) return direct.sort((a, b) => a.episodeNum - b.episodeNum);

    // 2. Season object lookup fallback
    const activeSeason = seasons.find(s =>
      String(s.id) === target ||
      (clean && String(s.id).replace(/\D/g, "") === clean) ||
      (s.idMal && String(s.idMal) === target) ||
      (clean && s.idMal && String(s.idMal).replace(/\D/g, "") === clean)
    );
    if (activeSeason) {
      const byId = episodes.filter(e =>
        String(e.seasonId) === String(activeSeason.id) ||
        (activeSeason.idMal && String(e.seasonId) === String(activeSeason.idMal))
      );
      if (byId.length) return byId.sort((a, b) => a.episodeNum - b.episodeNum);
    }

    // 3. Numeric match fallback only if clean target is active season
    if (clean && activeSeason && String(activeSeason.id).replace(/\D/g, "") === clean) {
      const numeric = episodes.filter(e => String(e.seasonId || "").replace(/\D/g, "") === clean);
      if (numeric.length) return numeric.sort((a, b) => a.episodeNum - b.episodeNum);
    }

    return [];
  }, [episodes, currentSeasonId, id, seasons, episodesLoading]);


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

  // ── Scroll to top and reset progress on id change ────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setHasActiveProgress(false);
    setIsProgressLoaded(false);
    setPlayingSeason(1);
    setPlayingEpisode(1);
    setSelectedEp(null);
  }, [id]);

  useEffect(() => {
    if (typeof document !== "undefined" && displayTitle) {
      document.title = `${displayTitle} - CineStream`;
    }
  }, [displayTitle]);

  useEffect(() => { setDescExpanded(false); }, [currentSeasonId, seasonOverview]);
  useEffect(() => { setEpisodePage(1); setListChunkIndex(0); }, [currentSeasonId]);

  // ── Compute active numeric season number ──────────────────────────────────
  const currentSeasonNumber = useMemo(() => {
    const s = currentSeasonInfo || currentSeason;
    if (!s) return 1;
    if ((s as any).tmdbSeasonNumber && (s as any).tmdbSeasonNumber > 0) {
      return (s as any).tmdbSeasonNumber;
    }
    const sLabel = getSafeAnimeTitle((s as any).seasonLabel);
    const labelMatch = sLabel.match(/season\s*(\d+)/i);
    if (labelMatch) return parseInt(labelMatch[1], 10);
    const sName = getSafeAnimeTitle((s as any).name || (s as any).title);
    const nameMatch = sName.match(/season\s*(\d+)/i);
    if (nameMatch) return parseInt(nameMatch[1], 10);
    const idx = seasons.findIndex(item => String(item.id) === String(currentSeasonId));
    if (idx >= 0) return idx + 1;
    return 1;
  }, [currentSeasonInfo, currentSeason, seasons, currentSeasonId]);

  // ── Anime Progress Matcher ────────────────────────────────────────────────
  const isAnimeMatching = useCallback((targetMediaId: string | number | null | undefined, targetTitle?: string | null) => {
    if (!targetMediaId && !targetTitle) return false;
    const strTargetId = String(targetMediaId || "").trim();
    const cleanTargetId = strTargetId.replace(/\D/g, "");

    const allRelatedIds = new Set<string>([
      String(id || "").trim(),
      String(anime?.id || "").trim(),
      String(initialData?.id || "").trim(),
      String(currentSeasonId || "").trim(),
      String((anime as any)?.tmdbId || "").trim(),
      String((initialData as any)?.tmdbId || "").trim(),
      String(anime?.idMal || "").trim(),
      String(initialData?.idMal || "").trim(),
      ...(anime?.seasons || []).flatMap((s: any) => [String(s.id || "").trim(), String(s.idMal || "").trim(), String(s.tmdbId || "").trim()]),
      ...(initialData?.seasons || []).flatMap((s: any) => [String(s.id || "").trim(), String(s.idMal || "").trim(), String(s.tmdbId || "").trim()]),
      ...(franchiseNodes || []).flatMap((n: any) => [String(n.id || "").trim(), String(n.idMal || "").trim(), String(n.tmdbId || "").trim()]),
    ]);
    allRelatedIds.delete("");

    if (strTargetId && allRelatedIds.has(strTargetId)) return true;
    if (cleanTargetId) {
      for (const rid of allRelatedIds) {
        const cleanRid = rid.replace(/\D/g, "");
        if (cleanRid && cleanRid === cleanTargetId) return true;
      }
    }

    if (targetTitle) {
      const cleanTargetTitle = getSafeAnimeTitle(targetTitle).toLowerCase().trim();
      const candidates = [
        anime?.name,
        (anime as any)?.title,
        anime?.jname,
        initialData?.name,
        (initialData as any)?.title,
        displayTitle,
      ].filter(Boolean).map(t => getSafeAnimeTitle(t).toLowerCase().trim());

      for (const cand of candidates) {
        if (!cand || !cleanTargetTitle) continue;
        if (cand === cleanTargetTitle) return true;
        if (cand.length >= 4 && cleanTargetTitle.length >= 4) {
          if (cand.replace(/[^a-z0-9]/g, "") === cleanTargetTitle.replace(/[^a-z0-9]/g, "")) return true;
          if (cand.includes(cleanTargetTitle) || cleanTargetTitle.includes(cand)) return true;
        }
      }
    }

    return false;
  }, [id, anime, initialData, currentSeasonId, franchiseNodes, displayTitle]);

  // ── Load active progress from URL, active tracker, CW cache & server ──────
  useEffect(() => {
    let initSeason = 1;
    let initEp = 1;
    let hasActive = false;
    let cwCacheFresh = false;

    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSeason = searchParams.get("season");
      const urlEp = searchParams.get("episode");
      const isAutoPlay = searchParams.get("autoplay") === "1";

      if (isAutoPlay || (urlEp && Number(urlEp) > 0)) {
        if (urlEp && Number(urlEp) > 0) initEp = Number(urlEp);
        if (urlSeason && Number(urlSeason) > 0) initSeason = Number(urlSeason);
        hasActive = true;
      } else {
        // 1. Check local active tracker
        try {
          const activeShowRaw = localStorage.getItem("cinestream_active_anime_show");
          if (activeShowRaw) {
            const activeShow = JSON.parse(activeShowRaw);
            if (isAnimeMatching(activeShow?.id || activeShow?.mediaId, activeShow?.title)) {
              if (activeShow?.season && Number(activeShow.season) > 0) initSeason = Number(activeShow.season);
              const epNum = Number(activeShow?.episodeNum || activeShow?.episode || 0);
              if (epNum > 0) {
                initEp = epNum;
                hasActive = true;
              }
            }
          }
        } catch {}

        // 2. Check Continue Watching cache
        if (!hasActive) {
          try {
            const cwRaw = localStorage.getItem("cinestream_cw_cache");
            if (cwRaw) {
              const cw = JSON.parse(cwRaw);
              if (cw?.cachedAt && Date.now() - cw.cachedAt < 5 * 60 * 1000) {
                cwCacheFresh = true;
              }
              const found = (cw.items || []).find(
                (it: any) => it.mediaType === "anime" && isAnimeMatching(it.mediaId, it.title)
              );
              if (found && found.episode && Number(found.episode) > 0) {
                if (found.season && Number(found.season) > 0) initSeason = Number(found.season);
                initEp = Number(found.episode);
                hasActive = true;
              }
            }
          } catch {}
        }
      }
    }

    if (hasActive) {
      setPlayingSeason(initSeason);
      setPlayingEpisode(initEp);
      setHasActiveProgress(true);
    }

    // 3. Query server watch history if authenticated and not found in fresh local cache
    if (status === "authenticated" && (!hasActive || !cwCacheFresh)) {
      fetch("/api/watch-history")
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.items && Array.isArray(data.items)) {
            const found = data.items.find(
              (it: any) => it.mediaType === "anime" && isAnimeMatching(it.mediaId, it.title)
            );
            if (found && found.episode && Number(found.episode) > 0) {
              const sNum = Number(found.season || 1);
              const eNum = Number(found.episode);
              setPlayingSeason(sNum);
              setPlayingEpisode(eNum);
              setHasActiveProgress(true);
            }
          }
        })
        .catch(() => {});
    }

    setIsProgressLoaded(true);
  }, [id, anime?.id, anime?.name, isAnimeMatching, status]);

  // ── Real-time sync on watch history update or tab focus ───────────────────
  useEffect(() => {
    const handleWatchHistoryUpdate = () => {
      try {
        const activeShowRaw = localStorage.getItem("cinestream_active_anime_show");
        if (activeShowRaw) {
          const activeShow = JSON.parse(activeShowRaw);
          if (isAnimeMatching(activeShow?.id || activeShow?.mediaId, activeShow?.title)) {
            const s = Number(activeShow.season || 1);
            const e = Number(activeShow.episodeNum || activeShow.episode || 0);
            if (e > 0) {
              setPlayingSeason(s);
              setPlayingEpisode(e);
              setHasActiveProgress(true);
              return;
            }
          }
        }
        const cwRaw = localStorage.getItem("cinestream_cw_cache");
        if (cwRaw) {
          const cw = JSON.parse(cwRaw);
          const found = (cw.items || []).find(
            (it: any) => it.mediaType === "anime" && isAnimeMatching(it.mediaId, it.title)
          );
          if (found && found.episode && Number(found.episode) > 0) {
            setPlayingSeason(Number(found.season || 1));
            setPlayingEpisode(Number(found.episode));
            setHasActiveProgress(true);
          }
        }
      } catch {}
    };

    window.addEventListener("cinestream_watch_history_updated", handleWatchHistoryUpdate);
    window.addEventListener("focus", handleWatchHistoryUpdate);
    return () => {
      window.removeEventListener("cinestream_watch_history_updated", handleWatchHistoryUpdate);
      window.removeEventListener("focus", handleWatchHistoryUpdate);
    };
  }, [isAnimeMatching]);

  // ── Persist active anime tracker state (matches TvClient.tsx) ────────────
  useEffect(() => {
    if (typeof window !== "undefined" && isProgressLoaded && hasActiveProgress && (anime || id)) {
      try {
        localStorage.setItem("cinestream_active_anime_show", JSON.stringify({
          id: String(anime?.id || id),
          mediaId: anime?.id || id,
          title: anime?.name || displayTitle,
          season: playingSeason,
          episodeNum: playingEpisode,
        }));
      } catch {}
    }
  }, [id, anime, displayTitle, playingSeason, playingEpisode, isProgressLoaded, hasActiveProgress]);

  // ── Synchronize selected episode with active progress in current season ──
  useEffect(() => {
    if (hasActiveProgress && Number(playingSeason) === Number(currentSeasonNumber) && playingEpisode) {
      const ep = dedupedCurrentEps.find(e => Number(e.episodeNum) === Number(playingEpisode));
      if (ep) {
        setSelectedEp(ep);
      } else if (dedupedCurrentEps.length > 0) {
        setSelectedEp({
          episodeId: `${currentSeasonId}-${playingEpisode}`,
          episodeNum: playingEpisode,
          title: `Episode ${playingEpisode}`,
          isReleased: true,
          seasonId: String(currentSeasonId),
          seasonNum: currentSeasonNumber,
        });
      }
    }
  }, [hasActiveProgress, playingSeason, currentSeasonNumber, playingEpisode, dedupedCurrentEps, currentSeasonId]);

  // ── Synchronize chunk bar and grid pagination to active episode ──────────
  useEffect(() => {
    if (hasActiveProgress && Number(playingSeason) === Number(currentSeasonNumber) && playingEpisode) {
      const gridSize = dedupedCurrentEps.length > 500 ? 50 : 25;
      const targetPage = Math.floor((playingEpisode - 1) / gridSize) + 1;
      setEpisodePage(targetPage);
      setListChunkIndex(Math.floor((playingEpisode - 1) / 10));
    } else if (selectedEp) {
      const gridSize = dedupedCurrentEps.length > 500 ? 50 : 25;
      setEpisodePage(Math.floor((selectedEp.episodeNum - 1) / gridSize) + 1);
      setListChunkIndex(Math.floor((selectedEp.episodeNum - 1) / 10));
    } else {
      setEpisodePage(1);
      setListChunkIndex(0);
    }
  }, [hasActiveProgress, playingSeason, currentSeasonNumber, playingEpisode, selectedEp, dedupedCurrentEps.length]);

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
          const hasRealData = p?.episodes?.some((e: any) => !e.isPlaceholder && (e.title !== `Episode ${e.episodeNum}` || e.thumbnail));
          if (p?.episodes?.length && p._cachedAt && hasRealData) {
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
      const matchingSeason = anime?.seasons?.find(s => String(s.id) === String(seasonId)) || (initialData?.seasons || []).find((s: any) => String(s.id) === String(seasonId)) || franchiseNodes?.find(n => String(n.id) === String(seasonId));
      const sName = getSafeAnimeTitle((matchingSeason as any)?.name || (matchingSeason as any)?.title || anime?.name || "");
      const sTot = (matchingSeason as any)?.totalEpisodes || (matchingSeason as any)?.episodes || anime?.totalEpisodes || 0;
      const effectiveTmdbId = tmdbId ?? (matchingSeason as any)?.tmdbId ?? anime?.tmdbId ?? null;
      const effectiveTmdbSeason = tmdbSeason ?? (matchingSeason as any)?.tmdbSeasonNumber ?? null;
      const effectiveOffset = episodeOffset ?? (matchingSeason as any)?.episodeOffset ?? 0;
      const tmdbQ = effectiveTmdbId != null ? `&tmdbId=${effectiveTmdbId}` : "";
      const tsQ = effectiveTmdbSeason != null ? `&tmdbSeason=${effectiveTmdbSeason}` : "";
      const offQ = effectiveOffset != null ? `&episodeOffset=${effectiveOffset}` : "";
      const nameQ = sName ? `&seasonName=${encodeURIComponent(sName)}` : "";
      const totQ = sTot > 0 ? `&totalEpisodes=${sTot}` : "";
      const data = await fetchJson<{ success: boolean; data: { episodes: Episode[]; seasonOverview?: string | null; isUpcoming?: boolean; isUnavailable?: boolean } }>(
        `/api/anime/${id}/episodes?seasonId=${encodeURIComponent(seasonId)}${tmdbQ}${tsQ}${offQ}${nameQ}${totQ}&v=${ANIME_API_VERSION}`,
        { signal: AbortSignal.timeout(8000) }
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
            if (!seen.has(ep.episodeNum)) { seen.add(ep.episodeNum); deduped.push({ ...ep, seasonId: String(seasonId) }); }
          }
          return [...other, ...deduped].sort((a, b) => {
            if ((a.seasonNum || 1) !== (b.seasonNum || 1)) return (a.seasonNum || 1) - (b.seasonNum || 1);
            return a.episodeNum - b.episodeNum;
          });
        });
        setSeasonOverview(data.data.seasonOverview || null);
        loadedSeasonIds.current.add(seasonId);
        setEpisodesLoading(false);
        const hasRealData = sorted.some(ep => !ep.isPlaceholder && (ep.title !== `Episode ${ep.episodeNum}` || ep.thumbnail));
        if (hasRealData) {
          safeSessionSet(EP_KEY, JSON.stringify({ episodes: sorted.map(ep => ({ ...ep, seasonId: String(seasonId) })), seasonOverview: data.data.seasonOverview || null, status: animeStatusRef.current || "", _cachedAt: Date.now() }));
        }
        return;
      }
    } catch (err) {
      console.warn(`[AnimeClient] Episode API failed for ${seasonId}:`, err);
    }

    // Try browser-direct AniZip mappings before synthetic fallback
    try {
      const cleanSeasonNum = String(seasonId).replace(/\D/g, "");
      if (cleanSeasonNum) {
        const isKitsuSeason = String(seasonId).startsWith("kitsu");
        const azUrl = `https://api.ani.zip/mappings?${isKitsuSeason ? "kitsu_id=" : "anilist_id="}${cleanSeasonNum}`;
        const azRes = await fetch(azUrl, { signal: AbortSignal.timeout(4000) });
        if (azRes.ok) {
          const azJson = await azRes.json();
          if (azJson?.episodes && Object.keys(azJson.episodes).length > 0) {
            const azEpisodes: Episode[] = Object.entries(azJson.episodes)
              .map(([numStr, ep]: [string, any]) => {
                const n = parseInt(numStr, 10);
                return {
                  episodeId: `${seasonId}-${n}`,
                  episodeNum: n,
                  title: ep.title?.en || ep.title?.["x-jat"] || ep.title?.ja || `Episode ${n}`,
                  thumbnail: ep.image || null,
                  description: ep.overview || ep.summary || null,
                  releasedDate: ep.airdate || null,
                  isFiller: Boolean(ep.is_filler),
                  isReleased: true,
                  seasonId: String(seasonId),
                  seasonNum: 1,
                };
              })
              .filter(e => !isNaN(e.episodeNum))
              .sort((a, b) => a.episodeNum - b.episodeNum);

            if (azEpisodes.length > 0) {
              setEpisodes(prev => {
                const other = prev.filter(e => String(e.seasonId) !== String(seasonId));
                return [...other, ...azEpisodes];
              });
              loadedSeasonIds.current.add(seasonId);
              setEpisodesLoading(false);
              return;
            }
          }
        }
      }
    } catch {}

    // Fallback: generate placeholder episodes
    const matchSeason = anime?.seasons?.find(s => String(s.id) === String(seasonId)) || (franchiseNodes || []).find(n => String(n.id) === String(seasonId));
    const isMov = ((matchSeason as any)?.seasonLabel || "").startsWith("Movie") || (matchSeason as any)?.format === "MOVIE" || anime?.format === "MOVIE";
    const count = isMov ? 1 : Math.max((matchSeason as any)?.totalEpisodes || (matchSeason as any)?.episodes || 1, 1);
    const fallback: Episode[] = Array.from({ length: count }, (_, i) => ({
      episodeId: `${seasonId}-${i + 1}`,
      episodeNum: i + 1,
      title: isMov ? getSafeAnimeTitle((matchSeason as any)?.name || (matchSeason as any)?.title || anime?.name || "Complete Movie") : `Episode ${i + 1}`,
      description: isMov ? getSafeAnimeDescription(anime?.description) : undefined,
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
  }, [id, anime, franchiseNodes, initialData]);

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
      animeStatusRef.current = initialData.status || null;
      const cachedNodes = FRANCHISE_CACHE.get(String(id));
      const effectiveNodes = (initialData.franchiseNodes && initialData.franchiseNodes.length > 1)
        ? initialData.franchiseNodes
        : (cachedNodes && cachedNodes.length > 1 ? cachedNodes : []);
      if (effectiveNodes.length > 1) {
        setFranchiseNodes(effectiveNodes);
        for (const n of effectiveNodes) {
          FRANCHISE_CACHE.set(String(n.id), effectiveNodes);
          if ((n as any).idMal) FRANCHISE_CACHE.set(String((n as any).idMal), effectiveNodes);
        }
      }
      const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      let urlSeasonNum = Number(urlParams.get("season") || "");
      let seasonIdParam = urlParams.get("seasonId");

      if (!seasonIdParam && urlSeasonNum <= 0 && typeof window !== "undefined") {
        try {
          const act = localStorage.getItem("cinestream_active_anime_show");
          if (act) {
            const p = JSON.parse(act);
            if (p?.season && Number(p.season) > 1 && isAnimeMatching(p?.id || p?.mediaId, p?.title)) {
              urlSeasonNum = Number(p.season);
            }
          }
          if (urlSeasonNum <= 0) {
            const cw = localStorage.getItem("cinestream_cw_cache");
            if (cw) {
              const p = JSON.parse(cw);
              const found = (p?.items || []).find((it: any) => it.mediaType === "anime" && isAnimeMatching(it.mediaId, it.title));
              if (found?.season && Number(found.season) > 1) {
                urlSeasonNum = Number(found.season);
              }
            }
          }
        } catch {}
      }

      if (!seasonIdParam && urlSeasonNum > 0) {
        const byNum = (initialData.seasons || []).find((s: SeasonInfo) => {
          const sNum = s.tmdbSeasonNumber || (s.seasonLabel?.match(/season\s*(\d+)/i) ? parseInt(RegExp.$1, 10) : null);
          return sNum === urlSeasonNum;
        });
        if (byNum) seasonIdParam = byNum.id;
      }
      const effectiveSeasonId = seasonIdParam || initialData.openedSeasonId || initialData.seasons?.find((s: SeasonInfo) => s.isCurrent)?.id || initialData.id || id;
      setCurrentSeasonId(effectiveSeasonId);
      const matchSeason = (initialData.seasons || []).find((s: SeasonInfo) => String(s.id) === String(effectiveSeasonId)) || initialData.seasons?.find((s: SeasonInfo) => s.isCurrent) || initialData.seasons?.[0];
      loadSeasonEpisodes(matchSeason?.id || effectiveSeasonId, true, matchSeason?.tmdbId, matchSeason?.tmdbSeasonNumber, matchSeason?.episodeOffset);
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
    const abortController = new AbortController();

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
            { signal: abortController.signal }
          );
          if (metaData?.success && metaData?.data?.anime) {
            safeSessionSet(META_KEY, JSON.stringify({ ...metaData, _cachedAt: Date.now() }));
          }
        } catch {
          // Try direct anime API as fallback
          try {
            const direct = await fetchJson<{ success: boolean; data: AnimeDetail }>(`/api/anime/${id}`, { signal: abortController.signal });
            if (direct?.success && direct.data) metaData = { success: true, data: { anime: direct.data } };
          } catch {}
        }
      }

      // 2.5) Direct residential browser fallback when server edge APIs fail or are blocked
      if (!metaData?.success || !metaData?.data?.anime) {
        try {
          const directFallback = await clientFetchAnimeFallback(id, abortController.signal);
          if (directFallback?.anime) {
            metaData = {
              success: true,
              data: {
                anime: directFallback.anime,
                franchiseNodes: directFallback.franchiseNodes,
                tmdbSeasonMap: directFallback.tmdbSeasonMap,
              },
            };
            safeSessionSet(META_KEY, JSON.stringify({ ...metaData, _cachedAt: Date.now() }));
            safeSessionSet(`cs_anime_seed_${id}`, JSON.stringify(directFallback.anime));
          }
        } catch (e) {
          console.warn("[AnimeClient] Direct client fallback failed:", e);
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
      let effectiveSeasonNum = urlSeasonNum;
      if (!urlSeasonId && effectiveSeasonNum <= 0 && typeof window !== "undefined") {
        try {
          const act = localStorage.getItem("cinestream_active_anime_show");
          if (act) {
            const p = JSON.parse(act);
            if (p?.season && Number(p.season) > 1 && isAnimeMatching(p?.id || p?.mediaId, p?.title)) {
              effectiveSeasonNum = Number(p.season);
            }
          }
          if (effectiveSeasonNum <= 0) {
            const cw = localStorage.getItem("cinestream_cw_cache");
            if (cw) {
              const p = JSON.parse(cw);
              const found = (p?.items || []).find((it: any) => it.mediaType === "anime" && isAnimeMatching(it.mediaId, it.title));
              if (found?.season && Number(found.season) > 1) {
                effectiveSeasonNum = Number(found.season);
              }
            }
          }
        } catch {}
      }

      if (urlSeasonId) {
        const found = availableSeasons.find((s: SeasonInfo) => String(s.id) === String(urlSeasonId));
        if (found) targetSeasonId = found.id;
        else targetSeasonId = urlSeasonId;
      } else if (effectiveSeasonNum > 0) {
        const entry = Object.entries(tmdbSeasonMap).find(([, num]) => num === effectiveSeasonNum);
        if (entry) {
          const found = availableSeasons.find((s: SeasonInfo) => String(s.id) === String(entry[0]));
          if (found) targetSeasonId = found.id;
        } else {
          const byLabel = availableSeasons.find((s: SeasonInfo) => {
            const sNum = s.tmdbSeasonNumber || (s.seasonLabel?.match(/season\s*(\d+)/i) ? parseInt(RegExp.$1, 10) : null);
            return sNum === effectiveSeasonNum;
          });
          if (byLabel) targetSeasonId = byLabel.id;
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

    return () => {
      cancelled = true;
      abortController.abort();
    };
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
    const excludeIds = new Set([String(id), String(anime.id || ""), ...(franchiseNodes || []).map(n => String(n.id))]);
    const genres = Array.isArray(anime.genres) ? anime.genres : [];
    const title = getSafeAnimeTitle(anime.name || (anime as any)?.title || "");

    const safeSourceGenres = genres
      .filter(Boolean)
      .map((g: any) => (typeof g === "string" ? g.charCodeAt(0) : Number(g?.id || g) || 0));

    const getSafeTargetGenres = (targetG: any) =>
      (Array.isArray(targetG) ? targetG : [])
        .filter(Boolean)
        .map((g: any) => (typeof g === "string" ? g.charCodeAt(0) : Number(g?.id || g) || 0));

    const RECS_KEY = `cs_recs_v3_${targetId}`;
    try {
      const cached = sessionStorage.getItem(RECS_KEY);
      if (cached) {
        const p = JSON.parse(cached);
        if (Array.isArray(p) && p.length > 0) {
          const withReasons = p.map((item: any) => ({
            ...item,
            reason: getRecommendationReason(safeSourceGenres, getSafeTargetGenres(item.genres)),
          }));
          setRecommendations(withReasons);
          setRecsLoading(false);
          return;
        }
      }
    } catch {}

    const t = setTimeout(async () => {
      try {
        const excludeParam = [...excludeIds].filter(Boolean).join(",");
        const genresParam = genres
          .filter(Boolean)
          .map(g => (typeof g === "string" ? g : (g as any)?.name || ""))
          .filter(Boolean)
          .join(",");
        const res = await fetch(`/api/anime/recommendations/${encodeURIComponent(targetId)}?title=${encodeURIComponent(title)}&genres=${encodeURIComponent(genresParam)}&format=${encodeURIComponent(displayFormat || "")}&excludeIds=${encodeURIComponent(excludeParam)}`);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          const items = data?.items || [];
          if (items.length > 0) {
            const withReasons = items.map((item: any) => ({
              ...item,
              reason: getRecommendationReason(safeSourceGenres, getSafeTargetGenres(item.genres)),
            }));
            setRecommendations(withReasons);
            safeSessionSet(RECS_KEY, JSON.stringify(items));
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
      const sNum = season.tmdbSeasonNumber || (season.seasonLabel?.match(/season\s*(\d+)/i) ? parseInt(RegExp.$1, 10) : null);
      if (sNum && sNum > 1) {
        url.searchParams.set("season", String(sNum));
      } else {
        url.searchParams.delete("season");
      }
      url.searchParams.delete("episode");
      window.history.replaceState({}, "", url.toString());
    }
  }, [currentSeasonId, loadSeasonEpisodes]);

  const handleWatchEpisode = useCallback((ep: Episode) => {
    if (ep.isReleased === false) { setEpisodeNotice(`Episode ${ep.episodeNum} hasn't been released yet.`); return; }
    setEpisodeNotice(null);
    setPlayingSeason(currentSeasonNumber);
    setPlayingEpisode(ep.episodeNum);
    setHasActiveProgress(true);
    setSelectedEp(ep);
    try {
      localStorage.setItem("cinestream_active_anime_show", JSON.stringify({
        id: String(anime?.id || id),
        mediaId: anime?.id || id,
        title: anime?.name || displayTitle,
        season: currentSeasonNumber,
        episodeNum: ep.episodeNum,
      }));
    } catch {}
    const target = ep.seasonId || currentSeasonId || anime?.id || id;
    const seasonQuery = currentSeasonNumber > 1 ? `?season=${currentSeasonNumber}` : "";
    try {
      if (anime) {
        sessionStorage.setItem(`cinestream_anime_${target}`, JSON.stringify({
          ...anime,
          seasonNumber: currentSeasonNumber,
        }));
      }
    } catch {}
    router.push(`/watch/anime/${target}/${ep.episodeNum}${seasonQuery}`);
  }, [anime, currentSeasonId, currentSeasonNumber, displayTitle, id, router]);

  const handleViewChange = useCallback((view: EpisodeViewMode) => setEpisodeView(view), []);

  // ── Episode list conversion ───────────────────────────────────────────────
  const episodeToItem = useCallback((ep: Episode): EpisodeItem => {
    const unreleased = ep.isReleased === false;
    const backdropFallback = (anime as any)?.bannerImage || initialData?.bannerImage || displayPoster || null;
    const thumbSrc = unreleased ? (ep.thumbnail || null) : (ep.thumbnail || (isSingleItem && displayPoster) || backdropFallback);
    const isWatching = Boolean(
      hasActiveProgress &&
      (Number(playingSeason) === Number(currentSeasonNumber) || !playingSeason) &&
      Number(playingEpisode) === Number(ep.episodeNum)
    );
    const isSelected = isWatching || (Boolean(selectedEp) && (selectedEp?.episodeId === ep.episodeId || Number(selectedEp?.episodeNum) === Number(ep.episodeNum)) && Number(playingSeason) === Number(currentSeasonNumber));
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
  }, [anime, currentSeasonId, currentSeasonNumber, displayPoster, displayTitle, handleWatchEpisode, hasActiveProgress, isPlaying, isSingleItem, playingEpisode, playingSeason, selectedEp]);

  const episodeItems = useMemo(() => dedupedCurrentEps.map(episodeToItem), [dedupedCurrentEps, episodeToItem]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const { theme } = useTheme();
  const pageBgClass = useMemo(() => {
    const map: Record<string, string> = { global: "bg-[#07080d]", glass: "bg-transparent", oled: "bg-[#000000]", cinema: "bg-[#140509]", wisteria: "bg-[#0e071c]", solaris: "bg-[#100b05]" };
    return map[theme] || "bg-[#07080d]";
  }, [theme]);

  const animeScore = (() => {
    const r = parseFloat(String(anime?.rating || (anime as any)?.score || "0"));
    return !isNaN(r) && r > 0 ? (r > 10 ? r / 10 : r) : 0;
  })();
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

      <AnimeContentErrorBoundary>
        <main className="relative z-10 w-full pt-0 bleed-header select-none">
          {!isPageReady ? (
            <div className="min-h-screen w-full flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#7288AE] animate-spin" />
            </div>
          ) : (error || !anime || (anime as any)?.isHidden) ? (
            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-16">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl max-w-lg mx-auto space-y-3">
                <div className="text-xl font-bold text-white mb-2">Title Unavailable</div>
                <div className="text-sm text-white/50 mb-4">{error || "This anime is currently not available to view. Please check back later or explore other anime."}</div>
                <Link href="/anime" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4B5694] hover:bg-[#5a67ad] text-white rounded-xl text-sm font-bold transition-all">
                  <ArrowLeft className="w-4 h-4" /> Back to Anime
                </Link>
              </div>
            </div>
          ) : (
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
                            {displayTitle && anime?.name && displayTitle.toLowerCase() !== getSafeAnimeTitle(anime.name).toLowerCase() ? (
                              <div className="mt-2 text-sm sm:text-base font-black text-white/90 tracking-wide drop-shadow-md">
                                {displayTitle}
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
                        {(Array.isArray(anime.genres) ? anime.genres : []).slice(0, 5).map((g: any, i: number) => {
                          const label = typeof g === "string" ? g : (g?.name || "");
                          if (!label) return null;
                          return (
                            <span key={typeof g === "string" ? g : (g?.id || i)} className="px-3.5 py-1 bg-fuchsia-500/15 border border-fuchsia-400/30 rounded-full text-xs sm:text-sm font-extrabold text-fuchsia-200 shadow-sm">{label}</span>
                          );
                        })}
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
                          <WatchlistButton mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0} mediaType="anime" title={displayTitle || getSafeAnimeTitle(anime.name)} posterPath={anime.poster || null} />
                          <TrailerButton />
                        </div>
                      ) : (anime as any)?.isUnavailable || (anime as any)?.status === "unavailable" || (currentSeasonInfo as any)?.isUnavailable ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-300 text-xs sm:text-sm font-semibold shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                            <span>This title is currently unavailable on this site. Please check back later.</span>
                          </div>
                          <WatchlistButton mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0} mediaType="anime" title={displayTitle || getSafeAnimeTitle(anime.name)} posterPath={anime.poster || null} />
                          <TrailerButton />
                        </div>
                      ) : dedupedCurrentEps.length > 0 ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <button
                            onClick={() => {
                              const activeEp = (hasActiveProgress && Number(playingSeason) === Number(currentSeasonNumber)
                                ? dedupedCurrentEps.find(e => Number(e.episodeNum) === Number(playingEpisode))
                                : null) || selectedEp;
                              const target = activeEp || dedupedCurrentEps.find(ep => ep.isReleased !== false) || dedupedCurrentEps[0];
                              if (target) handleWatchEpisode(target);
                            }}
                            className="group flex items-center gap-2 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-xl shadow-black/30"
                          >
                            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current group-hover:scale-110 transition-transform" />
                            {isMovieFormat
                              ? `Watch ${dedupedCurrentEps.length > 1 ? `Movie ${dedupedCurrentEps[0]?.episodeNum || 1}` : "Movie"}`
                              : hasActiveProgress && playingEpisode
                              ? `Watch Ep ${playingEpisode}`
                              : `Watch Ep ${selectedEp?.episodeNum || dedupedCurrentEps[0]?.episodeNum || 1}`}
                          </button>
                          <WatchlistButton mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0} mediaType="anime" title={displayTitle || getSafeAnimeTitle(anime.name)} posterPath={anime.poster || null} />
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
                    <h2 className="text-xl sm:text-2xl font-black text-white">{displayTitle || getSafeAnimeTitle(anime.name)}</h2>
                    {isMovieFormat && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Movie</span>}
                    {((anime as any)?.isUpcoming || anime.status === "upcoming") && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Upcoming</span>}
                    {((anime as any)?.isUnavailable || anime.status === "unavailable") && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-700/40 text-zinc-300 border border-zinc-600/40">Unavailable</span>}
                  </div>
                  {anime.jname && anime.jname !== getSafeAnimeTitle(anime.name) && <p className="text-xs text-white/40 mt-0.5">{anime.jname}</p>}
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
                  animeTitle={displayTitle || getSafeAnimeTitle(anime.name)}
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
                      {episodeItems.length > CHUNK && <div className="flex justify-end mt-2 mb-6"><EpisodeChunkBar totalEpisodes={episodeItems.length} chunkSize={CHUNK} activeChunkIndex={activeChunk} onChunkChange={onChunkChange} activeEpisodeNumber={hasActiveProgress && Number(playingSeason) === Number(currentSeasonNumber) ? playingEpisode : selectedEp?.episodeNum} /></div>}
                      <EpisodeListView items={slicedChunk} />
                      {episodeItems.length > CHUNK && <div className="flex justify-end mt-8 pt-4 border-t border-white/[0.06]"><EpisodeChunkBar totalEpisodes={episodeItems.length} chunkSize={CHUNK} activeChunkIndex={activeChunk} onChunkChange={onChunkChange} activeEpisodeNumber={hasActiveProgress && Number(playingSeason) === Number(currentSeasonNumber) ? playingEpisode : selectedEp?.episodeNum} /></div>}
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
        )}
      </main>
      </AnimeContentErrorBoundary>
    </div>
  );
}
