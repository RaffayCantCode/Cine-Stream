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
import { cleanAnimeDescription } from "@/lib/anime-fetch";
import { useTheme } from "@/context/ThemeContext";
import { getCuratedAnimeFranchiseNodes } from "@/lib/franchises";
import { isEpisodeAvailable, isEpisodeUpcoming, isWithinUpcomingDays } from "@/lib/episode-availability";
import { Star, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Play, Film, Route, Sparkles, Tv, Compass } from "lucide-react";

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

interface FranchiseNode {
  id: number;
  idMal: number | null;
  title: string;
  episodes: number | null;
  totalEpisodes?: number | null;
  season: string | null;
  seasonYear: number | null;
  status?: string | null;
  format: string | null;
  duration?: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number;
}

const ANIME_API_VERSION = "v52-clean-architecture";
const ANILIST_API = "https://graphql.anilist.co";
const clientAnilistCache = new Map<string, { data: any; timestamp: number }>();

async function anilistQuery(query: string, variables: Record<string, any>): Promise<any> {
  const cacheKey = `al_${query.length}_${JSON.stringify(variables)}`;
  const cached = clientAnilistCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return cached.data;
  }

  if (typeof window !== "undefined") {
    try {
      const sCached = sessionStorage.getItem(cacheKey);
      if (sCached) {
        const parsed = JSON.parse(sCached);
        if (parsed) {
          clientAnilistCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
          return parsed;
        }
      }
    } catch {}
  }

  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(6000),
  });
  if (res.status === 429) {
    throw new Error("AniList rate limited");
  }
  if (!res.ok) throw new Error("AniList query failed");
  const json = await res.json();
  if (json?.data) {
    clientAnilistCache.set(cacheKey, { data: json, timestamp: Date.now() });
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(json));
      } catch {}
    }
  }
  return json;
}

function transformRecItem(media: any): any {
  if (media.isAdult) return null;
  return {
    id: String(media.id),
    idMal: media.idMal ? String(media.idMal) : null,
    name: media.title?.english || media.title?.romaji || "Unknown",
    jname: media.title?.native || null,
    poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
    type: media.type || "ANIME",
    episodes: { sub: media.episodes || null, dub: null },
    rating: media.averageScore ? String((media.averageScore / 10).toFixed(1)) : null,
    description: cleanAnimeDescription(media.description),
    genres: media.genres || [],
    status: media.status || null,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    format: media.format || null,
  };
}

function cleanBaseTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[:\-\–\—].*$/, "")
    .replace(/\b(season|part|cour|movie|film|ova|special|tv)\b.*$/i, "")
    .trim();
}

function balanceRecommendations(
  items: any[],
  currentTitle: string,
  currentId: string,
  excludeIds: Set<string>,
  maxFranchiseItems = 4,
  targetTotal = 12
): any[] {
  const baseTitle = cleanBaseTitle(currentTitle);
  const normalizedCurrent = (currentTitle || "").toLowerCase().trim();
  const seen = new Set<string>([String(currentId)]);
  excludeIds.forEach(id => seen.add(String(id)));

  const sameFranchise: any[] = [];
  const differentAnime: any[] = [];

  for (const item of items) {
    const sId = String(item.id);
    if (seen.has(sId)) continue;
    seen.add(sId);

    const title = item.name || item.title || "";
    const itemBase = cleanBaseTitle(title);
    const itemNormalized = title.toLowerCase().trim();

    if (normalizedCurrent && itemNormalized === normalizedCurrent) continue;

    const isFranchise =
      baseTitle.length >= 3 &&
      (itemBase.includes(baseTitle) || baseTitle.includes(itemBase) || itemNormalized.startsWith(baseTitle));

    if (isFranchise) {
      sameFranchise.push(item);
    } else {
      differentAnime.push(item);
    }
  }

  const franchiseSlice = sameFranchise.slice(0, maxFranchiseItems);
  const differentCount = Math.max(targetTotal - franchiseSlice.length, 6);
  const differentSlice = differentAnime.slice(0, differentCount);

  const result = [...franchiseSlice, ...differentSlice];
  if (result.length < targetTotal) {
    const remainingDiff = differentAnime.slice(differentCount);
    result.push(...remainingDiff.slice(0, targetTotal - result.length));
  }
  if (result.length < targetTotal) {
    const remainingFranchise = sameFranchise.slice(maxFranchiseItems);
    result.push(...remainingFranchise.slice(0, targetTotal - result.length));
  }

  return result.slice(0, targetTotal);
}

async function fetchAnilistRecommendations(
  anilistId: number,
  animeTitle: string,
  excludeIds: Set<string>,
  minItems = 12,
  animeGenres: string[] = []
): Promise<any[]> {
  const RECS_SESSION_KEY = `cs_recs_${anilistId}`;
  if (typeof window !== "undefined") {
    try {
      const cached = sessionStorage.getItem(RECS_SESSION_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return balanceRecommendations(parsed, animeTitle, String(anilistId), excludeIds, 4, Math.max(minItems, 12));
        }
      }
    } catch {}
  }

  let items: any[] = [];

  try {
    const data = await anilistQuery(`
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          recommendations(page: 1, perPage: 25, sort: [RATING_DESC]) {
            nodes {
              mediaRecommendation {
                id idMal isAdult title { romaji english native }
                coverImage { large extraLarge }
                episodes genres averageScore description status type format season seasonYear
              }
            }
          }
        }
      }
    `, { id: anilistId });

    const nodes = data?.data?.Media?.recommendations?.nodes || [];
    items = nodes
      .map((n: any) => n?.mediaRecommendation)
      .filter(Boolean)
      .map(transformRecItem)
      .filter(Boolean)
      .filter((item: any) => !excludeIds.has(item.id) && item.id !== String(anilistId));
  } catch {}

  if (items.length < 24 && animeGenres.length > 0) {
    try {
      const existingIds = new Set(items.map((i: any) => i.id));
      const seenGenres = new Set<string>();
      items.forEach((i: any) => i.genres?.forEach((g: string) => seenGenres.add(g)));
      if (seenGenres.size === 0 && animeGenres.length > 0) {
        animeGenres.forEach((g: string) => seenGenres.add(g));
      }
      const genreList = [...seenGenres].slice(0, 3);
      if (genreList.length > 0) {
        const padData = await anilistQuery(`
          query ($genres: [String], $page: Int) {
            Page(page: $page, perPage: 25) {
              media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre_in: $genres) {
                id idMal isAdult title { romaji english native }
                coverImage { large extraLarge }
                episodes genres averageScore description status type format season seasonYear
              }
            }
          }
        `, { genres: genreList, page: 1 });

        const padItems = (padData?.data?.Page?.media || [])
          .map(transformRecItem)
          .filter(Boolean)
          .filter((item: any) => !existingIds.has(item.id) && !excludeIds.has(item.id) && item.id !== String(anilistId));
        items = [...items, ...padItems];
      }
    } catch {}
  }

  // Fallback: query Kitsu category popular anime if still under 12
  if (items.length < 12) {
    try {
      const existingIds = new Set(items.map((i: any) => i.id));
      const genre = animeGenres[0] || "";
      const kRes = await fetch(
        `https://kitsu.io/api/edge/anime?${genre ? `filter[categories]=${encodeURIComponent(genre.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}&` : ""}sort=-userCount&page[limit]=20&include=categories`,
        { headers: { "Accept": "application/vnd.api+json" }, signal: AbortSignal.timeout(4000) }
      );
      if (kRes.ok) {
        const kData = await kRes.json();
        const categoriesMap = new Map<string, string>();
        for (const inc of kData.included || []) {
          if (inc.type === "categories" && inc.attributes?.title) {
            categoriesMap.set(inc.id, inc.attributes.title);
          }
        }
        for (const kItem of kData.data || []) {
          const catIds = kItem.relationships?.categories?.data?.map((c: any) => c.id) || [];
          const kGenres = catIds.map((cid: string) => categoriesMap.get(cid)).filter(Boolean);
          const kId = "kitsu-" + kItem.id;
          if (!existingIds.has(kId) && !excludeIds.has(kId) && kItem.id !== String(anilistId)) {
            const attr = kItem.attributes || {};
            const titleEnglish = attr.titles?.en || null;
            const titleRomaji = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
            items.push({
              id: kId,
              idMal: null,
              name: titleEnglish || titleRomaji,
              jname: attr.titles?.ja_jp || null,
              poster: attr.posterImage?.large || attr.posterImage?.original || "",
              type: (attr.subtype || "TV").toUpperCase(),
              episodes: { sub: attr.episodeCount || null, dub: null },
              rating: attr.averageRating ? String((parseFloat(attr.averageRating) / 10).toFixed(1)) : null,
              description: cleanAnimeDescription(attr.synopsis || attr.description),
              genres: kGenres.length > 0 ? kGenres : [],
              status: attr.status === "current" ? "RELEASING" : (attr.status === "upcoming" ? "NOT_YET_RELEASED" : "FINISHED"),
              season: null,
              seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : null,
              format: (attr.subtype || "TV").toUpperCase(),
            });
            existingIds.add(kId);
          }
        }
      }
    } catch {}
  }

  if (typeof window !== "undefined" && items.length > 0) {
    try {
      sessionStorage.setItem(RECS_SESSION_KEY, JSON.stringify(items));
    } catch {}
  }

  return balanceRecommendations(items, animeTitle, String(anilistId), excludeIds, 4, Math.max(minItems, 12));
}

