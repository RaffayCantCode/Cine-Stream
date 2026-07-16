"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { AnimePlayer } from "@/components/AnimePlayer";
import { AnimeRow } from "@/components/AnimeRow";
import { AnimeCard } from "@/components/AnimeCard";
import { CastRow } from "@/components/CastRow";
import { CinematicHero } from "@/components/CinematicHero";
import { fetchJson, cn, getRecommendationReason } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";
import { Star, ArrowLeft, ChevronLeft, ChevronRight, Lock, Play, ExternalLink, BookOpen, Loader2, LayoutGrid, List, Users } from "lucide-react";

// ── Client-side AniList helpers ────────────────────────────────────────────
const ANIME_API_VERSION = "anime-filler-fix-v7";
const ANILIST_API = "https://graphql.anilist.co";

async function anilistQuery(query: string, variables: Record<string, any>): Promise<any> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("AniList query failed");
  return res.json();
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
    description: media.description?.replace(/<[^>]*>/g, "") || "",
    genres: media.genres || [],
    status: media.status || null,
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    format: media.format || null,
  };
}

async function fetchAnilistRecommendations(anilistId: number, excludeIds: Set<string>, minItems = 12): Promise<any[]> {
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
  } catch { /* recommendations failed */ }

  if (items.length < minItems) {
    try {
      const existingIds = new Set(items.map((i: any) => i.id));
      const seenGenres = new Set<string>();
      items.forEach((i: any) => i.genres?.forEach((g: string) => seenGenres.add(g)));
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
    } catch { /* padding failed */ }
  }

  const seen = new Set<string>();
  items = items.filter((item: any) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return items.slice(0, Math.max(minItems, 20));
}

async function getAniZipMappingClientSide(anilistId: number) {
  try {
    const res = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      const tmdbId = data.mappings?.themoviedb_id ? parseInt(data.mappings.themoviedb_id, 10) : null;
      const azEp1 = data.episodes?.["1"];
      const tmdbSeasonNumber = typeof azEp1?.seasonNumber === "number" ? azEp1.seasonNumber : null;
      const episodeOffset = typeof azEp1?.episodeNumber === "number" ? azEp1.episodeNumber - 1 : null;
      const hasEpisodeMapping = tmdbId != null && tmdbSeasonNumber != null && episodeOffset != null;
      return { tmdbId, tmdbSeasonNumber, episodeOffset, hasEpisodeMapping };
    }
  } catch (e) {
    console.warn(`[AniZip Client] Failed to fetch mappings for ${anilistId}`, e);
  }
  return null;
}