function formatAnimeStatus(statusRaw?: string | null, eps?: Episode[]): { label: string; style: "finished" | "airing" | "upcoming" } {
  if (!statusRaw) return { label: "FINISHED", style: "finished" };
  const s = statusRaw.toUpperCase().replace(/_/g, " ").trim();

  if (s.includes("FINISHED") || s.includes("COMPLETED")) {
    return { label: "FINISHED", style: "finished" };
  }
  if (s.includes("RELEASING") || s.includes("CURRENTLY AIRING") || s === "AIRING") {
    return { label: "CURRENTLY AIRING", style: "airing" };
  }
  if (eps && eps.length > 0) {
    const ep1 = eps.find(e => e.episodeNum === 1) || eps[0];
    if (ep1?.releasedDate) {
      const epMs = new Date(ep1.releasedDate).getTime();
      if (!isNaN(epMs) && epMs <= Date.now()) {
        return { label: "CURRENTLY AIRING", style: "airing" };
      }
    }
  }
  if (s.includes("NOT YET") || s.includes("UPCOMING") || s.includes("UNRELEASED") || s.includes("CANCELLED")) {
    return { label: "NOT YET AIRED", style: "upcoming" };
  }
  return { label: statusRaw, style: "finished" };
}

function mapNodesToSeasons(clientNodes: FranchiseNode[], currentId: number): SeasonInfo[] {
  const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const sorted = [...clientNodes].sort((a, b) => {
    const yearA = a.seasonYear || 9999;
    const yearB = b.seasonYear || 9999;
    if (yearA !== yearB) return yearA - yearB;
    const formatOrder = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };
    const fA = (formatOrder as any)[a.format || "TV"] ?? 6;
    const fB = (formatOrder as any)[b.format || "TV"] ?? 6;
    if (fA !== fB) return fA - fB;
    const sA = seasonOrder.indexOf(a.season || "FALL");
    const sB = seasonOrder.indexOf(b.season || "FALL");
    return sA - sB;
  });

  let tvCount = 0;
  let movieCount = 0;
  let ovaCount = 0;
  let specialCount = 0;

  return sorted.map((node) => {
    const isMovie = node.format === "MOVIE";
    const isSpecial = node.format === "SPECIAL";
    const isOva = node.format === "OVA";
    let label: string = (node as any).seasonLabel || "";
    if (!label) {
      if (isMovie) { movieCount++; label = `Movie ${movieCount}`; }
      else if (isOva) { ovaCount++; label = `OVA ${ovaCount}`; }
      else if (isSpecial) { specialCount++; label = `Special ${specialCount}`; }
      else {
        const titleLower = node.title.toLowerCase();
        const partMatch = titleLower.match(/(?:part|cour)\s*(\d+)/i);
        if (partMatch && tvCount > 0) {
          label = `Season ${tvCount} Part ${partMatch[1]}`;
        } else {
          tvCount++;
          label = `Season ${tvCount}`;
        }
      }
    }

    let nodeStatus: string = (node as any).status || "";
    if (!nodeStatus) {
      if ((node as any).nextAiringEpisode) {
        nodeStatus = "RELEASING";
      } else if (node.seasonYear && node.seasonYear > new Date().getFullYear()) {
        nodeStatus = "NOT_YET_RELEASED";
      } else {
        nodeStatus = "FINISHED";
      }
    }

    return {
      id: String(node.id),
      idMal: node.idMal || null,
      name: node.title,
      totalEpisodes: isMovie ? 1 : (node.episodes || 0),
      seasonLabel: label,
      episodeOffset: node.episodeOffset || (node as any).episodeOffset || 0,
      isCurrent: String(node.id) === String(currentId),
      seasonYear: node.seasonYear || null,
      status: nodeStatus,
      tmdbId: node.tmdbId || (node as any).tmdbId || null,
      tmdbSeasonNumber: node.tmdbSeasonNumber || (node as any).tmdbSeasonNumber || null,
    } as any;
  });
}

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
  trailerId?: string | null;
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number } | null;
  backdrop?: string | null;
  bannerImage?: string | null;
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

const FRANCHISE_MEMORY_CACHE = new Map<string, any[]>();

export default function AnimeClient({ initialData }: { initialData?: any | null } = {}) {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { data: session, status: authStatus } = useSession();

  const [anime, setAnime] = useState<AnimeDetail | null>(() => {
    if (initialData && initialData.id) return initialData as AnimeDetail;
    if (typeof window !== "undefined") {
      try {
        const seeded = sessionStorage.getItem(`cs_anime_seed_${id}`) || sessionStorage.getItem(`cinestream_anime_${id}`);
        if (seeded) {
          const parsed = JSON.parse(seeded);
          if (parsed && String(parsed.id) === String(id)) return parsed as AnimeDetail;
        }
      } catch {}
    }
    return null;
  });
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const animeTitle = anime?.name || (anime as any)?.title || (anime as any)?.english_name || (typeof id === "string" ? id.replace(/-\d+$/, "").replace(/-/g, " ") : undefined);
  const effectiveInitialLogo = (initialData as any)?.logoUrl || (anime as any)?.logoUrl || null;
  const { logoUrl, backdropUrl: mediaBackdropUrl, loading: logoLoading } = useMediaLogo(id, "anime", animeTitle, effectiveInitialLogo);
  const effectiveLogo = (anime as any)?.logoUrl || (initialData as any)?.logoUrl || logoUrl;

  const [isLoading, setIsLoading] = useState(() => {
    if (initialData && initialData.id) return false;
    if (typeof window !== "undefined") {
      try {
        const seeded = sessionStorage.getItem(`cs_anime_seed_${id}`) || sessionStorage.getItem(`cinestream_anime_${id}`);
        if (seeded) {
          const parsed = JSON.parse(seeded);
          if (parsed && String(parsed.id) === String(id)) return false;
        }
      } catch {}
    }
    return true;
  });
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchStarted, setWatchStarted] = useState(false);
  const [episodeNotice, setEpisodeNotice] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  const [franchiseNodes, setFranchiseNodes] = useState<FranchiseNode[]>(() => {
    if (initialData?.franchiseNodes && Array.isArray(initialData.franchiseNodes) && initialData.franchiseNodes.length > 1) {
      return initialData.franchiseNodes as FranchiseNode[];
    }
    const mem = FRANCHISE_MEMORY_CACHE.get(String(id));
    if (mem && mem.length > 1) return mem as FranchiseNode[];
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`cs_watch_order_${id}`) || sessionStorage.getItem(`sv_franchise_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 1) return parsed as FranchiseNode[];
        }
      } catch {}
    }
    return [];
  });
  const [showSeasonGuide, setShowSeasonGuide] = useState(false);
  const watchOrderScrollRef = useRef<HTMLDivElement>(null);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  const animeStatusRef = useRef<string | null>(null);
  const metaLoadedIdRef = useRef<string | null>(null);
  const [seasonOverview, setSeasonOverview] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const isPageReady = Boolean(
    (!isLoading && Boolean(anime)) ||
    error ||
    (anime as any)?.isHidden
  );
  usePageContentReady(isPageReady);

  const [currentSeasonId, setCurrentSeasonId] = useState<string>(id);
  const loadedSeasonIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  // ── Fetch episodes for a specific season by its AniList ID ─────────────
  const loadSeasonEpisodes = useCallback(async (
    seasonId: string,
    forceReload = false,
    clientTmdbId?: number | null,
    clientTmdbSeason?: number | null,
    clientEpisodeOffset?: number | null
  ) => {
    if (!forceReload && loadedSeasonIds.current.has(seasonId)) return;

    setEpisodesLoading(true);
    setSeasonOverview(null);

    const tmdbIdQuery = clientTmdbId != null ? `&tmdbId=${clientTmdbId}` : "";
    const tmdbSeasonQuery = clientTmdbSeason != null ? `&tmdbSeason=${clientTmdbSeason}` : "";
    const episodeOffsetQuery = clientEpisodeOffset != null ? `&episodeOffset=${clientEpisodeOffset}` : "";

    // Check session cache for instant episode hydration
    const EP_SESSION_KEY = `cs_anime_eps_${id}_${seasonId}_${ANIME_API_VERSION}`;
    if (!forceReload) {
      try {
        const cachedEps = sessionStorage.getItem(EP_SESSION_KEY);
        if (cachedEps) {
          const parsed = JSON.parse(cachedEps);
          if (parsed?.episodes && Array.isArray(parsed.episodes) && parsed.episodes.length > 0 && parsed._cachedAt) {
            const age = Date.now() - parsed._cachedAt;
            const maxAge = (parsed.status || "").toUpperCase().includes("RELEASING") ? 2 * 60 * 1000 : 5 * 60 * 1000;
            if (age < maxAge) {
              setEpisodes(prev => {
                const other = prev.filter(e => String(e.seasonId) !== String(seasonId));
                return [...other, ...parsed.episodes].sort((a, b) => a.episodeNum - b.episodeNum);
              });
              if (parsed.seasonOverview) setSeasonOverview(parsed.seasonOverview);
              loadedSeasonIds.current.add(seasonId);
              setEpisodesLoading(false);
              return;
            } else {
              sessionStorage.removeItem(EP_SESSION_KEY);
            }
          }
        }
      } catch {}
    }

    try {
      const epData = await fetchJson<{ success: boolean; data: { episodes: Episode[]; seasonOverview?: string | null; isUpcoming?: boolean; isUnavailable?: boolean; isHidden?: boolean } }>(
        `/api/anime/${id}/episodes?seasonId=${encodeURIComponent(seasonId)}${tmdbIdQuery}${tmdbSeasonQuery}${episodeOffsetQuery}&v=${ANIME_API_VERSION}`
      );
      const matchingSeason = anime?.seasons?.find(s => String(s.id) === String(seasonId));
      const activeSeasonStatus = matchingSeason?.status || anime?.status || "";
      const statusNorm = activeSeasonStatus.toLowerCase().replace(/_/g, " ").trim();
      const isParentUpcoming = Boolean((anime as any)?.isUpcoming || (anime as any)?.status === "upcoming");
      const isSeasonUpcoming = Boolean((matchingSeason as any)?.isUpcoming || (matchingSeason as any)?.status === "upcoming" || epData.data?.isUpcoming);
      const isParentUnavailable = Boolean((anime as any)?.isUnavailable || (anime as any)?.status === "unavailable");
      const isSeasonUnavailable = Boolean((matchingSeason as any)?.isUnavailable || (matchingSeason as any)?.status === "unavailable" || epData.data?.isUnavailable);

      if (isParentUpcoming || isSeasonUpcoming || isParentUnavailable || isSeasonUnavailable) {
        setEpisodes(prev => prev.filter(e => String(e.seasonId) !== String(seasonId)));
        setSeasonOverview(epData.data?.seasonOverview || null);
        loadedSeasonIds.current.add(seasonId);
        setEpisodesLoading(false);
        return;
      }

      const hasEpisodes = epData.success && epData.data?.episodes && epData.data.episodes.length > 0;
      if (hasEpisodes) {
        const sorted = epData.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        setEpisodes(prev => {
          const otherSeasons = prev.filter(e => String(e.seasonId) !== String(seasonId));
          const seenNums = new Set<number>();
          const dedupedThisSeason: Episode[] = [];
          for (const ep of sorted) {
            if (!seenNums.has(ep.episodeNum)) {
              seenNums.add(ep.episodeNum);
              dedupedThisSeason.push({
                ...ep,
                seasonId: String(ep.seasonId || seasonId),
              });
            }
          }
          const merged = [...otherSeasons, ...dedupedThisSeason].sort((a, b) => {
            if ((a.seasonNum || 1) !== (b.seasonNum || 1)) return (a.seasonNum || 1) - (b.seasonNum || 1);
            return a.episodeNum - b.episodeNum;
          });
          return merged;
        });
        setSeasonOverview(epData.data.seasonOverview || null);
        loadedSeasonIds.current.add(seasonId);
        setEpisodesLoading(false);

        try {
          const statusForCache = anime?.status || "";
          sessionStorage.setItem(EP_SESSION_KEY, JSON.stringify({
            episodes: sorted.map(ep => ({ ...ep, seasonId: String(ep.seasonId || seasonId) })),
            seasonOverview: epData.data.seasonOverview || null,
            status: statusForCache,
            _cachedAt: Date.now(),
          }));
        } catch {}
        return;
      }
    } catch (err) {
      console.warn(`[AnimeClient] Server episode API failed for seasonId=${seasonId}:`, err);
    }

    // Fallback if server returned no episodes
    const matchingSeason = anime?.seasons?.find(s => String(s.id) === String(seasonId));
    const isMovie = (matchingSeason?.seasonLabel || "").startsWith("Movie") || anime?.format === "MOVIE" || anime?.type === "MOVIE";
    const countToGen = isMovie ? 1 : Math.max(matchingSeason?.totalEpisodes || 1, 1);
    const fallbackEps: Episode[] = Array.from({ length: countToGen }, (_, i) => ({
      episodeId: `${seasonId}-${i + 1}`,
      episodeNum: i + 1,
      title: isMovie ? (matchingSeason?.name || anime?.name || "Complete Movie") : `Episode ${i + 1}`,
      description: isMovie ? anime?.description || undefined : undefined,
      thumbnail: isMovie ? anime?.poster || undefined : undefined,
      malUrl: undefined,
      isFiller: false,
      isReleased: true,
      seasonId: String(seasonId),
      seasonNum: 1,
    }));
    setEpisodes(prev => {
      const otherSeasons = prev.filter(e => String(e.seasonId) !== String(seasonId));
      return [...otherSeasons, ...fallbackEps].sort((a, b) => a.episodeNum - b.episodeNum);
    });
    loadedSeasonIds.current.add(seasonId);
    setEpisodesLoading(false);
  }, [id, anime]);

  // ── Reset state when navigating between different anime IDs ────────
  const prevIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id) return;
    if (prevIdRef.current === id) return;
    const isFirstMount = prevIdRef.current === null;
    prevIdRef.current = id;

    // Do not wipe state on initial mount if initialData or seeded data is present
    if (isFirstMount && ((initialData && String(initialData.id) === String(id)) || (anime && String(anime.id) === String(id)))) {
      return;
    }

    metaLoadedIdRef.current = null;
    loadedSeasonIds.current.clear();
    setAnime(null);
    setEpisodes([]);
    setSelectedEp(null);
    setIsPlaying(false);
    setWatchStarted(false);
    setSeasonOverview(null);
    const memFranchise = FRANCHISE_MEMORY_CACHE.get(String(id));
    if (memFranchise && memFranchise.length > 1) {
      setFranchiseNodes(memFranchise);
    } else {
      setFranchiseNodes([]);
    }
    setRecommendations([]);
    setIsLoading(true);
    setEpisodesLoading(true);
    setError(null);
  }, [id, initialData]);

  // ── 1) Immediate Episode Hydration on Mount ─────────────────────────────
  useEffect(() => {
    if (!id) return;
    const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const targetSeasonId = searchParams.get("seasonId") || id;
    setCurrentSeasonId(targetSeasonId);
    loadSeasonEpisodes(targetSeasonId, false);
  }, [id, loadSeasonEpisodes]);

  // ── 2) Server Meta & TMDB Mapping Enrichment ───────────────────────────
  useEffect(() => {
    if (!id) return;
    if (metaLoadedIdRef.current === id) return;

    metaLoadedIdRef.current = id;
    let cancelled = false;
    loadedSeasonIds.current.clear();

    const loadMeta = async () => {
      if (!anime && !initialData) {
        setIsLoading(true);
      }
      setError(null);
      try {
        let data: any = null;

        const SESSION_CACHE_KEY = `cs_anime_meta_${id}_${ANIME_API_VERSION}`;
        try {
          const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.success && parsed?.data?.anime && parsed._cachedAt) {
              const age = Date.now() - parsed._cachedAt;
              const maxAge = (parsed.data.anime?.status || "").toUpperCase().includes("RELEASING") ? 2 * 60 * 1000 : 5 * 60 * 1000;
              if (age < maxAge) {
                data = parsed;
              } else {
                sessionStorage.removeItem(SESSION_CACHE_KEY);
              }
            }
          }
        } catch {}

        if (!data) {
          try {
            data = await fetchJson<{ success: boolean; data: { anime: AnimeDetail; franchiseNodes?: FranchiseNode[]; tmdbSeasonMap?: Record<string, number> } }>(
              `/api/anime/${id}/meta?v=${ANIME_API_VERSION}`,
              { signal: AbortSignal.timeout(10000) }
            );
            if (data?.success && data?.data?.anime) {
              try {
                sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ ...data, _cachedAt: Date.now() }));
              } catch {}
            }
          } catch (e) {
            // Fallback to /api/anime/[id]
            try {
              const directRes = await fetchJson<{ success: boolean; data: AnimeDetail }>(`/api/anime/${id}`);
              if (directRes?.success && directRes.data) {
                data = { success: true, data: { anime: directRes.data } };
              }
            } catch {}
          }
        }

        if (cancelled) return;
        if (data && data.success && data.data?.anime) {
          const a = data.data.anime;
          if (!a.logoUrl && effectiveLogo) {
            a.logoUrl = effectiveLogo;
          }
          animeStatusRef.current = a.status || null;

          setAnime(a);
          setIsLoading(false);

          if (data?.data?.franchiseNodes && data.data.franchiseNodes.length > 1) {
            setFranchiseNodes(data.data.franchiseNodes);
            for (const fn of data.data.franchiseNodes) {
              FRANCHISE_MEMORY_CACHE.set(String(fn.id), data.data.franchiseNodes);
              if (fn.idMal) FRANCHISE_MEMORY_CACHE.set(String(fn.idMal), data.data.franchiseNodes);
            }
          }

          const seasons = a.seasons || [];
          let urlSeasonId: string | null = null;
          const searchParams = new URLSearchParams(window.location.search);
          const urlSeasonNum = Number(searchParams.get("season") || "");

          if (urlSeasonNum > 0 && data.data.tmdbSeasonMap) {
            const entry = Object.entries(data.data.tmdbSeasonMap).find(([_, num]) => num === urlSeasonNum);
            if (entry) urlSeasonId = entry[0];
          } else if (searchParams.get("seasonId")) {
            urlSeasonId = searchParams.get("seasonId");
          }

          if (urlSeasonId) {
            const matchingSeason = seasons.find((s: SeasonInfo) => String(s.id) === String(urlSeasonId));
            if (matchingSeason) {
              setCurrentSeasonId(matchingSeason.id);
              loadSeasonEpisodes(
                matchingSeason.id,
                true,
                (matchingSeason as any).tmdbId,
                matchingSeason.tmdbSeasonNumber,
                (matchingSeason as any).episodeOffset
              );
            }
          } else {
            const activeSeasonObj = seasons.find((s: SeasonInfo) => String(s.id) === String(currentSeasonId)) || seasons[0];
            if (activeSeasonObj) {
              loadSeasonEpisodes(
                activeSeasonObj.id,
                true,
                (activeSeasonObj as any).tmdbId,
                activeSeasonObj.tmdbSeasonNumber,
                (activeSeasonObj as any).episodeOffset
              );
            }
          }
        } else {
          throw new Error("Anime not found");
        }
      } catch (e) {
        if (!cancelled) {
          if (!anime) {
            setError(e instanceof Error ? e.message : "Failed to load anime");
          }
          setIsLoading(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadMeta();
    return () => { cancelled = true; };
  }, [id, loadSeasonEpisodes, initialData]);

  // ── 3) Background Watch Order Hydration ──────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const mem = FRANCHISE_MEMORY_CACHE.get(String(id));
    if (mem && mem.length > 1) {
      setFranchiseNodes(mem);
      return;
    }

    const loadWatchOrderInBackground = async () => {
      try {
        const res = await fetchJson<{ success: boolean; data: { franchiseNodes: FranchiseNode[] } }>(
          `/api/anime/${id}/watch-order?v=${ANIME_API_VERSION}`
        );
        if (cancelled) return;
        const nodes = res?.data?.franchiseNodes;
        if (nodes && Array.isArray(nodes) && nodes.length > 1) {
          setFranchiseNodes(nodes);
          for (const fn of nodes) {
            FRANCHISE_MEMORY_CACHE.set(String(fn.id), nodes);
            if (fn.idMal) FRANCHISE_MEMORY_CACHE.set(String(fn.idMal), nodes);
          }

          const numId = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
          const mappedSeasons = mapNodesToSeasons(nodes, numId);
          if (mappedSeasons && mappedSeasons.length > 0) {
            setAnime(prev => {
              if (!prev || String(prev.id) !== String(id)) return prev;
              const currentSeasons = prev.seasons || [];
              if (mappedSeasons.length > currentSeasons.length) {
                return { ...prev, seasons: mappedSeasons };
              }
              return prev;
            });
          }
        }
      } catch {}
    };

    const timer = setTimeout(() => {
      loadWatchOrderInBackground();
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  // ── 4) Recommendations ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let active = true;
    setRecsLoading(true);
    const franchiseIds = new Set(franchiseNodes.map(n => String(n.id)).filter(Boolean));
    const excludeIds = new Set([id, ...franchiseIds]);
    const numericId = parseInt(anime?.id || initialData?.id || id.replace(/\D/g, ""), 10);
    const validAnilistId = !isNaN(numericId) ? numericId : 1;

    const currentGenres = anime?.genres || initialData?.genres || [];
    const currentAnimeTitle = anime?.name || initialData?.name || "";

    const timer = setTimeout(() => {
      fetchAnilistRecommendations(validAnilistId, currentAnimeTitle, excludeIds, 12, currentGenres)
        .then(async (items) => {
          if (!active) return;
          if (items.length === 0 && validAnilistId > 1) {
            try {
              const excludeParam = [...excludeIds].join(",");
              const res = await fetch(`/api/anime/recommendations/${validAnilistId}?title=${encodeURIComponent(currentAnimeTitle)}&genres=${encodeURIComponent(currentGenres.join(","))}&excludeIds=${encodeURIComponent(excludeParam)}`);
              if (res.ok) {
                const data = await res.json();
                if (data?.items?.length > 0) items = data.items;
              }
            } catch {}
          }

          if (active && items.length > 0) {
            const withReasons = items.map((item: any) => ({
              ...item,
              reason: getRecommendationReason(currentGenres.map((g: string) => g.charCodeAt(0)), item.genres?.map((g: string) => g.charCodeAt(0)) || [])
            }));
            setRecommendations(withReasons);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setRecsLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [anime?.id, anime?.name, id, franchiseNodes, initialData]);

  // ── Autoplay / Watch History Restore ────────────────────────────────────
  useEffect(() => {
    if (episodes.length === 0 || typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    const autoPlay = searchParams.get("autoplay") === "1";
    const episodeParam = Number(searchParams.get("episode") || "");
    const seasonIdParam = searchParams.get("seasonId") || "";

    let target: Episode | undefined;

    if (episodeParam > 0) {
      target = episodes.find(ep => {
        const matchesSeasonId = seasonIdParam ? ep.seasonId === seasonIdParam : true;
        return matchesSeasonId && ep.episodeNum === episodeParam;
      });
    }

    if (target && (!selectedEp || selectedEp.episodeNum === 1)) {
      setSelectedEp(target);
      if (autoPlay) {
        const targetAnimeId = target.seasonId || currentSeasonId || anime?.id || id;
        router.push(`/watch/anime/${targetAnimeId}/${target.episodeNum}`);
        return;
      }
    }

    if (!hasRestoredState) {
      setHasRestoredState(true);
    }
  }, [episodes, id, anime, hasRestoredState, currentSeasonId, router, selectedEp]);

  // ── Season click handler ────────────────────────────────────────────────
  const handleSeasonClick = useCallback((season: SeasonInfo) => {
    if (season.id === currentSeasonId) return;
    setCurrentSeasonId(season.id);
    setEpisodesLoading(true);
    setIsPlaying(false);
    setSelectedEp(null);
    setWatchStarted(false);
    setEpisodeNotice(null);
    loadSeasonEpisodes(
      season.id,
      true,
      (season as any).tmdbId,
      season.tmdbSeasonNumber,
      (season as any).episodeOffset
    );

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("seasonId", season.id);
      url.searchParams.delete("episode");
      window.history.replaceState({}, "", url.toString());
    }
  }, [currentSeasonId, loadSeasonEpisodes]);

  // ── Watch episode handler: Fixed season navigation ───────────────────────
  const handleWatchEpisode = useCallback((ep: Episode) => {
    if (ep.isReleased === false) {
      setEpisodeNotice(`Episode ${ep.episodeNum} hasn't been released yet.`);
      return;
    }
    setEpisodeNotice(null);

    // CRITICAL: Navigate with the episode's seasonId or currentSeasonId, not root anime.id
    const targetAnimeId = ep.seasonId || currentSeasonId || anime?.id || id;
    router.push(`/watch/anime/${targetAnimeId}/${ep.episodeNum}`);
  }, [anime?.id, currentSeasonId, id, router]);

  const [episodeView, setEpisodeView] = useState<EpisodeViewMode>("grid");

  const handleViewChange = useCallback((view: EpisodeViewMode) => {
    setEpisodeView(view);
  }, []);

  const seasons = useMemo(() => anime?.seasons || [], [anime]);

  const episodesBySeason = useMemo(() => {
    return episodes.reduce((acc, ep) => {
      const key = String(ep.seasonId || "unknown");
      if (!acc[key]) acc[key] = [];
      acc[key].push(ep);
      return acc;
    }, {} as Record<string, Episode[]>);
  }, [episodes]);

  const currentSeasonEps = useMemo(() => {
    const targetKey = String(currentSeasonId || id || "").trim().toLowerCase();
    const cleanNum = targetKey.replace(/\D/g, "");

    const rawList = (() => {
      const direct = episodesBySeason[targetKey] || episodesBySeason[String(currentSeasonId)];
      if (direct && direct.length > 0) {
        return [...direct].sort((a, b) => a.episodeNum - b.episodeNum);
      }

      if (cleanNum) {
        for (const [k, list] of Object.entries(episodesBySeason)) {
          if (k.replace(/\D/g, "") === cleanNum && list.length > 0) {
            return [...list].sort((a, b) => a.episodeNum - b.episodeNum);
          }
        }
      }

      if (anime?.seasons && anime.seasons.length > 0) {
        const activeSeason = anime.seasons.find(s => String(s.id).toLowerCase() === targetKey || (cleanNum && String(s.id).replace(/\D/g, "") === cleanNum));
        if (activeSeason) {
          const sKey = String(activeSeason.id);
          const sList = episodesBySeason[sKey] || episodesBySeason[sKey.replace(/\D/g, "")];
          if (sList && sList.length > 0) {
            return [...sList].sort((a, b) => a.episodeNum - b.episodeNum);
          }
        }
      }

      if (episodes.length > 0) {
        const filtered = episodes.filter(e => {
          const eKey = String(e.seasonId || "").toLowerCase();
          return eKey === targetKey || (cleanNum && eKey.replace(/\D/g, "") === cleanNum);
        });
        if (filtered.length > 0) {
          return [...filtered].sort((a, b) => a.episodeNum - b.episodeNum);
        }
      }

      return [];
    })();

    if (rawList.length === 0) return [];

    const activeSeason = anime?.seasons?.find(s => String(s.id).toLowerCase() === targetKey || (cleanNum && String(s.id).replace(/\D/g, "") === cleanNum));
    const isSeasonMovie = (activeSeason?.seasonLabel || "").toLowerCase().startsWith("movie") ||
      ((activeSeason as any)?.format === "MOVIE" && (activeSeason?.totalEpisodes === 1 || !activeSeason?.totalEpisodes)) ||
      (anime?.format === "MOVIE" && (anime?.totalEpisodes === 1 || !anime?.totalEpisodes) && (activeSeason as any)?.format !== "TV");

    if (isSeasonMovie && rawList.length > 1) {
      const first = rawList[0];
      const isPart = (first.title || "").toLowerCase().startsWith("part ");
      return [{
        ...first,
        episodeNum: 1,
        title: (first.title && !isPart && first.title !== "Episode 1") ? first.title : (activeSeason?.name || anime?.name || "Complete Movie"),
      }];
    }

    const seenEpNums = new Set<number>();
    const dedupedList: Episode[] = [];
    for (const ep of rawList) {
      if (!seenEpNums.has(ep.episodeNum)) {
        seenEpNums.add(ep.episodeNum);
        dedupedList.push(ep);
      }
    }

    return dedupedList.sort((a, b) => a.episodeNum - b.episodeNum);
  }, [episodesBySeason, currentSeasonId, id, episodes, anime?.seasons, anime?.format, anime?.type, anime?.name]);

  const [episodePage, setEpisodePage] = useState(1);
  const [listChunkIndex, setListChunkIndex] = useState(0);

  useEffect(() => {
    setEpisodePage(1);
    setListChunkIndex(0);
  }, [currentSeasonId]);

  useEffect(() => {
    if (!selectedEp) return;
    const epNum = selectedEp.episodeNum;
    const gridPageSize = currentSeasonEps.length > 500 ? 50 : 25;
    const targetPage = Math.floor((epNum - 1) / gridPageSize) + 1;
    setEpisodePage(targetPage);

    const LIST_CHUNK_SIZE = 10;
    const targetChunk = Math.floor((epNum - 1) / LIST_CHUNK_SIZE);
    setListChunkIndex(targetChunk);
  }, [selectedEp?.episodeId, selectedEp?.episodeNum, currentSeasonEps.length]);

  const currentSeasonInfo = useMemo(
    () => seasons.find(s => String(s.id) === String(currentSeasonId)) || franchiseNodes.find(n => String(n.id) === String(currentSeasonId)) || null,
    [seasons, franchiseNodes, currentSeasonId]
  );

  const isSpecialFormat = useMemo(
    () =>
      anime?.format === "MOVIE" ||
      anime?.type === "MOVIE" ||
      (currentSeasonInfo as any)?.seasonLabel?.toLowerCase().startsWith("movie") ||
      (currentSeasonInfo as any)?.seasonLabel?.toLowerCase().startsWith("ova") ||
      (currentSeasonInfo as any)?.seasonLabel?.toLowerCase().startsWith("special"),
    [anime?.format, anime?.type, currentSeasonInfo]
  );

  const isMovieFormat = anime?.format === "MOVIE" || anime?.type === "MOVIE" || isSpecialFormat;
  const isSingleItem = (currentSeasonEps.length <= 1 && isSpecialFormat) || isMovieFormat;

  const currentSeason = useMemo(() => {
    return seasons.find(s => String(s.id) === String(currentSeasonId)) || null;
  }, [seasons, currentSeasonId]);

  const displayPoster = (currentSeasonInfo as any)?.coverImage || (currentSeason as any)?.coverImage || anime?.poster || "";
  const tmdbBackdropPath = anime?.backdrop || null;

  // STRICT ARTWORK RULE: AniList banner is authoritative; TMDB backdrop is fallback only!
  const displayBanner =
    (currentSeasonInfo as any)?.bannerImage
    || (anime as any)?.bannerImage
    || (initialData as any)?.bannerImage
    || (tmdbBackdropPath ? (tmdbBackdropPath.startsWith("http") ? tmdbBackdropPath : `https://image.tmdb.org/t/p/original${tmdbBackdropPath}`) : null)
    || mediaBackdropUrl
    || (currentSeasonInfo as any)?.coverImage
    || anime?.poster
    || "";

  const displayTitle = (currentSeasonInfo as any)?.name || (currentSeasonInfo as any)?.title || currentSeason?.name || anime?.name || "";
  const displayStatus = currentSeason?.status || (currentSeasonInfo as any)?.status || anime?.status || "";

  useEffect(() => {
    if (typeof document !== "undefined" && displayTitle) {
      document.title = `${displayTitle} - CineStream`;
    }
  }, [displayTitle]);

  const animeDescription = anime?.description || seasonOverview || "";
  const animeScoreRaw = Number(anime?.rating || anime?.score || 0);
  const animeScore = animeScoreRaw > 10 ? animeScoreRaw / 10 : animeScoreRaw;
  const isLongDescription = animeDescription.length > 200;

  useEffect(() => {
    setDescExpanded(false);
  }, [currentSeasonId, seasonOverview]);

  const episodeToItem = useCallback((ep: Episode): EpisodeItem => {
    const isUnreleased = ep.isReleased === false;
    const backdropFallback = (anime as any)?.bannerImage || initialData?.bannerImage || displayPoster || null;
    const thumbSrc = isUnreleased
      ? (ep.thumbnail || null)
      : (ep.thumbnail || (isSingleItem && displayPoster) || backdropFallback);
    const isSelected = selectedEp?.episodeId === ep.episodeId || Number(selectedEp?.episodeNum) === Number(ep.episodeNum);
    const isCurrent = isSelected;
    return {
      key: `${currentSeasonId}-${ep.episodeNum}-${ep.episodeId || 'ep'}`,
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
      isSelected: isCurrent,
      isPlaying: isPlaying && isCurrent,
      portrait: isSingleItem,
      onClick: () => handleWatchEpisode(ep),
    };
  }, [anime, currentSeasonId, displayPoster, displayTitle, handleWatchEpisode, isPlaying, isSingleItem, selectedEp]);

  const episodeItems = useMemo(() => {
    return currentSeasonEps.map(episodeToItem);
  }, [currentSeasonEps, episodeToItem]);

  const { theme } = useTheme();

  const pageBgClass = useMemo(() => {
    switch (theme) {
      case "global":
        return "bg-[#07080d]";
      case "glass":
        return "bg-transparent";
      case "oled":
        return "bg-[#000000]";
      case "cinema":
        return "bg-[#140509]";
      case "wisteria":
        return "bg-[#0e071c]";
      case "solaris":
        return "bg-[#100b05]";
      default:
        return "bg-[#07080d]";
    }
  }, [theme]);

  const animeBackdropUrl = displayBanner || displayPoster || null;

  return (
    <div className={`relative min-h-screen ${pageBgClass} text-foreground pb-20 overflow-x-clip transition-colors duration-500`}>
      {isPageReady && Boolean(anime) && (
        <AmbientBackdropGlow backdropUrl={animeBackdropUrl} />
      )}

      <Sidebar />

      <main className="relative z-10 w-full pt-0 bleed-header select-none">
        {!isPageReady ? (
          <div className="min-h-screen w-full" />
        ) : (error || (anime as any)?.isHidden) ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-16">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl max-w-lg mx-auto space-y-3">
              <div className="text-xl font-bold text-white mb-2">Title Unavailable</div>
              <div className="text-sm text-white/50 mb-4">
                This anime is currently not available to view. Please check back later or explore other anime.
              </div>
              <Link href="/anime" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4B5694] hover:bg-[#4B5694] text-white rounded-xl text-sm font-bold transition-all">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>
            </div>
          </div>
        ) : anime ? (
          <>
            {/* ── Hero Banner ── */}
            <CinematicHero
              backdropPath={displayBanner}
              trailerId={anime.trailerId}
              title={displayTitle}
              theme="anime"
            >
              <div className="relative z-10 pb-4 md:pb-8 px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 flex flex-col lg:flex-row lg:items-end justify-between gap-6 w-full">
                <div className="flex flex-row items-center gap-3.5 sm:gap-6 md:gap-8 min-w-0 flex-1">
                  <div className="shrink-0 w-24 sm:w-36 md:w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10">
                    <img src={displayPoster} alt={displayTitle} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                    <div>
                      {effectiveLogo ? (
                        <div className="mb-4 sm:mb-5 max-w-[280px] sm:max-w-[340px] md:max-w-[420px] lg:max-w-[480px]">
                          <img
                            src={effectiveLogo}
                            alt={displayTitle}
                            className="max-h-20 sm:max-h-24 md:max-h-28 lg:max-h-32 w-auto object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]"
                          />
                        </div>
                      ) : !logoLoading ? (
                        <h1 className="font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight select-text">{displayTitle}</h1>
                      ) : (
                        <div className="h-10 sm:h-14 md:h-16 w-48 sm:w-64 rounded-xl bg-white/5 animate-pulse mb-3" />
                      )}
                      {anime.jname && (
                        <p className="text-primary/90 font-semibold italic text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1 select-text">{anime.jname}</p>
                      )}
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
                        const formatted = formatAnimeStatus(displayStatus, currentSeasonEps);
                        return (
                          <span className={`text-[10px] sm:text-xs font-black tracking-wider px-3 py-1 rounded-xl uppercase border shadow-sm ${
                            formatted.style === "airing"
                              ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
                              : formatted.style === "upcoming"
                              ? "text-sky-300 bg-sky-500/20 border-sky-500/30"
                              : "text-white bg-white/10 border-white/20"
                          }`}>{formatted.label}</span>
                        );
                      })()}
                      {anime.type && (
                        <span className="px-3 py-1 bg-white/[0.08] border border-white/15 rounded-xl text-xs sm:text-sm font-extrabold text-white shadow-sm">{anime.type}</span>
                      )}
                      <div className="flex flex-wrap gap-2 ml-0.5">
                        {anime.genres?.slice(0, 5).map(g => (
                          <span key={g} className="px-3.5 py-1 bg-fuchsia-500/15 border border-fuchsia-400/30 rounded-full text-xs sm:text-sm font-extrabold text-fuchsia-200 shadow-sm">{g}</span>
                        ))}
                      </div>
                    </div>

                    {animeDescription && (
                      <div>
                        <p className={cn("text-white/65 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl select-text", isLongDescription && !descExpanded && "line-clamp-2 sm:line-clamp-3")}>
                          {animeDescription}
                        </p>
                        {isLongDescription && (
                          <button
                            onClick={() => setDescExpanded(v => !v)}
                            className="mt-1 inline-flex items-center gap-1 text-primary hover:text-primary/85 text-xs sm:text-sm font-bold transition-colors"
                          >
                            {descExpanded ? "Read less" : "Read more"}
                            <ChevronDown className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform", descExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="pt-1">
                      {(anime as any)?.isUpcoming || (anime as any)?.status === "upcoming" || (currentSeasonInfo as any)?.isUpcoming || (currentSeasonInfo as any)?.status === "upcoming" ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs sm:text-sm font-semibold shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                            <span>This entry is upcoming. Please check back later.</span>
                          </div>
                          <WatchlistButton
                            mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0}
                            mediaType="anime"
                            title={anime.name}
                            posterPath={anime.poster || null}
                          />
                          <AnimeHeroTrailerButton />
                        </div>
                      ) : (anime as any)?.isUnavailable || (anime as any)?.status === "unavailable" || (currentSeasonInfo as any)?.isUnavailable || (currentSeasonInfo as any)?.status === "unavailable" ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-300 text-xs sm:text-sm font-semibold shadow-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                            <span>This title is currently unavailable on this site. Please check back later.</span>
                          </div>
                          <WatchlistButton
                            mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0}
                            mediaType="anime"
                            title={anime.name}
                            posterPath={anime.poster || null}
                          />
                          <AnimeHeroTrailerButton />
                        </div>
                      ) : currentSeasonEps.length > 0 ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <button
                            onClick={() => {
                              const first = currentSeasonEps.find(ep => ep.isReleased !== false) || currentSeasonEps[0];
                              if (first) handleWatchEpisode(first);
                            }}
                            className="group flex items-center gap-2 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-xl shadow-black/30"
                          >
                            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current group-hover:scale-110 transition-transform" />
                            {isMovieFormat
                              ? `Watch ${currentSeasonEps.length > 1 ? `Movie ${currentSeasonEps[0]?.episodeNum || 1}` : "Movie"}`
                              : `Watch Ep ${selectedEp?.episodeNum || currentSeasonEps[0]?.episodeNum || 1}`
                            }
                          </button>

                          <WatchlistButton
                            mediaId={parseInt(String(anime.id).replace(/\D/g, ""), 10) || 0}
                            mediaType="anime"
                            title={anime.name}
                            posterPath={anime.poster || null}
                          />

                          <AnimeHeroTrailerButton />
                        </div>
                      ) : episodesLoading ? (
                        <div className="flex items-center gap-4 w-full">
                          <div className="h-12 w-36 rounded-xl bg-white/10 animate-pulse" />
                          <AnimeHeroTrailerButton />
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 w-full">
                          <button disabled className="flex items-center gap-2 bg-white/10 text-white/30 font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm cursor-not-allowed">
                            No Episodes Available
                          </button>
                          <AnimeHeroTrailerButton />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CinematicHero>

            {/* ── Main Content ── */}
            <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 mt-6 space-y-6">
              <Link href="/anime" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>

              {/* Title & Metadata row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-white">{anime.name}</h2>
                    {isMovieFormat && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Movie
                      </span>
                    )}
                    {((anime as any)?.isUpcoming || (anime as any)?.status === "upcoming") && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Upcoming
                      </span>
                    )}
                    {((anime as any)?.isUnavailable || (anime as any)?.status === "unavailable") && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-700/40 text-zinc-300 border border-zinc-600/40">
                        Unavailable
                      </span>
                    )}
                    {Array.isArray((anime as any)?.customTags) && (anime as any).customTags.map((tag: string, i: number) => (
                      <span key={i} className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        🏷️ {tag}
                      </span>
                    ))}
                  </div>
                  {anime.jname && anime.jname !== anime.name && (
                    <p className="text-xs text-white/40 mt-0.5">{anime.jname}</p>
                  )}
                  {animeScore > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{animeScore.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 px-4 py-2.5 bg-black/50 backdrop-blur-xl border border-white/15 rounded-2xl shadow-xl shrink-0 self-start sm:self-center">
                  <span className="text-sm font-bold text-white/90 uppercase tracking-wider">
                    {anime.format || anime.type || "Anime"}
                  </span>

                  {anime.seasonYear && (
                    <>
                      <div className="w-px h-4 bg-white/15" />
                      <span className="text-sm font-semibold text-white/70">
                        {anime.seasonYear}
                      </span>
                    </>
                  )}

                  <div className="w-px h-4 bg-white/15" />

                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-black text-white">
                      {isMovieFormat ? 1 : (currentSeasonEps.length || anime.totalEpisodes || 1)}
                    </span>
                    <span className="text-xs text-white/50 font-semibold">
                      {isMovieFormat ? (currentSeasonEps.length > 1 ? "Parts" : "Movie") : ((currentSeasonEps.length || anime.totalEpisodes || 1) === 1 ? "Episode" : "Episodes")}
                    </span>
                  </div>

                  <div className="w-px h-4 bg-white/15" />

                  {(() => {
                    const formatted = formatAnimeStatus(displayStatus, currentSeasonEps);
                    const statusLabel = formatted.style === "airing" ? "Ongoing" : formatted.style === "upcoming" ? "Upcoming" : "Completed";
                    const dotColor = formatted.style === "airing" ? "bg-emerald-400" : formatted.style === "upcoming" ? "bg-sky-400" : "bg-white/60";
                    return (
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dotColor} ${formatted.style === "airing" ? "animate-pulse" : ""}`} />
                        <span className="text-sm font-bold text-white">{statusLabel}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {episodeNotice && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
                  {episodeNotice}
                </div>
              )}

              {/* ── Episodes Section ── */}
              <section id="anime-episodes-section" className="mt-10 space-y-4">
                {/* ── Watch Order Section ── */}
                {(() => {
                  const numFranchiseId = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
                  const curatedNodes = getCuratedAnimeFranchiseNodes(numFranchiseId, anime?.name);
                  const currentSeasons = anime?.seasons || [];

                  type WatchOrderNode = {
                    id: string;
                    idMal?: number | null;
                    title: string;
                    episodes?: number | null;
                    totalEpisodes?: number | null;
                    format?: string | null;
                    seasonYear?: number | null;
                    coverImage?: string | null;
                    matchingSeason?: SeasonInfo | null;
                  };

                  let rawList: WatchOrderNode[] = [];

                  if (curatedNodes && curatedNodes.length > 1) {
                    rawList = curatedNodes.map(c => ({
                      id: String(c.id),
                      idMal: c.idMal || null,
                      title: c.title,
                      episodes: c.episodes,
                      totalEpisodes: c.episodes,
                      format: c.format || "TV",
                      seasonYear: c.seasonYear || null,
                      coverImage: c.coverImage || null,
                    }));
                  } else if (franchiseNodes && franchiseNodes.length > 1) {
                    rawList = franchiseNodes.map(f => ({
                      id: String(f.id),
                      idMal: f.idMal || null,
                      title: f.title,
                      episodes: f.episodes,
                      totalEpisodes: f.totalEpisodes || f.episodes,
                      format: f.format || "TV",
                      seasonYear: f.seasonYear || null,
                      coverImage: f.coverImage || null,
                    }));
                  } else if (currentSeasons.length > 1) {
                    rawList = currentSeasons.map(s => ({
                      id: String(s.id),
                      idMal: s.idMal || null,
                      title: s.name || s.seasonLabel,
                      episodes: s.totalEpisodes,
                      totalEpisodes: s.totalEpisodes,
                      format: s.seasonLabel.startsWith("Movie") ? "MOVIE" : (s.seasonLabel.startsWith("OVA") ? "OVA" : "TV"),
                      seasonYear: s.seasonYear || null,
                      coverImage: s.coverImage || anime?.poster || null,
                      matchingSeason: s,
                    }));
                  }

                  const entries: WatchOrderNode[] = rawList.map(item => {
                    const match = item.matchingSeason || currentSeasons.find(s => {
                      if (String(s.id).toLowerCase() === item.id.toLowerCase()) return true;
                      if (s.idMal && item.idMal && s.idMal === item.idMal) return true;
                      if (s.name && item.title && s.name.toLowerCase() === item.title.toLowerCase()) return true;
                      if (s.seasonLabel && item.title && s.seasonLabel.toLowerCase() === item.title.toLowerCase()) return true;
                      return false;
                    }) || null;

                    return {
                      ...item,
                      matchingSeason: match,
                      totalEpisodes: match?.totalEpisodes || item.totalEpisodes || item.episodes,
                    };
                  });

                  const visibleFranchiseNodes = entries.filter(node => Boolean(node.title));
                  if (visibleFranchiseNodes.length <= 1) return null;

                  const sortedVisibleNodes = [...visibleFranchiseNodes].sort((a, b) => {
                    if (curatedNodes && curatedNodes.length > 1) {
                      const idxA = curatedNodes.findIndex(c => String(c.id) === String(a.id));
                      const idxB = curatedNodes.findIndex(c => String(c.id) === String(b.id));
                      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    }
                    const yearA = a.seasonYear || 9999;
                    const yearB = b.seasonYear || 9999;
                    if (yearA !== yearB) return yearA - yearB;
                    const formatOrder = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };
                    const fA = (formatOrder as any)[a.format || "TV"] ?? 6;
                    const fB = (formatOrder as any)[b.format || "TV"] ?? 6;
                    if (fA !== fB) return fA - fB;
                    return 0;
                  });

                  const totalParts = sortedVisibleNodes.length;
                  const activeIdx = sortedVisibleNodes.findIndex(node => {
                    if (node.matchingSeason && String(node.matchingSeason.id) === String(currentSeasonId)) return true;
                    if (String(node.id) === String(currentSeasonId)) return true;
                    if (!currentSeasonId && String(node.id) === String(anime?.id)) return true;
                    return false;
                  });
                  const hasActive = activeIdx >= 0;

                  const formatMeta = (fmt: string | null) => {
                    switch (fmt) {
                      case "MOVIE":
                        return { label: "Movie", icon: Film, style: "bg-purple-500/20 text-purple-200 border-purple-400/30" };
                      case "OVA":
                        return { label: "OVA", icon: Sparkles, style: "bg-amber-500/20 text-amber-200 border-amber-400/30" };
                      case "SPECIAL":
                        return { label: "Special", icon: Sparkles, style: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30" };
                      case "ONA":
                        return { label: "ONA", icon: Tv, style: "bg-teal-500/20 text-teal-200 border-teal-400/30" };
                      case "TV_SHORT":
                      default:
                        return { label: fmt || "TV", icon: Tv, style: "bg-sky-500/20 text-sky-200 border-sky-400/30" };
                    }
                  };

                  const scrollTimeline = (direction: "left" | "right") => {
                    if (!watchOrderScrollRef.current) return;
                    const amount = direction === "left" ? -320 : 320;
                    watchOrderScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
                  };

                  return (
                    <div className="relative mb-6 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-xl transition-all duration-300 overflow-hidden shadow-lg">
                      <button
                        onClick={() => setShowSeasonGuide(!showSeasonGuide)}
                        className="w-full flex items-center justify-between gap-4 p-3.5 sm:p-4 text-left transition-colors hover:bg-white/[0.04] group"
                        aria-expanded={showSeasonGuide}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
                            <Route className="w-4 h-4 text-white" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                                Watch Order Guide
                              </h3>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 border border-white/15 text-white/80 px-2 py-0.5 rounded-full">
                                {totalParts} Parts
                              </span>
                              {hasActive && (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Part {activeIdx + 1} of {totalParts} (Current)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/50 truncate mt-0.5">
                              Recommended chronological story order for the complete franchise
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 group-hover:bg-white/15 border border-white/15 text-xs font-extrabold text-white transition-all">
                            <span>{showSeasonGuide ? "Hide Guide" : "View Guide"}</span>
                            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-300", showSeasonGuide && "rotate-90")} />
                          </div>
                        </div>
                      </button>

                      {showSeasonGuide && (
                        <div className="border-t border-white/10 p-3.5 sm:p-4 bg-white/[0.02]">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="text-[11px] font-bold text-white/50 flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 text-primary" />
                              Select any entry to switch directly:
                            </span>

                            {totalParts > 3 && (
                              <div className="hidden sm:flex items-center gap-1">
                                <button
                                  onClick={() => scrollTimeline("left")}
                                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors"
                                  aria-label="Scroll left"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => scrollTimeline("right")}
                                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-colors"
                                  aria-label="Scroll right"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div
                            ref={watchOrderScrollRef}
                            className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 -mx-1 px-1"
                            style={{ scrollBehavior: "smooth" }}
                          >
                            {sortedVisibleNodes.map((node, orderIndex) => {
                              const isActive = (node.matchingSeason && String(node.matchingSeason.id) === String(currentSeasonId))
                                || String(node.id) === String(currentSeasonId)
                                || (!currentSeasonId && String(node.id) === String(anime?.id));

                              const meta = formatMeta(node.format || "TV");
                              const FormatIcon = meta.icon;
                              const poster = node.coverImage || (String(node.id) === String(anime?.id) ? anime?.poster : null) || anime?.poster || null;
                              const nodeEpCount = (isActive && currentSeasonEps.length > 0)
                                ? currentSeasonEps.length
                                : (node.totalEpisodes || node.episodes || null);

                              const targetHref = `/anime/${node.id}`;

                              const handleEntryClick = (e: React.MouseEvent) => {
                                if (isActive) {
                                  e.preventDefault();
                                  const epEl = document.getElementById("anime-episodes-list") || document.getElementById("anime-episodes-section");
                                  if (epEl) {
                                    epEl.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }
                                }
                              };

                              return (
                                <Link
                                  key={`watch-node-${node.id}-${orderIndex}`}
                                  href={targetHref}
                                  onClick={handleEntryClick}
                                  className={cn(
                                    "group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 shrink-0 w-64 sm:w-72 snap-start cursor-pointer",
                                    isActive
                                      ? "bg-primary/20 border-primary/50 ring-1 ring-primary/40 shadow-md shadow-primary/20"
                                      : "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 hover:border-white/20"
                                  )}
                                >
                                  <div className="relative w-12 sm:w-14 aspect-[2/3] rounded-lg overflow-hidden shrink-0 shadow-md bg-white/10">
                                    {poster ? (
                                      <img
                                        src={poster}
                                        alt={node.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-white/40 font-bold text-xs">
                                        {orderIndex + 1}
                                      </div>
                                    )}
                                    <div className="absolute top-0.5 left-0.5 px-1 py-0.2 rounded bg-black/80 backdrop-blur-sm text-[9px] font-black text-white">
                                      #{orderIndex + 1}
                                    </div>
                                  </div>

                                  <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5 self-stretch">
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border", meta.style)}>
                                          <FormatIcon className="w-2.5 h-2.5" />
                                          {meta.label}
                                        </span>
                                        {node.seasonYear && <span className="text-[10px] text-white/60 font-semibold">{node.seasonYear}</span>}
                                      </div>

                                      <h4 className={cn(
                                        "text-xs font-bold mt-1 line-clamp-1 leading-tight",
                                        isActive ? "text-white" : "text-white/90 group-hover:text-primary transition-colors"
                                      )}>
                                        {node.title}
                                      </h4>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-white/10">
                                      <span className="text-[10px] text-white/50 font-medium">
                                        {nodeEpCount ? `${nodeEpCount} eps` : ""}
                                      </span>

                                      {isActive ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                          Watching
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-white/40 group-hover:text-white flex items-center gap-0.5 transition-colors">
                                          Open <ChevronRight className="w-3 h-3" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div id="anime-episodes-list" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full shadow-lg" />
                    <h2 className="text-2xl font-black text-white tracking-tight">Episodes</h2>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap max-w-xl justify-end">
                    {currentSeasonEps.length > 0 && (
                      <EpisodeViewSelector mode={episodeView} onChange={handleViewChange} views={["list", "grid", "numbers"]} />
                    )}
                  </div>
                </div>

                {/* ── Episode Display ── */}
                {(() => {
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

                  if ((anime as any)?.isUpcoming || (anime as any)?.status === "upcoming" || (currentSeasonInfo as any)?.isUpcoming) {
                    return (
                      <div className="p-10 text-center rounded-2xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-md my-4">
                        <div className="text-4xl mb-3">⏳</div>
                        <h3 className="text-lg font-black text-amber-300 mb-1">
                          Upcoming Anime Release
                        </h3>
                        <p className="text-xs text-zinc-300/80 max-w-md mx-auto leading-relaxed">
                          This entry is scheduled as Upcoming. Episodes and streaming will be available as soon as it premieres!
                        </p>
                      </div>
                    );
                  }

                  if ((anime as any)?.isUnavailable || (anime as any)?.status === "unavailable" || (currentSeasonInfo as any)?.isUnavailable) {
                    return (
                      <div className="p-10 text-center rounded-2xl border border-zinc-700/50 bg-zinc-900/40 backdrop-blur-md my-4">
                        <div className="text-4xl mb-3">🔒</div>
                        <h3 className="text-lg font-black text-zinc-300 mb-1">
                          Currently Unavailable
                        </h3>
                        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                          This title is currently unavailable for streaming on this site. Please check back later.
                        </p>
                      </div>
                    );
                  }

                  if (currentSeasonEps.length === 0) {
                    const isNotYet = anime?.status === "NOT_YET_RELEASED" || anime?.status === "NOT_YET_AIRED" || anime?.status === "Not Yet Aired";
                    return (
                      <div className="p-10 text-center rounded-2xl border border-emerald-500/25 bg-emerald-950/20 backdrop-blur-md my-4">
                        <div className="text-4xl mb-3">📅</div>
                        <h3 className="text-lg font-black text-emerald-300 mb-1">
                          {isNotYet ? "Not Yet Released" : "No Episodes Available"}
                        </h3>
                        <p className="text-xs text-zinc-300/80 max-w-md mx-auto leading-relaxed">
                          {isNotYet
                            ? `This anime season (${anime?.seasonYear || "Upcoming"}) has not started broadcasting yet. Episodes will become available as soon as it begins airing!`
                            : "No episodes are currently available for this season."}
                        </p>
                      </div>
                    );
                  }

                  const items = episodeItems;

                  if (episodeView === "numbers") {
                    return (
                      <div key={`numbers-${currentSeasonId}`}>
                        <EpisodeNumbersView items={items} />
                      </div>
                    );
                  }

                  if (episodeView === "grid") {
                    const gridPageSize = items.length > 500 ? 50 : 25;
                    const totalPages = Math.ceil(items.length / gridPageSize);
                    const activePage = Math.min(Math.max(1, episodePage), Math.max(1, totalPages));
                    const startIndex = (activePage - 1) * gridPageSize;
                    const sliceItems = items.slice(startIndex, startIndex + gridPageSize);

                    const handlePageChange = (newPage: number) => {
                      setEpisodePage(newPage);
                      const el = document.getElementById("anime-episodes-section");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    };

                    return (
                      <div key={`grid-${currentSeasonId}-${activePage}`}>
                        {totalPages > 1 && (
                          <div className="mb-6">
                            <EpisodePagination
                              currentPage={activePage}
                              totalPages={totalPages}
                              totalItems={items.length}
                              itemsPerPage={gridPageSize}
                              onPageChange={handlePageChange}
                            />
                          </div>
                        )}

                        <EpisodeGridView items={sliceItems} />

                        {totalPages > 1 && (
                          <div className="mt-8">
                            <EpisodePagination
                              currentPage={activePage}
                              totalPages={totalPages}
                              totalItems={items.length}
                              itemsPerPage={gridPageSize}
                              onPageChange={handlePageChange}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }

                  const LIST_CHUNK_SIZE = 10;
                  const totalChunks = Math.ceil(items.length / LIST_CHUNK_SIZE);
                  const activeChunk = Math.min(Math.max(0, listChunkIndex), Math.max(0, totalChunks - 1));
                  const startChunkIndex = activeChunk * LIST_CHUNK_SIZE;
                  const sliceChunkItems = items.slice(startChunkIndex, startChunkIndex + LIST_CHUNK_SIZE);

                  const handleChunkChange = (newChunk: number) => {
                    setListChunkIndex(newChunk);
                    const el = document.getElementById("anime-episodes-section");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  };

                  return (
                    <div key={`list-${currentSeasonId}-${activeChunk}`}>
                      {items.length > LIST_CHUNK_SIZE && (
                        <div className="flex justify-end mt-2 mb-6">
                          <EpisodeChunkBar
                            totalEpisodes={items.length}
                            chunkSize={LIST_CHUNK_SIZE}
                            activeChunkIndex={activeChunk}
                            onChunkChange={handleChunkChange}
                            activeEpisodeNumber={selectedEp?.episodeNum}
                          />
                        </div>
                      )}

                      <EpisodeListView items={sliceChunkItems} />

                      {items.length > LIST_CHUNK_SIZE && (
                        <div className="flex justify-end mt-8 pt-4 border-t border-white/[0.06]">
                          <EpisodeChunkBar
                            totalEpisodes={items.length}
                            chunkSize={LIST_CHUNK_SIZE}
                            activeChunkIndex={activeChunk}
                            onChunkChange={handleChunkChange}
                            activeEpisodeNumber={selectedEp?.episodeNum}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </section>

              {recommendations.length > 0 && (
                <>
                  <div className="mt-16 mb-6 px-5 md:px-0">
                    <h2 className="text-lg md:text-2xl font-black text-white tracking-tight flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full" />
                      You May Like
                    </h2>
                  </div>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-x-4 gap-y-6 px-5 md:px-0 pt-3 -mt-3"
                  >
                    {recommendations.slice(0, 20).map((item: any, i: number) => {
                      const visibilityClass =
                        i < 4
                          ? "block"
                          : i < 6
                          ? "hidden sm:block"
                          : i < 8
                          ? "hidden md:block"
                          : i < 10
                          ? "hidden lg:block"
                          : i < 12
                          ? "hidden xl:block"
                          : i < 14
                          ? "hidden 2xl:block"
                          : i < 16
                          ? "hidden 3xl:block"
                          : "hidden 4xl:block";
                      return (
                        <div key={item.id} className={visibilityClass}>
                          <AnimeCard item={item} index={i} />
                        </div>
                      );
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
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-x-4 gap-y-6 px-5 md:px-0 pt-3 -mt-3"
                  >
                    {Array.from({ length: 20 }).map((_, i) => {
                      const visibilityClass =
                        i < 4
                          ? "block"
                          : i < 6
                          ? "hidden sm:block"
                          : i < 8
                          ? "hidden md:block"
                          : i < 10
                          ? "hidden lg:block"
                          : i < 12
                          ? "hidden xl:block"
                          : i < 14
                          ? "hidden 2xl:block"
                          : i < 16
                          ? "hidden 3xl:block"
                          : "hidden 4xl:block";
                      return (
                        <div
                          key={i}
                          className={cn("aspect-[2/3] w-full shrink-0 rounded-2xl shimmer", visibilityClass)}
                          style={{ animationDelay: `${i * 80}ms` }}
                        />
                      );
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