async function fetchFranchiseClientSide(startId: number) {
  // Query fetches the node's OWN metadata AND its relation edges
  const RELATIONS_QUERY = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id idMal title { romaji english native } episodes season seasonYear format bannerImage coverImage { large extraLarge }
      relations { edges { relationType node { id idMal title { romaji english native } episodes season seasonYear format type isAdult bannerImage coverImage { large extraLarge } } } }
    }
  }`;
  
  const visited = new Map<number, any>();
  const queue = [startId];
  let hops = 0;
  
  while (queue.length > 0 && visited.size < 150 && hops < 15) {
    const batch = queue.splice(0, queue.length);
    hops++;
    
    await Promise.all(batch.map(async (nodeId) => {
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ query: RELATIONS_QUERY, variables: { id: nodeId } }),
          signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.data?.Media) return;
        
        const media = data.data.Media;
        // Register this node with its OWN data (title, format, etc.)
        if (!visited.has(media.id)) {
          visited.set(media.id, {
            id: media.id, idMal: media.idMal || null, episodes: media.episodes,
            season: media.season, seasonYear: media.seasonYear, format: media.format,
            title: media.title?.english || media.title?.romaji || media.title?.native || "",
            bannerImage: media.bannerImage || null,
            coverImage: media.coverImage?.extraLarge || media.coverImage?.large || null
          });
        }
        
        // Traverse SEQUEL, PREQUEL, ALTERNATIVE, PARENT relations
        const edges = media.relations?.edges || [];
        for (const edge of edges) {
          if (!edge.node) continue;
          const rType = edge.relationType;
          if (!["PREQUEL", "SEQUEL", "ALTERNATIVE", "PARENT"].includes(rType)) continue;
          if (edge.node.type !== "ANIME" || edge.node.isAdult) continue;
          const relId = edge.node.id;
          if (!visited.has(relId) && !queue.includes(relId)) {
            // Pre-populate with relation data so we have title even if we can't fetch its own page
            visited.set(relId, {
              id: relId, idMal: edge.node.idMal || null, episodes: edge.node.episodes,
              season: edge.node.season, seasonYear: edge.node.seasonYear, format: edge.node.format,
              title: edge.node.title?.english || edge.node.title?.romaji || edge.node.title?.native || "",
              bannerImage: edge.node.bannerImage || null,
              coverImage: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || null
            });
            queue.push(relId);
          }
        }
      } catch (e) { /* ignore */ }
    }));
  }
  
  const nodes = Array.from(visited.values()).filter(n => n.title); // Drop nodes with no title
  
  // Filter out the 3 unrelated/redundant Fate movies/OVAs
  const EXCLUDED_IDS = new Set([6922, 19165, 12565]);
  const filteredNodes = nodes.filter(n => !EXCLUDED_IDS.has(Number(n.id)));

  const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
  return filteredNodes.sort((a, b) => {
    // Custom chronological order for the Fate series
    const FATE_ORDER = [10087, 11741, 356, 19603, 20792, 20791, 21718, 21719];
    const idxA = FATE_ORDER.indexOf(Number(a.id));
    const idxB = FATE_ORDER.indexOf(Number(b.id));
    
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    const yearA = a.seasonYear || 9999;
    const yearB = b.seasonYear || 9999;
    if (yearA !== yearB) return yearA - yearB;
    const formatOrder = { TV: 0, TV_SHORT: 1, ONA: 2, OVA: 3, SPECIAL: 4, MOVIE: 5 };
    const fA = (formatOrder as any)[a.format || "TV"] ?? 6;
    const fB = (formatOrder as any)[b.format || "TV"] ?? 6;
    if (fA !== fB) return fA - fB;
    return seasonOrder.indexOf(a.season || "FALL") - seasonOrder.indexOf(b.season || "FALL");
  });
}

async function fetchAnimeMetaClientSide(idStr: string) {
  if (!idStr) return null;
  const isMal = idStr.startsWith("mal-");
  const parsedId = parseInt(idStr.replace("mal-", ""), 10);
  if (isNaN(parsedId)) return null;

  const query = isMal 
    ? `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME, isAdult: false) {
          id idMal title { romaji english native } coverImage { large extraLarge }
          episodes genres averageScore description status type format season seasonYear duration trailer { id site }
        }
      }`
    : `query ($id: Int) {
        Media(id: $id, type: ANIME, isAdult: false) {
          id idMal title { romaji english native } coverImage { large extraLarge }
          episodes genres averageScore description status type format season seasonYear duration trailer { id site }
        }
      }`;

  const variables = isMal ? { idMal: parsedId } : { id: parsedId };

  try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(4000)
      });
    if (!res.ok) return null;
    const json = await res.json();
    const media = json?.data?.Media;
    if (!media) return null;

    const anime: AnimeDetail = {
      id: String(media.id),
      idMal: media.idMal ? String(media.idMal) : null,
      name: media.title?.english || media.title?.romaji || media.title?.native || "Unknown",
      jname: media.title?.native || null,
      poster: media.coverImage?.extraLarge || media.coverImage?.large || "",
      description: media.description || "",
      type: media.format || media.type || "TV",
      rating: media.averageScore ? String(media.averageScore) : null,
      score: media.averageScore ? String(media.averageScore) : null,
      status: media.status || null,
      genres: media.genres || [],
      totalEpisodes: media.episodes || 12,
      seasons: [],
      season: media.season || null,
      seasonYear: media.seasonYear || null,
      format: media.format || null,
      openedSeasonId: String(media.id),
      tmdbId: null,
      duration: media.duration || null,
      trailerId: media.trailer?.site === "youtube" ? media.trailer.id : null,
    };

    // Get franchise nodes
    const clientNodes = await fetchFranchiseClientSide(media.id);
    const finalSeasons = clientNodes.map(node => {
      const isCurrent = node.id === media.id;
      return {
        id: String(node.id),
        idMal: node.idMal || null,
        name: node.title,
        totalEpisodes: node.episodes || 12,
        seasonLabel: `${node.season || ""} ${node.seasonYear || ""}`.trim() || node.format || "Unknown",
        episodeOffset: 0,
        isCurrent,
        seasonYear: node.seasonYear || null,
        tmdbId: null,
        tmdbSeasonNumber: null,
      } as any;
    });
    anime.seasons = finalSeasons;

    return {
      success: true,
      data: {
        anime,
        franchiseNodes: clientNodes,
      }
    };
  } catch (e) {
    console.error("[Anime Client Fallback Meta] Error fetching client side", e);
  }
  return null;
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

export default function AnimeClient() {
  const params = useParams();
  const id = params?.id as string;
  const { data: session, status: authStatus } = useSession();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [episodeNotice, setEpisodeNotice] = useState<string | null>(null);

  // Franchise node data for Season Guide
  const [franchiseNodes, setFranchiseNodes] = useState<FranchiseNode[]>([]);
  const [showSeasonGuide, setShowSeasonGuide] = useState(false);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  const tmdbIdRef = useRef<number | null>(null);
  const animeStatusRef = useRef<string | null>(null);
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
  const selectedQueueEpRef = useRef<HTMLButtonElement>(null);

  // Tracks which seasonIds we have already loaded episodes for
  const loadedSeasonIds = useRef<Set<string>>(new Set());

  function isAnimeOngoing(status: string | null | undefined): boolean {
    const normalized = (status || "").toLowerCase();
    return normalized.includes("airing") || normalized.includes("releasing") || normalized.includes("not_yet");
  }

  function isFutureDate(dateValue: string | null | undefined): boolean {
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() > Date.now() + 60 * 60 * 1000;
  }

  function isWithinNextDays(dateValue: string | null | undefined, days = 7): boolean {
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    const now = Date.now();
    return date.getTime() >= now && date.getTime() <= now + days * 24 * 60 * 60 * 1000;
  }

  function isEpisodeReleased(ep: Episode, status?: string | null): boolean {
    if (!isAnimeOngoing(status)) return true;
    if (!isFutureDate(ep.releasedDate)) return true;

    // If episode metadata came from an actual episode source, prefer availability
    // over a suspicious future date. This avoids locking already released anime.
    const hasSourceBackedMetadata = Boolean(ep.malUrl || ep.thumbnail || ep.vote_count || ep.runtime);
    return hasSourceBackedMetadata;
  }

  // ── Fetch episodes for a specific season by its AniList ID ─────────────
  // NOTE: Must be defined before the meta useEffect that calls it
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
    // Always send tmdbSeason and episodeOffset when known — never skip on 0 (falsy)
    const tmdbSeasonQuery = clientTmdbSeason != null ? `&tmdbSeason=${clientTmdbSeason}` : "";
    const episodeOffsetQuery = clientEpisodeOffset != null ? `&episodeOffset=${clientEpisodeOffset}` : "";

    try {
      const epData = await fetchJson<{ success: boolean; data: { episodes: Episode[]; seasonOverview?: string | null } }>(
        `/api/anime/${id}/episodes?seasonId=${encodeURIComponent(seasonId)}${tmdbIdQuery}${tmdbSeasonQuery}${episodeOffsetQuery}&v=${ANIME_API_VERSION}`,
        { skipCache: true }
      );
      if (epData.success && epData.data?.episodes?.length) {
        const sorted = epData.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        const withRelease = sorted.map(ep => ({
          ...ep, isReleased: isEpisodeReleased(ep, animeStatusRef.current)
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
    if (!id || authStatus === "loading") return;
    if (anime && anime.id === id) return; // Prevent re-fetching and flickering when session/authStatus changes

    let cancelled = false;
    loadedSeasonIds.current.clear();
    tmdbIdRef.current = null;

    const loadMeta = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let data: any = null;
        try {
          data = await fetchJson<{ success: boolean; data: { anime: AnimeDetail; franchiseNodes?: FranchiseNode[]; tmdbSeasonMap?: Record<string, number> } }>(
            `/api/anime/${id}/meta?v=${ANIME_API_VERSION}`,
            { signal: AbortSignal.timeout(15000), skipCache: true }
          );
        } catch (e) {
          console.warn("[Anime Client] Server meta fetch failed, trying client side fallback...", e);
        }

        if (!data || !data.success || !data.data?.anime) {
          console.log("[Anime Client] Server meta returned degraded or failed response. Trying client-side AniList query...");
          const fallbackData = await fetchAnimeMetaClientSide(id);
          if (fallbackData) {
            data = fallbackData;
          }
        }

        if (cancelled) return;
        if (data && data.success && data.data?.anime) {
          const a = data.data.anime;
          animeStatusRef.current = a.status || null;
          setIsLoading(false); // Set false before setting anime to avoid cancelled effect skipping
          setAnime(a);
          if (data.data.franchiseNodes) setFranchiseNodes(data.data.franchiseNodes);
          tmdbIdRef.current = a.tmdbId || null;

          // Determine which season should be pre-selected:
          // 1) Explicit season via URL (mapped from TMDB seasonNum to AniList ID)
          // 2) The openedSeasonId returned by the server
          // 3) Fallback: the first season in the list
          const seasons = a.seasons || [];
          let urlSeasonId: string | null = null;
          const searchParams = new URLSearchParams(window.location.search);
          const urlSeasonNum = Number(searchParams.get("season") || "");
          
          let savedState: any = null;
          try {
            const userId = session?.user?.id || "guest";
            const saved = localStorage.getItem(`sv_anime_state_${userId}_${id}`);
            if (saved) savedState = JSON.parse(saved);
          } catch {}

          // ── Fallback strategy for missing server data ───────────────────
          // Case 1: Server has seasons but no/sparse franchiseNodes → derive nodes from seasons (fast)
          // Case 2: Server has no seasons either → run client-side BFS (slower but complete)
          let finalSeasons = seasons;
          const serverFranchiseNodes = data.data.franchiseNodes || [];

          if (finalSeasons.length <= 1) {
            // Full BFS fallback: server had no franchise data at all
            const clientNodes = await fetchFranchiseClientSide(Number(id));
            if (clientNodes.length > 1) {
              // Map nodes to seasons
              finalSeasons = clientNodes.map(node => {
                const isCurrent = node.id === Number(id);
                if (isCurrent) urlSeasonId = String(node.id);
                const res = {
                  id: String(node.id),
                  idMal: node.idMal || null,
                  name: node.title,
                  totalEpisodes: node.episodes || 12,
                  seasonLabel: `${node.season || ""} ${node.seasonYear || ""}`.trim() || node.format || "Unknown",
                  episodeOffset: node.episodeOffset || 0,
                  isCurrent,
                  seasonYear: node.seasonYear || null,
                  tmdbId: node.tmdbId || null,
                  tmdbSeasonNumber: node.tmdbSeasonNumber || null,
                } as any;
                return res;
              });
              setFranchiseNodes(clientNodes);
              setAnime(prev => prev ? { ...prev, seasons: finalSeasons } : prev);
            }
          } else if (serverFranchiseNodes.length <= 1) {
            // Derive franchiseNodes from seasons (no extra API call needed)
            const derivedNodes: FranchiseNode[] = finalSeasons
              .filter((s: SeasonInfo) => !String(s.id).startsWith("tmdb-") && s.name)
              .map((s: SeasonInfo) => ({
                id: Number(s.id),
                idMal: (s as any).idMal || null,
                title: s.name,
                episodes: s.totalEpisodes || null,
                season: null,
                seasonYear: (s as any).seasonYear || null,
                format: s.seasonLabel?.startsWith("Movie") ? "MOVIE"
                  : s.seasonLabel?.startsWith("OVA") ? "OVA"
                  : s.seasonLabel?.startsWith("Special") ? "SPECIAL" : "TV",
              }));
            if (derivedNodes.length > 1) {
              setFranchiseNodes(derivedNodes);
            }
          }

          if (urlSeasonNum > 0 && data.data.tmdbSeasonMap) {
            const entry = Object.entries(data.data.tmdbSeasonMap).find(([_, num]) => num === urlSeasonNum);
            if (entry) urlSeasonId = entry[0];
          } else if (searchParams.get("seasonId")) {
            urlSeasonId = searchParams.get("seasonId");
          } else if (savedState?.seasonId) {
            urlSeasonId = savedState.seasonId;
          } else if (data.data.anime.openedSeasonId) {
            urlSeasonId = data.data.anime.openedSeasonId;
          }

          // Find it in the season list
          const matchingSeason = finalSeasons.find((s: SeasonInfo) => s.id === urlSeasonId);
          const activeSeason = matchingSeason || finalSeasons[0];
          const activeSeasonId = activeSeason?.id || urlSeasonId || id;

          setCurrentSeasonId(activeSeasonId);

          // Load the active season's episodes immediately with exact mapping parameters
          loadSeasonEpisodes(
            activeSeasonId,
            false,
            activeSeason?.tmdbId,
            activeSeason?.tmdbSeasonNumber,
            activeSeason?.episodeOffset
          );
        } else {
          throw new Error("Anime not found");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load anime");
          setIsLoading(false);
        }
      }
    };

    loadMeta();
    return () => { cancelled = true; };
  }, [id, loadSeasonEpisodes, authStatus, session]);

  // ── Fetch You May Like recommendations (client-side AniList) ────────────
  useEffect(() => {
    if (!anime || !id) return;
    setRecsLoading(true);
    const franchiseIds = new Set(franchiseNodes.map(n => String(n.id)).filter(Boolean));
    const excludeIds = new Set([id, ...franchiseIds]);
    fetchAnilistRecommendations(Number(id), excludeIds, 12)
      .then(items => {
        if (items.length > 0) {
          const withReasons = items.map((item: any) => ({
            ...item,
            reason: getRecommendationReason(anime.genres?.map(g => g.charCodeAt(0)) || [], item.genres?.map((g: string) => g.charCodeAt(0)) || [])
          }));
          setRecommendations(withReasons);
        }
      })
      .catch(() => {})
      .finally(() => setRecsLoading(false));
  }, [anime?.id, id, franchiseNodes]);

  // ── Background Mapping Verification & Suspicious Mapping Corrector ─────
  useEffect(() => {
    if (isLoading || !anime || !anime.seasons || anime.seasons.length <= 1) return;

    let active = true;

    const isMappingSuspicious = (s: SeasonInfo) => {
      if (s.tmdbSeasonNumber === undefined || s.tmdbSeasonNumber === null || s.tmdbSeasonNumber === 1) {
        const label = s.seasonLabel.toLowerCase();
        if (
          label.includes("season 2") || 
          label.includes("season 3") || 
          label.includes("season 4") || 
          label.includes("season 5") || 
          label.includes("season 6") || 
          label.includes("final season")
        ) {
          return true;
        }
      }
      return false;
    };

    const verifyMappings = async () => {
      const updatedSeasons = [...anime.seasons];
      let changed = false;

      await Promise.all(
        anime.seasons.map(async (s, idx) => {
          const needsVerify = s.tmdbSeasonNumber === undefined || 
                              s.tmdbSeasonNumber === null || 
                              (s as any).episodeOffset === undefined ||
                              isMappingSuspicious(s);
          if (needsVerify) {
            const mapping = await getAniZipMappingClientSide(Number(s.id));
            if (mapping?.hasEpisodeMapping && active) {
              const current = updatedSeasons[idx];
              // Resolve effective values — mapping values win only if they are not null
              const resolvedTmdbId = mapping.tmdbId ?? (current as any).tmdbId;
              const resolvedTmdbSeason = mapping.tmdbSeasonNumber;
              const resolvedOffset = mapping.episodeOffset;
              const currentOffset = (current as any).episodeOffset ?? 0;
              
              const effectivelyChanged = 
                resolvedTmdbSeason !== current.tmdbSeasonNumber ||
                resolvedOffset !== currentOffset ||
                resolvedTmdbId !== (current as any).tmdbId;

              if (effectivelyChanged && resolvedTmdbSeason != null && resolvedOffset != null) {
                console.log(`[Anime Mappings] Background correction for "${s.name}": tmdbSeasonNumber=${resolvedTmdbSeason}, episodeOffset=${resolvedOffset}`);
                updatedSeasons[idx] = {
                  ...current,
                  tmdbId: resolvedTmdbId,
                  tmdbSeasonNumber: resolvedTmdbSeason,
                  episodeOffset: resolvedOffset,
                } as any;
                changed = true;
              }
            }
          }
        })
      );

      if (changed && active) {
        setAnime(prev => prev ? { ...prev, seasons: updatedSeasons } : prev);
        
        // Also force a reload of the current season episodes if they are currently loaded
        // but might have used the incorrect mapping earlier
        const currentActiveSeason = updatedSeasons.find(s => s.id === currentSeasonId);
        if (currentActiveSeason) {
          loadSeasonEpisodes(
            currentSeasonId,
            true, // forceReload = true
            (currentActiveSeason as any).tmdbId,
            currentActiveSeason.tmdbSeasonNumber,
            (currentActiveSeason as any).episodeOffset
          );
        }
      }
    };

    verifyMappings();
    return () => { active = false; };
  }, [isLoading, anime?.id, anime?.seasons?.length, currentSeasonId, loadSeasonEpisodes]);

  // ── Autoplay via URL params & LocalStorage ────────────────────────────
  useEffect(() => {
    if (episodes.length === 0 || typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    const autoPlay = searchParams.get("autoplay") === "1";
    const episodeParam = Number(searchParams.get("episode") || "");
    const seasonIdParam = searchParams.get("seasonId") || "";
    const legacySeasonParam = Number(searchParams.get("season") || "");

    let target: Episode | undefined;

    if (episodeParam > 0) {
      target = episodes.find(ep => {
        const matchesSeasonId = seasonIdParam ? ep.seasonId === seasonIdParam : true;
        const matchesLegacySeason = legacySeasonParam ? ep.seasonNum === legacySeasonParam : true;
        return matchesSeasonId && matchesLegacySeason && ep.episodeNum === episodeParam;
      });
    }

    // Fallback to localStorage if no URL params specify an episode
    if (!target && !episodeParam) {
      try {
        const userId = session?.user?.id || "guest";
        const saved = localStorage.getItem(`sv_anime_state_${userId}_${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.episodeId) {
            target = episodes.find(ep => ep.episodeId === parsed.episodeId);
          }
        }
      } catch {}
    }

    if (target && !selectedEp) {
      setSelectedEp(target);
      if (autoPlay) {
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
                season: target.seasonNum || 1,
                episode: target.episodeNum,
                episodeName: target.title || `Episode ${target.episodeNum}`,
              }),
            }).catch(() => {});
          }
        }
        setIsPlaying(true);
      }
    }

    if (!hasRestoredState) {
      setHasRestoredState(true);
    }
  }, [episodes, id, selectedEp, session?.user?.id, authStatus, anime, hasRestoredState]);

  // Persist State
  useEffect(() => {
    if (typeof window !== "undefined" && currentSeasonId && hasRestoredState) {
      try {
        const userId = session?.user?.id || "guest";
        localStorage.setItem(`sv_anime_state_${userId}_${id}`, JSON.stringify({
          seasonId: currentSeasonId,
          episodeId: selectedEp?.episodeId || null
        }));
      } catch {}
    }
  }, [id, currentSeasonId, selectedEp, session?.user?.id, hasRestoredState]);

  // ── Scroll to player on play ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedEp || !isPlaying || episodesLoading) return;
    const timer = setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedEp?.episodeId, isPlaying, episodesLoading]);

  // Keep the player queue aligned with the active episode for long seasons.
  useEffect(() => {
    if (!selectedEp || !isPlaying || episodesLoading) return;
    const timer = setTimeout(() => {
      selectedQueueEpRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedEp?.episodeId, isPlaying, episodesLoading, currentSeasonId]);

  // ── Season overview text from TMDB (included in episodes response) ────
  // The episodes endpoint now returns TMDB-enriched data directly with seasonOverview

  // ── Season click handler ────────────────────────────────────────────────
  const handleSeasonClick = useCallback((season: SeasonInfo) => {
    if (season.id === currentSeasonId) return;
    setCurrentSeasonId(season.id);
    setIsPlaying(false);
    setSelectedEp(null);
    setEpisodeNotice(null);
    loadSeasonEpisodes(
      season.id,
      false,
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

  // ── Watch episode handler ───────────────────────────────────────────────
  const handleWatchEpisode = useCallback((ep: Episode) => {
    if (ep.isReleased === false) {
      setEpisodeNotice(`Episode ${ep.episodeNum} hasn't been released yet.`);
      return;
    }
    setEpisodeNotice(null);
    setSelectedEp(ep);
    setIsPlaying(true);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (ep.seasonId) {
        url.searchParams.set("seasonId", ep.seasonId);
      }
      url.searchParams.set("episode", ep.episodeNum.toString());
      window.history.replaceState({}, "", url.toString());
    }

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
  const INITIAL_EPISODES_PER_PAGE = 50;

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

  const upcomingAnimeThisWeek = useMemo(
    () => currentSeasonEps
      .filter(ep => ep.isReleased === false && isWithinNextDays(ep.releasedDate, 7))
      .sort((a, b) => new Date(a.releasedDate || "").getTime() - new Date(b.releasedDate || "").getTime())[0] || null,
    [currentSeasonEps]
  );

  const [visibleCount, setVisibleCount] = useState(INITIAL_EPISODES_PER_PAGE);

  // Reset visible count when season changes
  useEffect(() => {
    setVisibleCount(INITIAL_EPISODES_PER_PAGE);
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
    const sId = selectedEp?.seasonId || currentSeasonId;
    if (sId && sId.startsWith("tmdb-")) return anime?.id || sId;
    return sId || "";
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

  const displayPoster = currentSeasonInfo?.coverImage || anime?.poster || "";
  const displayBanner = currentSeasonInfo?.bannerImage || currentSeasonInfo?.coverImage || anime?.poster || "";
  const displayTitle = currentSeasonInfo?.name || anime?.name || "";

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

      <main className="md:pl-56 lg:pl-64 pt-0 bleed-header select-none">
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
            <CinematicHero
              backdropPath={displayBanner}
              trailerId={anime.trailerId}
              title={displayTitle}
              theme="anime"
            >
              <div className="relative z-10 pb-6 md:pb-16 px-5 md:px-12 flex flex-row items-center md:items-end gap-4 sm:gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
                <div
                  className="shrink-0 w-28 sm:w-36 md:w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10"
                >
                  <img src={displayPoster} alt={displayTitle} className="w-full h-full object-cover" />
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
                  <h1 className="font-black text-2xl sm:text-4xl md:text-5xl text-white leading-tight tracking-tight select-text">{displayTitle}</h1>
                  {anime.jname && <p className="text-white/40 text-xs sm:text-sm font-medium select-text">{anime.jname}</p>}

                  {/* Season count pill */}
                  {seasons.length > 1 && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-[#7288AE] bg-[#4B5694]/15 border border-[#7288AE]/20 px-2.5 py-0.5 rounded-full">
                        {seasons.filter(s => s.seasonLabel?.startsWith("Season")).length} Seasons
                        {seasons.filter(s => !s.seasonLabel?.startsWith("Season")).length > 0 && ` + ${seasons.filter(s => !s.seasonLabel?.startsWith("Season")).length} More`}
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
                      <div className="flex items-center flex-wrap gap-4 w-full">
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
                      </div>
                    ) : !episodesLoading ? (
                      <button disabled className="flex items-center gap-2.5 bg-white/10 text-white/30 font-bold px-8 py-4 rounded-xl text-sm cursor-not-allowed">
                        No Episodes Available
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </CinematicHero>

            {/* ── Main Content ── */}
            <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-6">
              <Link href="/anime" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Anime
              </Link>

              <div className="flex flex-col gap-6">
                {episodeNotice && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
                    {episodeNotice}
                  </div>
                )}
                {upcomingAnimeThisWeek && (
                  <div className="rounded-2xl border border-sky-300/20 bg-gradient-to-r from-sky-400/10 to-[#7288AE]/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-sm font-black text-white">New episode this week</div>
                      <div className="text-xs text-white/55 mt-0.5">
                        Episode {upcomingAnimeThisWeek.episodeNum}
                        {upcomingAnimeThisWeek.title ? ` - ${upcomingAnimeThisWeek.title}` : ""} is expected {new Date(upcomingAnimeThisWeek.releasedDate || "").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}.
                      </div>
                    </div>
                    <span className="w-fit rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-sky-200">
                      Weekly release
                    </span>
                  </div>
                )}
                {/* ── Player + Queue ── */}
                {isPlaying && selectedEp && (
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 select-none">
                    <div ref={playerRef} className="w-full min-w-0">
                      {!episodesLoading && (
                          <AnimePlayer
                            key={selectedEp.episodeId}
                            animeId={streamingAnimeId}
                            malId={streamingMalId}
                            animeTitle={selectedEp.seasonName || anime.name}
                            episode={selectedEp.episodeNum}
                            rootAnimeId={rootSeason?.id || anime?.id}
                            rootMalId={rootSeason?.idMal ? String(rootSeason.idMal) : (anime?.idMal || null)}
                            episodeOffset={currentEpisodeOffset}
                            tmdbId={currentSeason?.tmdbId || anime?.tmdbId || null}
                            tmdbSeason={currentSeason?.tmdbSeasonNumber ?? null}
                            isMovie={anime?.format === 'MOVIE' || anime?.format === 'SPECIAL'}
                          startProgress={typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get("t") || 0) : 0}
                          onAutoNext={handleAutoNext}
                        />
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
                          <div className="text-sm font-bold text-white flex items-center justify-between gap-2">
                            <span className="truncate">
                              {franchiseNodes.find(n => String(n.id) === currentSeasonId)?.title || currentSeasonInfo?.seasonLabel || "Episodes"}
                            </span>
                            <span className="text-xs font-normal text-white/40 whitespace-nowrap">{currentSeasonEps.length} eps</span>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                          {currentSeasonEps.map((ep) => {
                            const isSelected = selectedEp?.episodeId === ep.episodeId;
                            const displayTitle = ep.title || `Episode ${ep.episodeNum}`;
                            return (
                              <button
                                key={ep.episodeId}
                                ref={isSelected ? selectedQueueEpRef : undefined}
                                onClick={() => {
                                  handleWatchEpisode(ep);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-3 ${
                                  isSelected
                                    ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/20"
                                    : ep.isReleased === false
                                    ? "bg-white/[0.025] text-white/30 hover:bg-amber-400/10 hover:text-amber-200 border border-amber-400/10"
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
                                {ep.isReleased === false && (
                                  <span className="text-[9px] text-sky-300 font-extrabold uppercase bg-sky-300/10 border border-sky-300/20 px-1.5 py-0.5 rounded shrink-0">Upcoming</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </aside>
                    )}
                  </div>
                )}

                {/* ── Details ── */}
                <div className="w-full">
                  <div className="bg-white/[0.02] border border-white/[0.06] p-6 rounded-2xl space-y-5">
                    <h3 className="text-base font-bold text-white">Details</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-6 gap-x-4 text-xs">
                      <div>
                        <span className="text-white/40 block mb-2 uppercase tracking-wider font-semibold text-[10px]">Format</span>
                        <span className="text-white font-bold text-sm bg-white/[0.06] border border-white/[0.05] px-3 py-1.5 rounded-lg uppercase">{anime.format || anime.type || "TV"}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block mb-2 uppercase tracking-wider font-semibold text-[10px]">Rating</span>
                        <span className="text-amber-400 font-bold text-sm bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 w-max shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                          <Star className="w-4 h-4 fill-current" /> 
                          {anime.rating || anime.score ? (Number(anime.rating || anime.score) > 10 ? (Number(anime.rating || anime.score) / 10).toFixed(1) : Number(anime.rating || anime.score).toFixed(1)) : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 block mb-2 uppercase tracking-wider font-semibold text-[10px]">Seasons</span>
                        <span className="text-white font-bold text-sm bg-white/[0.06] border border-white/[0.05] px-3 py-1.5 rounded-lg">{seasons.length || 1}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block mb-2 uppercase tracking-wider font-semibold text-[10px]">Status</span>
                        <span className="text-emerald-400 font-bold text-sm bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 rounded-lg uppercase shadow-[0_0_15px_rgba(52,211,153,0.1)]">{anime.status || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block mb-2 uppercase tracking-wider font-semibold text-[10px]">Year</span>
                        <span className="text-white font-bold text-sm bg-white/[0.06] border border-white/[0.05] px-3 py-1.5 rounded-lg">{anime.seasonYear || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Episodes Section ── */}
              <section className="max-w-5xl mx-auto space-y-4 mt-10">
                {/* ── Watch Order Section (franchise order reference) ── */}
                {(() => {
                  const visibleFranchiseNodes = franchiseNodes.filter(node => {
                    if (!node.title) return false;
                    if (String(node.id) === anime?.id) return true;
                    
                    const format = node.format;
                    if (format === "TV" || format === "TV_SHORT" || format === "ONA" || format === "MOVIE") {
                      return true;
                    }
                    
                    if (format === "SPECIAL" || format === "OVA") {
                      const lowerTitle = node.title.toLowerCase();
                      const plotKeywords = ["final", "part", "chapter", "season", "arc", "prologue", "epilogue", "special"];
                      return plotKeywords.some(kw => lowerTitle.includes(kw));
                    }
                    
                    return false;
                  });
                  if (visibleFranchiseNodes.length <= 1) return null;
                  return (
                  <div className="bg-gradient-to-br from-white/[0.045] to-white/[0.015] border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                    <button
                      onClick={() => setShowSeasonGuide(!showSeasonGuide)}
                      className="flex items-center justify-between w-full text-left px-5 py-4 hover:bg-white/[0.035] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#7288AE]/15 border border-[#7288AE]/25 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-[#9EB2D1]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white">Watch Order</h3>
                            <span className="text-[10px] text-[#9EB2D1] font-black uppercase tracking-wide bg-[#7288AE]/10 border border-[#7288AE]/20 px-2 py-0.5 rounded-full">
                              {visibleFranchiseNodes.length} parts
                            </span>
                          </div>
                          <p className="text-xs text-white/40 mt-0.5 truncate">Follow the franchise in the recommended order</p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-white/40 transition-transform ${showSeasonGuide ? "rotate-90" : ""}`} />
                    </button>

                    {showSeasonGuide && (
                      <div className="px-4 sm:px-5 pb-5 border-t border-white/[0.06] pt-4">
                        <div className="relative space-y-2">
                        {visibleFranchiseNodes.map((node, orderIndex) => {
                          const nodeId = String(node.id);
                          const isActive = nodeId === currentSeasonId || nodeId === anime?.id;
                          const formatLabel = node.format === "TV" ? "TV" : node.format || "";
                          return (
                            <Link
                              key={node.id}
                              href={`/anime/${node.id}`}
                              className={`w-full grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                                isActive
                                  ? "bg-gradient-to-r from-[#111844]/45 to-[#7288AE]/25 border border-[#7288AE]/40 text-white shadow-lg shadow-[#111844]/20"
                                  : "bg-white/[0.035] hover:bg-white/[0.075] border border-white/[0.06] text-white/60 hover:text-white"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[11px] border ${
                                isActive ? "bg-[#7288AE]/25 border-[#7288AE]/45 text-white" : "bg-white/[0.04] border-white/[0.07] text-white/35"
                              }`}>
                                {orderIndex + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate font-bold">{node.title}</span>
                                  {isActive && <span className="shrink-0 text-[9px] uppercase tracking-wide bg-[#7288AE]/20 text-[#C7D4EA] border border-[#7288AE]/30 px-1.5 py-0.5 rounded">Current</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/35">
                                  <span className="uppercase font-black text-[#9EB2D1]">{formatLabel || "Entry"}</span>
                                  {node.seasonYear && <span>{node.seasonYear}</span>}
                                  <span>{node.episodes || "?"} eps</span>
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-white/25" />
                            </Link>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })()}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full shadow-lg" />
                      <h2 className="text-2xl font-black text-white tracking-tight">Episodes</h2>
                      {currentSeasonInfo && (
                        <span className="text-xs bg-white/[0.06] text-white/50 px-2.5 py-1 rounded-full font-semibold">
                          {currentSeasonInfo.seasonLabel}
                        </span>
                      )}
                    </div>

                  {/* ── Right Side Controls ── */}
                  <div className="flex items-center gap-3 flex-wrap max-w-xl justify-end">
                    {!episodesLoading && currentSeasonEps.length > 0 && (
                      <button
                        onClick={() => setGridMode(g => !g)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                          gridMode 
                            ? "bg-white/[0.06] text-white/60 hover:text-white border-white/[0.06] hover:bg-white/[0.10]" 
                            : "bg-[#7288AE]/20 text-white border-[#7288AE]/50 shadow-[0_0_15px_rgba(114,136,174,0.3)] hover:bg-[#7288AE]/40"
                        )}
                        title={gridMode ? "Switch to list view" : "Switch to compact grid view (Recommended for long anime)"}
                      >
                        {gridMode ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />}
                        {gridMode ? "List View" : "Grid View"}
                      </button>
                    )}

                  </div>
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

                  const sliceEps = currentSeasonEps.slice(0, visibleCount);
                  const hasMore = visibleCount < currentSeasonEps.length;
                  const remainingEps = currentSeasonEps.length - visibleCount;
                  const loadMoreCount = remainingEps >= 100 ? 100 : remainingEps >= 50 ? 50 : Math.min(20, remainingEps);

                  if (gridMode) {
                    return (
                        <div
                          key={`grid-${currentSeasonId}`}
                        >
                          <div className="flex items-center gap-2 mb-4 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Yellow dot indicates a filler episode</span>
                          </div>
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1.5">
                            {sliceEps.map((ep) => {
                              const isSelected = selectedEp?.episodeId === ep.episodeId;
                              const isUnreleased = ep.isReleased === false;
                              return (
                                <button
                                  key={ep.episodeId}
                                  onClick={() => handleWatchEpisode(ep)}
                                  className={cn(
                                    "aspect-square rounded-lg text-xs font-bold transition-all flex items-center justify-center relative",
                                    isSelected
                                      ? "bg-gradient-to-br from-[#4B5694] to-[#7288AE] text-white shadow-md shadow-[#4B5694]/30 scale-105"
                                      : isUnreleased
                                      ? "bg-white/[0.03] text-white/20 cursor-not-allowed"
                                      : "bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border border-white/[0.06] hover:border-white/20"
                                  )}
                                >
                                  {isSelected && isPlaying && (
                                    <div className="absolute -top-2 z-20 px-1.5 py-0.5 rounded bg-[#7288AE] text-white text-[8px] font-extrabold tracking-widest uppercase shadow-sm">
                                      Playing
                                    </div>
                                  )}
                                  {ep.isFiller && !isSelected && (
                                    <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-400" />
                                  )}
                                  {isUnreleased && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-sky-400/90 px-1 text-[7px] font-black uppercase text-white">
                                      Soon
                                    </span>
                                  )}
                                  {ep.episodeNum}
                                </button>
                              );
                            })}
                          </div>
                          {hasMore && (
                            <div className="flex justify-center pt-4 pb-2">
                              <button
                                onClick={() => setVisibleCount(c => c + loadMoreCount)}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white text-sm font-bold hover:shadow-xl hover:shadow-[#4B5694]/25 transition-all"
                              >
                                Show {loadMoreCount} More Episodes
                              </button>
                            </div>
                          )}
                        </div>
                    );
                  }

                  return (
                      <div
                        key={currentSeasonId}
                      >
                        {/* Season description (TMDB overview from episodes response) */}
                        {seasonOverview && (
                          <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-2xl italic select-text">
                            {seasonOverview}
                          </p>
                        )}

                        <div className="space-y-3">
                          {sliceEps.map((ep, i) => {
                            const isSelected = selectedEp?.episodeId === ep.episodeId;
                            const isUnreleased = ep.isReleased === false;
                            const thumbSrc = ep.thumbnail
                              || (isSingleItem && displayPoster)
                              || displayPoster
                              || null;
                            const displayEpTitle = ep.title || (isSingleItem ? displayTitle : `Episode ${ep.episodeNum}`);
                            return (
                              <div
                                key={`${currentSeasonId}-${ep.episodeNum}-${ep.episodeId || 'ep'}`}
                                onClick={() => {
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
                                      alt={displayEpTitle || `Episode ${ep.episodeNum}`}
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
                                  {isSelected && isPlaying && (
                                    <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-[#7288AE] text-white text-[8px] font-extrabold tracking-widest uppercase">
                                      Playing
                                    </div>
                                  )}
                                  {isUnreleased && (
                                    <div className="absolute inset-0 z-20 bg-black/75 flex flex-col items-center justify-center gap-1">
                                      <Lock className="w-5 h-5 text-sky-300" />
                                      <span className="text-[9px] font-black uppercase tracking-wide text-sky-200">Upcoming</span>
                                    </div>
                                  )}
                                </div>

                                {/* Episode Info */}
                                <div className="flex-1 min-w-0 py-0.5">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div className="flex flex-col gap-1.5 flex-1 pr-2">
                                      <h4 className="text-[13px] md:text-sm font-bold text-white/90 leading-tight line-clamp-2">
                                        {displayEpTitle}
                                      </h4>
                                      {ep.description && (
                                        <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
                                          {ep.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {ep.vote_average && ep.vote_average > 0 && ep.vote_count && ep.vote_count > 5 ? (
                                        <div className="flex items-center gap-0.5 text-amber-400">
                                          <Star className="w-3 h-3 fill-current" />
                                          <span className="font-bold text-xs">{ep.vote_average.toFixed(1)}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  {ep.releasedDate && (
                                    <p className="text-[10px] text-white/30 mb-1 font-medium">
                                      {new Date(ep.releasedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                    </p>
                                  )}

                                  {ep.runtime && ep.runtime > 0 && (
                                    <p className="text-white/30 text-xs mt-1.5">{ep.runtime} min</p>
                                  )}
                                  {isUnreleased && (
                                    <p className="mt-2 w-fit rounded-md border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">
                                      Not released yet
                                    </p>
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
                                onClick={() => setVisibleCount(c => c + loadMoreCount)}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#4B5694] to-[#7288AE] text-white text-sm font-bold hover:shadow-xl hover:shadow-[#4B5694]/25 transition-all"
                              >
                                Show {loadMoreCount} More Episodes
                              </button>
                            </div>
                          )}
                        </div>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 px-5 md:px-0">
                  {recommendations.map((item: any, i: number) => (
                    <AnimeCard key={item.id} item={item} index={i} />
                  ))}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 px-5 md:px-0">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] w-full shrink-0 rounded-2xl shimmer" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
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
