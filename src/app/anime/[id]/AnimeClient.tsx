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
import { CinematicHero, useCinematicHero } from "@/components/CinematicHero";
import { WatchlistButton } from "@/components/WatchlistButton";
import { EpisodeViewSelector, EpisodeListView, EpisodeGridView, EpisodeNumbersView, EpisodePagination, type EpisodeItem, type EpisodeViewMode } from "@/components/episodes/EpisodeViews";
import { usePageContentReady } from "@/lib/pageLoad";

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
import { fetchJson, cn, getRecommendationReason } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";
import { cleanAnimeDescription } from "@/lib/anime-fetch";
import { getCuratedAnimeFranchiseNodes } from "@/lib/franchises";
import { Star, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Play, ExternalLink, Loader2, Users, Film, CheckCircle2, Route, Sparkles, Tv } from "lucide-react";

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
  duration: number | null;
  coverImage?: string | null;
  bannerImage?: string | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number;
}

// ── Client-side AniList helpers ────────────────────────────────────────────
const ANIME_API_VERSION = "v34-anime-pagination-recs-onepiece-v1";
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

    // Strictly skip exact title matches (the same anime itself)
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
    } catch { /* padding failed */ }
  }

  // Fallback: If still under 12, query Kitsu category popular anime
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
    } catch { /* Kitsu recs fallback failed */ }
  }

  return balanceRecommendations(items, animeTitle, String(anilistId), excludeIds, 4, Math.max(minItems, 12));
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

async function fetchEpisodesClientSide(
  seasonId: string,
  seasonName: string,
  totalEpisodes: number,
  tmdbId?: number | null,
  tmdbSeasonNum?: number | null,
  episodeOffset?: number | null
): Promise<Episode[]> {
  try {
    // 1. Try AniZip directly from browser
    const aniZipRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${seasonId}`, {
      signal: AbortSignal.timeout(4000)
    }).catch(() => null);

    let aniZipEps: Episode[] = [];
    let mappedTmdbId = tmdbId;
    let mappedTmdbSeason = tmdbSeasonNum;
    let mappedOffset = episodeOffset ?? 0;

    if (aniZipRes?.ok) {
      const azData = await aniZipRes.json();
      if (azData?.mappings?.themoviedb_id) {
        mappedTmdbId = parseInt(azData.mappings.themoviedb_id, 10) || tmdbId;
      }
      const ep1 = azData?.episodes?.["1"];
      if (typeof ep1?.seasonNumber === "number") {
        mappedTmdbSeason = ep1.seasonNumber;
      }
      if (typeof ep1?.episodeNumber === "number") {
        mappedOffset = ep1.episodeNumber - 1;
      }

      if (azData?.episodes) {
        const isSingleCap = totalEpisodes === 1;
        for (const k of Object.keys(azData.episodes)) {
          const num = parseInt(k, 10);
          if (isNaN(num)) continue;
          if (isSingleCap && num > 1) continue;
          const ep = azData.episodes[k];
          aniZipEps.push({
            episodeId: `${seasonId}-${num}`,
            episodeNum: num,
            title: ep.title?.en || ep.title?.['x-jat'] || ep.title?.ja || `Episode ${num}`,
            description: ep.overview || ep.summary || null,
            thumbnail: ep.image || null,
            releasedDate: ep.airDate || ep.airdate || null,
            isFiller: false,
            seasonId: String(seasonId),
            seasonNum: 1,
          });
        }
      }
    }

    // 2. If TMDB mapping is known, fetch rich metadata via TMDB proxy route
    let activeTmdbId = mappedTmdbId;
    let activeTmdbSeason = mappedTmdbSeason;
    let tmdbFromSearch = false;

    // The season's own episode count is authoritative for THIS season. TMDB
    // sometimes merges multiple anime seasons into one TMDB season (e.g. My
    // Dress-Up Darling S1+S2 = TMDB S1 with 24 eps), so a TMDB season's length
    // must NEVER be trusted as this season's count. Prefer the AniList count,
    // then AniZip's own per-season episode count.
    const azMaxNum = aniZipEps.length > 0 ? Math.max(...aniZipEps.map(e => e.episodeNum)) : 0;
    const seasonOwnCount = (totalEpisodes && totalEpisodes > 0 && totalEpisodes < 1499)
      ? totalEpisodes
      : azMaxNum;

    // Fallback: If TMDB ID is missing, search TMDB for the anime title directly from browser!
    if (!activeTmdbId && seasonName) {
      try {
        const cleanName = seasonName.replace(/\b(season|part|2nd|3rd|4th|5th|final)\b.*$/i, "").trim() || seasonName;
        const searchRes = await fetch(`/api/tmdb/search?query=${encodeURIComponent(cleanName)}&type=tv`, {
          signal: AbortSignal.timeout(3000)
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const firstTv = searchData?.results?.[0];
          if (firstTv?.id) {
            activeTmdbId = firstTv.id;
            activeTmdbSeason = 1;
            tmdbFromSearch = true;
          }
        }
      } catch { /* ignore */ }
    }

    if (activeTmdbId && activeTmdbSeason != null) {
      try {
        const tmdbRes = await fetch(`/api/tmdb/tv/${activeTmdbId}/season/${activeTmdbSeason}`, {
          signal: AbortSignal.timeout(4000)
        });
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          const epsList = tmdbData?.episodes || [];
          if (epsList.length > 0) {
            // A title-searched TMDB season can be the merged S1 of a multi-season
            // show (e.g. My Dress-Up Darling S1+S2 both matching TMDB S1). Only
            // trust it as an episode SOURCE when we have some per-season count to
            // bound it; otherwise it would show another season's episodes here.
            const canTrustTmdbSource = !(tmdbFromSearch && azMaxNum === 0 && seasonOwnCount === 0);
            if (canTrustTmdbSource) {
              const result: Episode[] = [];
              const remainingTmdbEps = Math.max(epsList.length - mappedOffset, 0);
              const maxEpCount = seasonOwnCount > 0 ? seasonOwnCount : remainingTmdbEps;
              const count = Math.min(maxEpCount || remainingTmdbEps, 1500);
              for (let i = 1; i <= count; i++) {
                const azMatch = aniZipEps.find(e => e.episodeNum === i);
                const tmdbIdx = mappedOffset + i - 1;
                const tmdbEp = epsList[tmdbIdx] || epsList.find((e: any) => e.episode_number === (mappedOffset + i));

                if (!tmdbEp && !azMatch) continue;

                result.push({
                  episodeId: azMatch?.episodeId || `${seasonId}-${i}`,
                  episodeNum: i,
                  title: tmdbEp?.name || azMatch?.title || `Episode ${i}`,
                  description: tmdbEp?.overview || azMatch?.description || null,
                  thumbnail: tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : (azMatch?.thumbnail || null),
                  releasedDate: tmdbEp?.air_date || azMatch?.releasedDate || null,
                  isFiller: false,
                  seasonId,
                  seasonNum: 1,
                });
              }
              if (result.length > 0) return result.sort((a, b) => a.episodeNum - b.episodeNum);
            }
          }
        }
      } catch { /* ignore */ }
    }

    // 3. If AniZip returned episodes, return them
    if (aniZipEps.length > 0) {
      return aniZipEps.sort((a, b) => a.episodeNum - b.episodeNum);
    }

    // 4. Try Kitsu directly from browser
    try {
      const kSearch = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(seasonName)}&page[limit]=1`, { signal: AbortSignal.timeout(3000) });
      if (kSearch.ok) {
        const kJson = await kSearch.json();
        const kId = kJson.data?.[0]?.id;
        if (kId) {
          const kitsuLimit = Math.max(seasonOwnCount || 50, 1);
          const kEpsRes = await fetch(`https://kitsu.io/api/edge/anime/${kId}/episodes?page[limit]=${kitsuLimit}`, { signal: AbortSignal.timeout(4000) });
          if (kEpsRes.ok) {
            const kEpsJson = await kEpsRes.json();
            const kData = kEpsJson.data || [];
            const kEps: Episode[] = [];
            for (const ep of kData) {
              const num = ep.attributes?.number;
              if (!num) continue;
              if (seasonOwnCount > 0 && num > seasonOwnCount) continue;
              kEps.push({
                episodeId: `kitsu-${kId}-${num}`,
                episodeNum: num,
                title: ep.attributes?.canonicalTitle || ep.attributes?.title || `Episode ${num}`,
                description: ep.attributes?.synopsis || null,
                thumbnail: ep.attributes?.thumbnail?.original || null,
                releasedDate: ep.attributes?.airdate || null,
                isFiller: false,
                seasonId,
                seasonNum: 1,
              });
            }
            if (kEps.length > 0) return kEps.sort((a, b) => a.episodeNum - b.episodeNum);
          }
        }
      }
    } catch { /* ignore */ }
  } catch (e) {
    console.warn(`[Client Episode Fetch] Error for ${seasonId}`, e);
  }

  return [];
}

async function fetchFranchiseClientSide(startId: number) {
  const curated = getCuratedAnimeFranchiseNodes(startId);
  if (curated && curated.length > 1) {
    return curated as FranchiseNode[];
  }

  // Query fetches the node's OWN metadata AND its relation edges
  const RELATIONS_QUERY = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id idMal title { romaji english native } episodes status season seasonYear format bannerImage coverImage { large extraLarge }
      relations { edges { relationType node { id idMal title { romaji english native } episodes status season seasonYear format type isAdult bannerImage coverImage { large extraLarge } } } }
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
          signal: AbortSignal.timeout(8000)
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
            status: media.status || null,
            title: media.title?.english || media.title?.romaji || media.title?.native || "",
            bannerImage: media.bannerImage || null,
            coverImage: media.coverImage?.extraLarge || media.coverImage?.large || null
          });
        }
        
        // Traverse SEQUEL, PREQUEL, ALTERNATIVE, PARENT, SIDE_STORY, SPIN_OFF relations
        const edges = media.relations?.edges || [];
        for (const edge of edges) {
          if (!edge.node) continue;
          const rType = edge.relationType;
          if (!["PREQUEL", "SEQUEL", "ALTERNATIVE", "PARENT", "SIDE_STORY", "SPIN_OFF"].includes(rType)) continue;
          if (edge.node.type !== "ANIME" || edge.node.isAdult) continue;
          const relId = edge.node.id;
          if (!visited.has(relId) && !queue.includes(relId)) {
            // Pre-populate with relation data so we have title even if we can't fetch its own page
            visited.set(relId, {
              id: relId, idMal: edge.node.idMal || null, episodes: edge.node.episodes,
              season: edge.node.season, seasonYear: edge.node.seasonYear, format: edge.node.format,
              status: edge.node.status || null,
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
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      try {
        const azRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${parsedId}`, { signal: AbortSignal.timeout(4000) });
        if (azRes.ok) {
          const azData = await azRes.json();
          const malId = azData.mappings?.mal_id;
          if (malId) {
            const jRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, { signal: AbortSignal.timeout(6000) });
            if (jRes.ok) {
              const jData = await jRes.json();
              const a = jData.data;
              if (a) {
                const jAnime: AnimeDetail = {
                  id: String(parsedId),
                  idMal: String(a.mal_id),
                  name: a.title_english || a.title || "Unknown",
                  jname: a.title_japanese || null,
                  poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
                  description: a.synopsis || "",
                  type: a.type || "TV",
                  rating: a.score ? String(a.score) : null,
                  score: a.score ? String(a.score) : null,
                  status: a.status || null,
                  genres: (a.genres || []).map((g: any) => g.name),
                  totalEpisodes: a.episodes || 12,
                  seasons: [{
                    id: String(parsedId),
                    name: a.title_english || a.title || "Unknown",
                    seasonLabel: "Season 1",
                    totalEpisodes: a.episodes || 12,
                    isCurrent: true,
                    idMal: a.mal_id,
                    seasonYear: a.year || null,
                  }],
                  season: a.season || null,
                  seasonYear: a.year || null,
                  format: a.type || null,
                  openedSeasonId: String(parsedId),
                  tmdbId: null,
                  duration: a.duration || null,
                  trailerId: a.trailer?.youtube_id || null,
                };
                return { success: true, data: { anime: jAnime, franchiseNodes: [] } };
              }
            }
          }

          // Kitsu details fallback on client
          try {
            const kitsuRes = await fetch(`https://kitsu.io/api/edge/mappings?filter[external_site]=${isMal ? "myanimelist/anime" : "anilist/anime"}&filter[external_id]=${parsedId}&include=item`, { headers: { "Accept": "application/vnd.api+json" }, signal: AbortSignal.timeout(4000) });
            if (kitsuRes.ok) {
              const kData = await kitsuRes.json();
              const kItem = kData.included?.[0] || kData.data?.[0]?.relationships?.item?.data;
              if (kItem?.attributes) {
                const attr = kItem.attributes;
                const subtype = (attr.subtype || "TV").toUpperCase();
                const kAnime: AnimeDetail = {
                  id: String(parsedId),
                  idMal: isMal ? String(parsedId) : null,
                  name: attr.titles?.en || attr.canonicalTitle || attr.titles?.en_jp || "Unknown",
                  jname: attr.titles?.ja_jp || null,
                  poster: attr.posterImage?.large || attr.posterImage?.original || "",
                  description: cleanAnimeDescription(attr.synopsis || attr.description),
                  type: subtype,
                  rating: attr.averageRating ? String((parseFloat(attr.averageRating) / 10).toFixed(1)) : null,
                  score: attr.averageRating ? String((parseFloat(attr.averageRating) / 10).toFixed(1)) : null,
                  status: attr.status === "current" ? "RELEASING" : (attr.status === "upcoming" ? "NOT_YET_RELEASED" : "FINISHED"),
                  genres: [],
                  totalEpisodes: attr.episodeCount || 12,
                  seasons: [{
                    id: String(parsedId),
                    name: attr.titles?.en || attr.canonicalTitle || attr.titles?.en_jp || "Unknown",
                    seasonLabel: "Season 1",
                    totalEpisodes: attr.episodeCount || 12,
                    isCurrent: true,
                    idMal: isMal ? parsedId : null,
                    seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : null,
                  }],
                  season: null,
                  seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : null,
                  format: subtype,
                  openedSeasonId: String(parsedId),
                  tmdbId: null,
                  duration: attr.episodeLength || null,
                  trailerId: attr.youtubeVideoId || null,
                };
                return { success: true, data: { anime: kAnime, franchiseNodes: [] } };
              }
            }
          } catch {}
        }
      } catch {}
      return null;
    }

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
      totalEpisodes: media.episodes || 0,
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
    const finalSeasons = mapNodesToSeasons(clientNodes, media.id);
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
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number } | null;
  backdrop?: string | null;
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

export default function AnimeClient({ initialData }: { initialData?: any | null } = {}) {
  const params = useParams();
  const id = params?.id as string;
  const { data: session, status: authStatus } = useSession();

  const [anime, setAnime] = useState<AnimeDetail | null>(() => {
    // Hydrate from server-passed initial data immediately on first render.
    // This eliminates the blank skeleton — the poster/title/description/genres
    // are visible the instant the page hydrates, before any client fetch fires.
    if (initialData && initialData.id) return initialData as AnimeDetail;
    return null;
  });
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  // If we already have initialData, skip the blank skeleton entirely.
  const [isLoading, setIsLoading] = useState(!initialData);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Only set once the user explicitly starts an episode (clicked to watch).
  // Gates the "Current" badge so it never shows on a fresh page open.
  const [watchStarted, setWatchStarted] = useState(false);
  const [episodeNotice, setEpisodeNotice] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

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
  usePageContentReady(!isLoading);

  interface FranchiseNode {
    id: number;
    idMal: number | null;
    title: string;
    episodes: number | null;
    totalEpisodes?: number | null;
    season: string | null;
    seasonYear: number | null;
    format: string | null;
    coverImage?: string | null;
  }

  // currentSeasonId tracks the ACTIVE season by its AniList ID
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(id);

  const playerRef = useRef<HTMLDivElement>(null);
  const selectedQueueEpRef = useRef<HTMLButtonElement>(null);

  // Tracks which seasonIds we have already loaded episodes for
  const loadedSeasonIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  function isAnimeOngoing(status: string | null | undefined): boolean {
    const normalized = (status || "").toLowerCase();
    return normalized.includes("airing") || normalized.includes("releasing") || normalized.includes("not_yet");
  }

  function isFutureDate(dateValue: string | null | undefined): boolean {
    if (!dateValue) return false;
    const dateOnlyStr = dateValue.split("T")[0];
    const episodeDate = new Date(`${dateOnlyStr}T00:00:00`);
    if (Number.isNaN(episodeDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return episodeDate.getTime() > today.getTime();
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
        `/api/anime/${id}/episodes?seasonId=${encodeURIComponent(seasonId)}${tmdbIdQuery}${tmdbSeasonQuery}${episodeOffsetQuery}&v=${ANIME_API_VERSION}`
      );
      const matchingSeason = anime?.seasons?.find(s => s.id === seasonId);
      const activeSeasonStatus = matchingSeason?.status || anime?.status || "";
      const statusNorm = activeSeasonStatus.toLowerCase().replace(/_/g, " ").trim();
      const isUnreleasedAnime = 
        statusNorm.includes("not yet") || 
        statusNorm.includes("upcoming") || 
        statusNorm.includes("to be aired") ||
        statusNorm.includes("unreleased");
      const isFinishedSeason = statusNorm.includes("finished") || statusNorm.includes("completed");

      const hasEpisodes = epData.success && epData.data?.episodes && epData.data.episodes.length > 0;
      if (hasEpisodes) {
        const sorted = epData.data.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        const nextEpNum = anime?.nextAiringEpisode?.episode || null;

        let encounteredUnreleased = false;
        const nowMs = Date.now();
        const withRelease: Episode[] = sorted.map((ep) => {
          let released = ep.isReleased !== false;

          if (isUnreleasedAnime) {
            released = false;
          } else if (nextEpNum && typeof ep.episodeNum === "number" && ep.episodeNum >= nextEpNum) {
            released = false;
          } else if (ep.releasedDate) {
            const epDateMs = new Date(ep.releasedDate).getTime();
            if (!isNaN(epDateMs) && epDateMs > nowMs) {
              released = false;
            }
          }

          if (encounteredUnreleased) {
            released = false;
          }

          if (!released) {
            encounteredUnreleased = true;
          }

          return {
            ...ep,
            isReleased: released,
          };
        });

        setEpisodes(prev => {
          const otherSeasons = prev.filter(e => String(e.seasonId) !== String(seasonId));
          const withNormalizedSeason = withRelease.map(ep => ({
            ...ep,
            seasonId: String(ep.seasonId || seasonId),
          }));
          const merged = [...otherSeasons, ...withNormalizedSeason].sort((a, b) => {
            if ((a.seasonNum || 1) !== (b.seasonNum || 1)) return (a.seasonNum || 1) - (b.seasonNum || 1);
            return a.episodeNum - b.episodeNum;
          });
          return merged;
        });
        setSeasonOverview(epData.data.seasonOverview || null);
        loadedSeasonIds.current.add(seasonId);
        setEpisodesLoading(false);
        return;
      }
    } catch (err) {
      console.warn(`[AnimeClient] Server episode API failed for seasonId=${seasonId}, attempting client-side fallback...`, err);
    }

    // Client-side fallback: fetch directly from browser APIs (AniZip, TMDB proxy, Kitsu)
    const matchingSeason = anime?.seasons?.find(s => String(s.id) === String(seasonId));
    const isMovie = (matchingSeason?.seasonLabel || "").startsWith("Movie") || anime?.format === "MOVIE" || anime?.type === "MOVIE";
    const epCount = isMovie
      ? 1
      : ((matchingSeason?.totalEpisodes && matchingSeason.totalEpisodes < 1499)
        ? matchingSeason.totalEpisodes
        : ((anime?.totalEpisodes && anime.totalEpisodes < 1499 && String(anime.id) === String(seasonId)) ? anime.totalEpisodes : 0));
    const clientEpsRaw = await fetchEpisodesClientSide(
      seasonId,
      matchingSeason?.name || anime?.name || "",
      epCount,
      clientTmdbId ?? matchingSeason?.tmdbId,
      clientTmdbSeason ?? matchingSeason?.tmdbSeasonNumber,
      clientEpisodeOffset ?? matchingSeason?.episodeOffset
    );

    const nextEpNum = anime?.nextAiringEpisode?.episode || null;
    const isNotYet = anime?.status === "NOT_YET_RELEASED";
    const nowMs = Date.now();

    let clientEncounteredUnreleased = false;
    const clientEps: Episode[] = clientEpsRaw.map((ep) => {
      let released = ep.isReleased !== false;

      if (isNotYet) {
        released = false;
      } else if (nextEpNum && typeof ep.episodeNum === "number" && ep.episodeNum >= nextEpNum) {
        released = false;
      } else if (ep.releasedDate) {
        const epDateMs = new Date(ep.releasedDate).getTime();
        if (!isNaN(epDateMs) && epDateMs > nowMs) {
          released = false;
        }
      }

      if (clientEncounteredUnreleased) {
        released = false;
      }

      if (!released) {
        clientEncounteredUnreleased = true;
      }

      return {
        ...ep,
        seasonId: String(seasonId),
        isReleased: released,
      };
    });

    if (clientEps.length > 0) {
      setEpisodes(prev => {
        const otherSeasons = prev.filter(e => String(e.seasonId) !== String(seasonId));
        return [...otherSeasons, ...clientEps].sort((a, b) => a.episodeNum - b.episodeNum);
      });
      loadedSeasonIds.current.add(seasonId);
    } else {
      // Final fallback: generate basic cards if browser also couldn't reach APIs
      let fallbackEncounteredUnreleased = false;
      const countToGen = isMovie ? 1 : Math.max(epCount || 1, 1);
      const fallbackEps: Episode[] = Array.from({ length: countToGen }, (_, i) => {
        const epNum = i + 1;
        let released = true;

        if (isNotYet) {
          released = false;
        } else if (nextEpNum && epNum >= nextEpNum) {
          released = false;
        }

        if (fallbackEncounteredUnreleased) {
          released = false;
        }

        if (!released) {
          fallbackEncounteredUnreleased = true;
        }

        return {
          episodeId: `${seasonId}-${epNum}`,
          episodeNum: epNum,
          title: isMovie ? (matchingSeason?.name || anime?.name || "Complete Movie") : `Episode ${epNum}`,
          description: isMovie ? anime?.description || undefined : undefined,
          thumbnail: isMovie ? anime?.poster || undefined : undefined,
          malUrl: undefined,
          isFiller: false,
          isReleased: released,
          seasonId: String(seasonId),
          seasonNum: 1,
        };
      });
      setEpisodes(prev => {
        const otherSeasons = prev.filter(e => String(e.seasonId) !== String(seasonId));
        return [...otherSeasons, ...fallbackEps].sort((a, b) => a.episodeNum - b.episodeNum);
      });
      loadedSeasonIds.current.add(seasonId);
    }
    setEpisodesLoading(false);
  }, [id]);

  // Ref to ensure loadMeta only runs ONCE per anime ID (prevents NextAuth session focus re-runs from wiping state).
  const metaLoadedIdRef = useRef<string | null>(null);

  // ── 1) Immediate Episode & Watch Order Hydration on Mount ───────────────
  useEffect(() => {
    if (!id) return;
    const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const targetSeasonId = searchParams.get("seasonId") || id;
    setCurrentSeasonId(targetSeasonId);

    // Fire episode loading immediately on mount — no waiting for server meta
    loadSeasonEpisodes(targetSeasonId, false);

    // Fire fast client-side Watch Order graph fetch immediately on mount
    fetchFranchiseClientSide(Number(id))
      .then((clientNodes) => {
        if (clientNodes && clientNodes.length > 0) {
          setFranchiseNodes((prev) => (clientNodes.length >= prev.length ? clientNodes : prev));
          const mappedSeasons = mapNodesToSeasons(clientNodes, Number(id));
          setAnime((prev) => {
            if (!prev) return prev;
            const currentSeasons = prev.seasons || [];
            return {
              ...prev,
              seasons: mappedSeasons.length >= currentSeasons.length ? mappedSeasons : currentSeasons,
            };
          });
        }
      })
      .catch(() => {});
  }, [id, loadSeasonEpisodes]);

  // ── 2) Background Server Meta & TMDB Mapping Enrichment ─────────────────
  useEffect(() => {
    if (!id) return;
    if (metaLoadedIdRef.current === id && anime && anime.id === id) return;

    metaLoadedIdRef.current = id;
    let cancelled = false;
    loadedSeasonIds.current.clear();
    tmdbIdRef.current = null;

    if (authStatus === "loading") return;

    const loadMeta = async () => {
      if (!initialData) setIsLoading(true);
      setError(null);
      try {
        let data: any = null;
        try {
          data = await fetchJson<{ success: boolean; data: { anime: AnimeDetail; franchiseNodes?: FranchiseNode[]; tmdbSeasonMap?: Record<string, number> } }>(
            `/api/anime/${id}/meta?v=${ANIME_API_VERSION}`,
            { signal: AbortSignal.timeout(15000) }
          );
        } catch (e) {
          console.warn("[Anime Client] Server meta fetch failed, trying client side fallback...", e);
        }

        if (!data || !data.success || !data.data?.anime) {
          const fallbackData = await fetchAnimeMetaClientSide(id);
          if (fallbackData) data = fallbackData;
        }

        if (cancelled) return;
        if (data && data.success && data.data?.anime) {
          const a = data.data.anime;
          animeStatusRef.current = a.status || null;
          setIsLoading(false);
          setAnime(prev => {
            if (!prev) return a;
            const serverSeasons = a.seasons || [];
            const currentSeasons = prev.seasons || [];
            const mergedSeasons = currentSeasons.map(ps => {
              const serverMatch = serverSeasons.find((ss: any) => ss.id === ps.id);
              if (serverMatch) {
                return {
                  ...ps,
                  status: serverMatch.status || ps.status,
                  totalEpisodes: Math.max(serverMatch.totalEpisodes || 0, ps.totalEpisodes || 0),
                  seasonYear: serverMatch.seasonYear || ps.seasonYear,
                  tmdbId: serverMatch.tmdbId != null ? serverMatch.tmdbId : ps.tmdbId,
                  tmdbSeasonNumber: serverMatch.tmdbSeasonNumber != null ? serverMatch.tmdbSeasonNumber : ps.tmdbSeasonNumber,
                  episodeOffset: serverMatch.episodeOffset != null ? serverMatch.episodeOffset : ps.episodeOffset,
                };
              }
              return ps;
            });
            for (const ss of serverSeasons) {
              if (!mergedSeasons.find((ms: any) => ms.id === ss.id)) {
                mergedSeasons.push(ss);
              }
            }
            return {
              ...prev,
              ...a,
              // Preserve previously-loaded good values if the server returned blanks
              // (happens when the curated fallback fires during an AniList outage)
              description: a.description || prev.description || "",
              genres: (a.genres && a.genres.length > 0) ? a.genres : (prev.genres && prev.genres.length > 0 ? prev.genres : []),
              rating: a.rating || prev.rating || "",
              totalEpisodes: Math.max(a.totalEpisodes || 0, prev.totalEpisodes || 0),
              seasons: mergedSeasons,
            };
          });
          setFranchiseNodes(prev => {
            const serverNodes = data.data.franchiseNodes || [];
            if (serverNodes.length >= prev.length) return serverNodes;
            return prev;
          });
          tmdbIdRef.current = a.tmdbId || null;

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
      }
    };

    loadMeta();
    return () => { cancelled = true; };
  }, [id, loadSeasonEpisodes, authStatus, initialData, anime]);

  // ── Fetch You May Like recommendations (client-side AniList + server route fallback) ────────────
  useEffect(() => {
    if (!id) return;
    setRecsLoading(true);
    const franchiseIds = new Set(franchiseNodes.map(n => String(n.id)).filter(Boolean));
    const excludeIds = new Set([id, ...franchiseIds]);
    const numericId = parseInt(anime?.id || initialData?.id || id.replace(/\D/g, ""), 10);
    const validAnilistId = !isNaN(numericId) ? numericId : 1;

    const currentGenres = anime?.genres || initialData?.genres || [];
    const animeTitle = anime?.name || initialData?.name || "";

    fetchAnilistRecommendations(validAnilistId, animeTitle, excludeIds, 12, currentGenres)
      .then(async (items) => {
        if (items.length === 0 && validAnilistId > 1) {
          // Server route fallback if client GraphQL query returned no items
          try {
            const excludeParam = [...excludeIds].join(",");
            const res = await fetch(`/api/anime/recommendations/${validAnilistId}?title=${encodeURIComponent(animeTitle)}&genres=${encodeURIComponent(currentGenres.join(","))}&excludeIds=${encodeURIComponent(excludeParam)}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.items?.length > 0) items = data.items;
            }
          } catch { /* fallback failed */ }
        }

        if (items.length > 0) {
          const withReasons = items.map((item: any) => ({
            ...item,
            reason: getRecommendationReason(currentGenres.map((g: string) => g.charCodeAt(0)), item.genres?.map((g: string) => g.charCodeAt(0)) || [])
          }));
          setRecommendations(withReasons);
        }
      })
      .catch(() => {})
      .finally(() => setRecsLoading(false));
  }, [anime?.id, anime?.name, id, franchiseNodes, initialData]);

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
    let isFromActiveShow = false;

    if (episodeParam > 0) {
      target = episodes.find(ep => {
        const matchesSeasonId = seasonIdParam ? ep.seasonId === seasonIdParam : true;
        const matchesLegacySeason = legacySeasonParam ? ep.seasonNum === legacySeasonParam : true;
        return matchesSeasonId && matchesLegacySeason && ep.episodeNum === episodeParam;
      });
      if (target && autoPlay) {
        isFromActiveShow = true;
      }
    } else {
      try {
        const activeAnimeRaw = localStorage.getItem("cinestream_active_anime_show");
        if (activeAnimeRaw) {
          const activeAnime = JSON.parse(activeAnimeRaw);
          const animeMatchId = String(anime?.id || id);
          if (String(activeAnime?.id) === animeMatchId) {
            target = episodes.find(ep => {
              const matchesSeason = activeAnime.seasonId ? ep.seasonId === activeAnime.seasonId : true;
              return matchesSeason && ep.episodeNum === activeAnime.episodeNum;
            });
            if (target) {
              isFromActiveShow = true;
            }
          }
        }
      } catch {}
    }

    if (target && !selectedEp) {
      setSelectedEp(target);
      if (isFromActiveShow) {
        setWatchStarted(true);
      }
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
        setWatchStarted(true);
        setIsPlaying(true);
        try {
          localStorage.setItem("cinestream_active_anime_show", JSON.stringify({
            id: String(anime?.id || id),
            seasonId: target.seasonId || currentSeasonId,
            episodeNum: target.episodeNum,
            episodeId: target.episodeId,
          }));
        } catch {}
      }
    }

    if (!hasRestoredState) {
      setHasRestoredState(true);
    }
  }, [episodes, id, anime, hasRestoredState]);

  // Persist State
  useEffect(() => {
    if (typeof window !== "undefined" && watchStarted && selectedEp && anime) {
      try {
        localStorage.setItem("cinestream_active_anime_show", JSON.stringify({
          id: String(anime.id || id),
          seasonId: selectedEp.seasonId || currentSeasonId,
          episodeNum: selectedEp.episodeNum,
          episodeId: selectedEp.episodeId,
        }));
      } catch {}
    }
  }, [id, anime, currentSeasonId, selectedEp, watchStarted]);

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

  // ── Season click handler ────────────────────────────────────────────────
  const handleSeasonClick = useCallback((season: SeasonInfo) => {
    if (season.id === currentSeasonId) return;
    setCurrentSeasonId(season.id);
    setIsPlaying(false);
    setSelectedEp(null);
    setWatchStarted(false);
    setEpisodeNotice(null);
    // Always force-reload when the user explicitly clicks a season tab.
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

  // ── Watch episode handler ───────────────────────────────────────────────
  const handleWatchEpisode = useCallback((ep: Episode) => {
    if (ep.isReleased === false) {
      setEpisodeNotice(`Episode ${ep.episodeNum} hasn't been released yet.`);
      return;
    }
    setEpisodeNotice(null);
    setSelectedEp(ep);
    setWatchStarted(true);
    setIsPlaying(true);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (ep.seasonId) {
        url.searchParams.set("seasonId", ep.seasonId);
      }
      url.searchParams.set("episode", ep.episodeNum.toString());
      window.history.replaceState({}, "", url.toString());

      try {
        localStorage.setItem("cinestream_active_anime_show", JSON.stringify({
          id: String(anime?.id || id),
          seasonId: ep.seasonId || currentSeasonId,
          episodeNum: ep.episodeNum,
          episodeId: ep.episodeId,
        }));
      } catch {}
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
  }, [authStatus, anime, id, currentSeasonId]);

  const [episodeView, setEpisodeView] = useState<EpisodeViewMode>("grid");

  const handleViewChange = useCallback((view: EpisodeViewMode) => {
    setEpisodeView(view);
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────
  const INITIAL_EPISODES_PER_PAGE = 50;

  const seasons = useMemo(() => anime?.seasons || [], [anime]);

  // Group all loaded episodes by seasonId
  const episodesBySeason = useMemo(() => {
    return episodes.reduce((acc, ep) => {
      const key = String(ep.seasonId || "unknown");
      if (!acc[key]) acc[key] = [];
      acc[key].push(ep);
      return acc;
    }, {} as Record<string, Episode[]>);
  }, [episodes]);

  const currentSeasonEps = useMemo(() => {
    const list = episodesBySeason[String(currentSeasonId)] || [];
    if (list.length > 0) {
      return [...list].sort((a, b) => a.episodeNum - b.episodeNum);
    }
    // Resilient fallback: If episodes were loaded and there's only 1 season or all loaded episodes match
    if (episodes.length > 0 && (!seasons || seasons.length <= 1)) {
      return [...episodes].sort((a, b) => a.episodeNum - b.episodeNum);
    }
    return [];
  }, [episodesBySeason, currentSeasonId, episodes, seasons]);

  const upcomingAnimeThisWeek = useMemo(
    () => currentSeasonEps
      .filter(ep => ep.isReleased === false && isWithinNextDays(ep.releasedDate, 7))
      .sort((a, b) => new Date(a.releasedDate || "").getTime() - new Date(b.releasedDate || "").getTime())[0] || null,
    [currentSeasonEps]
  );

  const EPISODES_PER_PAGE = 50;
  const [episodePage, setEpisodePage] = useState(1);

  // Reset page when season changes
  useEffect(() => {
    setEpisodePage(1);
  }, [currentSeasonId]);

  // Automatically sync page so the selected episode is on the active page
  useEffect(() => {
    if (!selectedEp) return;
    const epNum = selectedEp.episodeNum;
    const targetPage = Math.floor((epNum - 1) / EPISODES_PER_PAGE) + 1;
    setEpisodePage(targetPage);
  }, [selectedEp?.episodeId, selectedEp?.episodeNum]);

  const currentIdx = useMemo(
    () => currentSeasonEps.findIndex(e => e.episodeId === selectedEp?.episodeId),
    [currentSeasonEps, selectedEp]
  );
  const nextEp = useMemo(
    () => (currentIdx >= 0 && currentIdx < currentSeasonEps.length - 1 ? currentSeasonEps[currentIdx + 1] : null),
    [currentIdx, currentSeasonEps]
  );
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
    return seasons.find(s => String(s.id) === String(currentSeasonId)) || null;
  }, [seasons, currentSeasonId]);

  const currentEpisodeOffset = useMemo(() => {
    return currentSeason?.episodeOffset || 0;
  }, [currentSeason]);

  const displayPoster = (currentSeasonInfo as any)?.coverImage || (currentSeason as any)?.coverImage || anime?.poster || "";
  const tmdbBackdropPath = anime?.backdrop || null;
  const displayBanner = tmdbBackdropPath
    ? tmdbBackdropPath
    : (currentSeasonInfo as any)?.bannerImage
      || (currentSeasonInfo as any)?.coverImage
      || (currentSeason as any)?.coverImage
      || anime?.poster
      || "";
  const displayTitle = (currentSeasonInfo as any)?.name || (currentSeasonInfo as any)?.title || currentSeason?.name || anime?.name || "";
  const displayStatus = currentSeason?.status || (currentSeasonInfo as any)?.status || anime?.status || "";

  // Single source of truth for the season description. Prefer the AniList
  // synopsis, but fall back to the TMDB season overview so every anime always
  // shows a description under the title (never duplicated above episodes).
  const animeDescription = anime?.description || seasonOverview || "";
  const animeScoreRaw = Number(anime?.rating || anime?.score || 0);
  const animeScore = animeScoreRaw > 10 ? animeScoreRaw / 10 : animeScoreRaw;
  const animeScoreColor = animeScore >= 7.5 ? "text-emerald-400" : animeScore >= 5 ? "text-amber-400" : "text-red-400";
  const isLongDescription = animeDescription.length > 200;

  // Collapse the read-more state whenever the description changes (e.g. the
  // user switches season tabs, which can swap the TMDB season overview).
  useEffect(() => {
    setDescExpanded(false);
  }, [currentSeasonId, seasonOverview]);

  const franchiseAbsoluteEp = useMemo(() => {
    const currentIdx = seasons.findIndex(s => s.id === currentSeasonId);
    if (currentIdx < 0) return 0;
    const prevTotal = seasons.slice(0, currentIdx).reduce((sum, s) => sum + (s.totalEpisodes || 0), 0);
    return prevTotal + (selectedEp?.episodeNum || 0);
  }, [seasons, currentSeasonId, selectedEp?.episodeNum]);

  // ── Normalize anime episodes into the shared EpisodeItem shape ──────────
  const episodeToItem = useCallback((ep: Episode): EpisodeItem => {
    const isUnreleased = ep.isReleased === false;
    const backdropFallback = (anime as any)?.bannerImage || initialData?.bannerImage || displayPoster || null;
    const thumbSrc = isUnreleased
      ? (ep.thumbnail || null)
      : (ep.thumbnail || (isSingleItem && displayPoster) || backdropFallback);
    const isSelected = selectedEp?.episodeId === ep.episodeId;
    // The "Current"/"Playing" badge only shows once the user has actually
    // started an episode (either by clicking it or resuming with autoplay).
    const isCurrent = isSelected && (isPlaying || watchStarted);
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
  }, [anime, currentSeasonId, displayPoster, displayTitle, handleWatchEpisode, isPlaying, isSingleItem, selectedEp, watchStarted]);


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
    const startIndex = (Math.max(1, episodePage) - 1) * EPISODES_PER_PAGE;
    const currentEps = currentSeasonEps.slice(startIndex, startIndex + EPISODES_PER_PAGE);
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
  }, [episodePage, currentSeasonId, id, currentSeasonEps.length]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-0 bleed-header select-none">
        {isLoading ? (
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto pt-6 animate-pulse">
            <div className="w-full h-[62vh] md:h-[75vh] rounded-2xl bg-gradient-to-br from-[#111844]/20 to-background flex items-end p-8">
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
              <div className="relative z-10 pb-4 md:pb-8 px-4 sm:px-6 md:px-12 flex flex-row items-center gap-3.5 sm:gap-6 md:gap-8 max-w-screen-2xl mx-auto w-full">
                <div
                  className="shrink-0 w-24 sm:w-36 md:w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10"
                >
                  <img src={displayPoster} alt={displayTitle} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                  <div>
                    <h1 className="font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight select-text">{displayTitle}</h1>
                    {anime.jname && (
                      <p className="text-primary/90 font-semibold italic text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1 select-text">{anime.jname}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    {animeScore > 0 && (
                      <div className={`flex items-center gap-1.5 font-black ${animeScoreColor}`}>
                        <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                        <span className="text-lg sm:text-2xl leading-none">{animeScore.toFixed(1)}</span>
                        <span className="text-white/40 font-bold text-[10px] sm:text-xs">/ 10</span>
                      </div>
                    )}
                    {displayStatus && (() => {
                      const formatted = formatAnimeStatus(displayStatus, currentSeasonEps);
                      return (
                        <span className={`text-[9px] sm:text-[10px] font-bold tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full uppercase border ${
                          formatted.style === "airing"
                            ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
                            : formatted.style === "upcoming"
                            ? "text-sky-300 bg-sky-500/20 border-sky-500/30"
                            : "text-white/60 bg-white/10 border-white/20"
                        }`}>{formatted.label}</span>
                      );
                    })()}
                    {anime.type && (
                      <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white/[0.07] border border-white/[0.08] rounded-full text-[11px] sm:text-xs font-semibold text-white/70">{anime.type}</span>
                    )}
                    <div className="flex flex-wrap gap-1.5 ml-0.5">
                      {anime.genres?.slice(0, 5).map(g => (
                        <span key={g} className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white/[0.07] border border-white/[0.08] rounded-full text-[11px] sm:text-xs font-semibold text-white/70">{g}</span>
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
                      {(anime as any)?.isUpcoming || (anime as any)?.status === "upcoming" ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs sm:text-sm font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                            <span>This entry is upcoming. Please check back later.</span>
                          </div>
                          <WatchlistButton
                            mediaId={Number(anime.id)}
                            mediaType="anime"
                            title={anime.name}
                            posterPath={anime.poster || null}
                          />
                          <AnimeHeroTrailerButton />
                        </div>
                      ) : (anime as any)?.isUnavailable || (anime as any)?.status === "unavailable" ? (
                        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full">
                          <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-300 text-xs sm:text-sm font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                            <span>This title is currently unavailable on this site. Please check back later.</span>
                          </div>
                          <WatchlistButton
                            mediaId={Number(anime.id)}
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
                            mediaId={Number(anime.id)}
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
                {/* ── Player + Queue ── */}
                {isPlaying && selectedEp && (
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 select-none">
                    <div ref={playerRef} className="w-full min-w-0">
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

                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {isSingleItem ? (
                            <span className="text-lg font-black text-white">{selectedEp.title || (currentSeasonInfo as any)?.name || anime?.name}</span>
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
                          {currentSeasonEps.length > 0 && (
                            <span className="text-sm text-white/40 px-2 font-medium">{Math.max(currentIdx + 1, 1)} / {currentSeasonEps.length}</span>
                          )}
                          <button
                            onClick={handleNext}
                            disabled={currentIdx >= currentSeasonEps.length - 1 || (currentSeasonEps[currentIdx + 1]?.isReleased === false)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4B5694] hover:bg-[#7288AE] disabled:opacity-30 text-white text-xs font-bold transition-all shadow-lg"
                          >
                            Next <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {nextEp && nextEp.isReleased !== false && (
                        <button
                          onClick={() => handleWatchEpisode(nextEp)}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/85 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Play Next: E{nextEp.episodeNum}
                        </button>
                      )}
                    </div>

                    {/* ── Episode Queue Sidebar ── */}
                    <aside className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col max-h-[60vh] xl:max-h-[70vh]">
                      <div className="p-4 border-b border-white/[0.06] bg-white/[0.01]">
                        <div className="text-sm font-bold text-white flex items-center justify-between gap-2">
                          <span className="truncate">
                            {franchiseNodes.find(n => String(n.id) === currentSeasonId)?.title || (currentSeasonInfo as any)?.seasonLabel || "Episodes"}
                          </span>
                          <span className="text-xs font-normal text-white/40 whitespace-nowrap">{currentSeasonEps.length} eps</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                        {currentSeasonEps.map((ep) => {
                          const isSelected = selectedEp?.episodeId === ep.episodeId && (isPlaying || watchStarted);
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
                  </div>
                )}

                {/* ── Season Info Bar (Episodes · Status) ── */}
                <div className="w-full">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-black text-white">
                        {isMovieFormat ? (currentSeasonEps.length || 1) : (currentSeason?.totalEpisodes || currentSeasonEps.length || 1)}
                      </span>
                      <span className="text-sm font-semibold text-white/50">
                        {isMovieFormat ? (currentSeasonEps.length > 1 ? "Parts" : "Movie") : (currentSeasonEps.length === 1 ? "Episode" : "Episodes")}
                      </span>
                    </div>
                    <div className="w-px h-5 bg-white/10 hidden sm:block" />
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
              </div>

              {/* ── Episodes Section ── */}
              <section id="anime-episodes-section" className="mt-10 space-y-4">
                {/* ── Watch Order Section (franchise order reference) ── */}
                {(() => {
                  const curatedNodes = getCuratedAnimeFranchiseNodes(Number(id), anime?.name);
                  const nodesToUse: FranchiseNode[] = (franchiseNodes && franchiseNodes.length > 1)
                    ? franchiseNodes
                    : (curatedNodes && curatedNodes.length > 1)
                      ? (curatedNodes as FranchiseNode[])
                      : (anime?.seasons && anime.seasons.length > 1)
                        ? anime.seasons.map(s => ({
                            id: Number(s.id) || Number(id),
                            idMal: s.idMal || null,
                            title: s.name,
                            episodes: s.totalEpisodes,
                            season: null,
                            seasonLabel: s.seasonLabel,
                            totalEpisodes: s.totalEpisodes,
                            seasonYear: s.seasonYear || null,
                            format: "TV",
                            coverImage: s.coverImage || null,
                          }))
                        : (franchiseNodes || []);

                  const visibleFranchiseNodes = nodesToUse.filter(node => {
                    if (!node.title) return false;
                    if (String(node.id) === anime?.id) return true;
                    
                    const format = node.format;
                    if (!format || format === "TV" || format === "TV_SHORT" || format === "ONA" || format === "MOVIE") {
                      return true;
                    }
                    
                    if (format === "SPECIAL" || format === "OVA") {
                      const lowerTitle = node.title.toLowerCase();
                      const plotKeywords = ["final", "part", "chapter", "season", "arc", "prologue", "epilogue", "special"];
                      return plotKeywords.some(kw => lowerTitle.includes(kw));
                    }
                    
                    return true;
                  });
                  if (visibleFranchiseNodes.length <= 1) return null;
                  const totalParts = visibleFranchiseNodes.length;
                  const activeIdx = visibleFranchiseNodes.findIndex(node => String(node.id) === currentSeasonId || String(node.id) === anime?.id);
                  const hasActive = activeIdx >= 0;
                  const progressPct = hasActive ? Math.round(((activeIdx + 1) / totalParts) * 100) : 0;

                  const formatMeta = (fmt: string | null) => {
                    switch (fmt) {
                      case "MOVIE":
                        return { label: "Movie", icon: Film, chip: "text-violet-300 bg-violet-400/10 border-violet-400/20" };
                      case "OVA":
                        return { label: "OVA", icon: Sparkles, chip: "text-amber-300 bg-amber-400/10 border-amber-400/20" };
                      case "SPECIAL":
                        return { label: "Special", icon: Sparkles, chip: "text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/20" };
                      case "ONA":
                        return { label: "ONA", icon: Tv, chip: "text-teal-300 bg-teal-400/10 border-teal-400/20" };
                      case "TV_SHORT":
                        return { label: "TV", icon: Tv, chip: "text-sky-300 bg-sky-400/10 border-sky-400/20" };
                      default:
                        return { label: fmt || "TV", icon: Tv, chip: "text-sky-300 bg-sky-400/10 border-sky-400/20" };
                    }
                  };

                  return (
                  <div className="relative rounded-2xl p-px bg-gradient-to-br from-primary/25 via-white/[0.06] to-primary/25 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                    <div className="relative rounded-[15px] bg-gradient-to-br from-white/[0.05] to-white/[0.015] overflow-hidden">
                      {/* ambient glow */}
                      <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 bg-primary/[0.05] rounded-full blur-3xl" />
                      <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-primary/[0.04] rounded-full blur-3xl" />

                      {/* ── Header ── */}
                      <button
                        onClick={() => setShowSeasonGuide(!showSeasonGuide)}
                        className="relative flex items-center justify-between w-full text-left px-4 pt-4 pb-3 hover:bg-white/[0.03] transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-[0_4px_12px_hsl(var(--primary)/0.2)]">
                            <Route className="w-4 h-4 text-white" />
                            <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.18em] font-black text-primary">Franchise Guide</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <h3 className="text-base font-black text-white tracking-tight">Watch Order</h3>
                              <span className="text-[9px] text-white/60 font-black uppercase tracking-wide bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded-full">
                                {totalParts} parts
                              </span>
                            </div>
                            <p className="text-[11px] text-white/40 mt-0.5 truncate">Recommended order to enjoy the whole story</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="hidden sm:flex items-baseline gap-1 text-[10px] font-bold text-white/40">
                            {hasActive ? (
                              <>Part <span className="text-primary font-black">{activeIdx + 1}</span> of {totalParts}</>
                            ) : (
                              `${totalParts} parts`
                            )}
                          </span>
                          <ChevronRight className={`w-4 h-4 text-white/40 transition-transform group-hover:text-white/70 ${showSeasonGuide ? "rotate-90" : ""}`} />
                        </div>
                      </button>

                      {/* progress bar */}
                      <div className="relative h-0.5 bg-white/[0.06]">
                        <div className="h-full bg-gradient-to-r from-primary to-primary/60 shadow-[0_0_6px_hsl(var(--primary)/0.4)] transition-all duration-500" style={{ width: `${hasActive ? progressPct : 0}%` }} />
                      </div>

                      {/* ── Expanded body ── */}
                      {showSeasonGuide && (
                        <div className="relative px-4 sm:px-5 pt-4 pb-4">
                          <div className="relative">
                            {/* timeline spine — passes through poster centers (36px from left, 40px from top/bottom) */}
                            <div className="absolute left-[36px] top-10 bottom-10 w-0.5 -translate-x-1/2 bg-gradient-to-b from-primary/60 via-white/[0.08] to-transparent rounded-full" />
                            <div className="relative space-y-2">
                              {visibleFranchiseNodes.map((node, orderIndex) => {
                                const nodeId = String(node.id);
                                const isActive = nodeId === currentSeasonId || nodeId === anime?.id;
                                const meta = formatMeta(node.format);
                                const FormatIcon = meta.icon;
                                const nodeEpCount = (isActive && currentSeasonEps.length > 0) ? currentSeasonEps.length : (node.totalEpisodes || node.episodes || "?");
                                const poster = node.coverImage || (nodeId === anime?.id ? anime?.poster : null) || null;
                                return (
                                  <Link
                                    key={node.id}
                                    href={`/anime/${node.id}`}
                                    className={`relative flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-200 ${
                                      isActive
                                        ? "bg-gradient-to-r from-primary/15 to-primary/[0.04] border-primary/35 shadow-[0_8px_20px_hsl(var(--primary)/0.12)]"
                                        : "bg-white/[0.035] hover:bg-white/[0.07] border-white/[0.07] hover:border-white/[0.16] hover:-translate-y-px"
                                    }`}
                                  >
                                    {/* poster / node tile */}
                                    <div className={`relative w-16 h-22 sm:w-20 sm:h-28 rounded-lg overflow-hidden shrink-0 aspect-[2/3] ${isActive ? "shadow-[0_0_12px_hsl(var(--primary)/0.3)]" : ""}`}>
                                      {poster ? (
                                        <img src={poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                                      ) : (
                                        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${
                                          isActive ? "from-primary to-primary/60" : "from-white/[0.08] to-white/[0.03]"
                                        }`}>
                                          <span className={`text-xs font-black ${isActive ? "text-white" : "text-white/35"}`}>{orderIndex + 1}</span>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 rounded-md ring-1 ring-inset ring-white/10" />
                                      {isActive && (
                                        <div className="absolute inset-0 rounded-md ring-2 ring-primary/70" />
                                      )}
                                      {/* number badge */}
                                      <div className={`absolute bottom-1 left-1 w-4 h-4 rounded flex items-center justify-center ${
                                        isActive
                                          ? "bg-gradient-to-br from-primary to-primary/60 text-white shadow-[0_0_8px_hsl(var(--primary)/0.7)]"
                                          : "bg-black/70 text-white/80 backdrop-blur-sm"
                                      }`}>
                                        <span className="text-[8px] font-black leading-none">{orderIndex + 1}</span>
                                      </div>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`truncate text-sm ${isActive ? "text-white font-black" : "text-white/80 font-bold"}`}>
                                          {node.title}
                                        </span>
                                        {isActive && (
                                          <span className="shrink-0 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-white font-black bg-primary/25 border border-primary/50 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                            Watching
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${meta.chip}`}>
                                          <FormatIcon className="w-2.5 h-2.5" />
                                          {meta.label}
                                        </span>
                                        {node.seasonYear && <span className="text-[10px] text-white/35 font-semibold">{node.seasonYear}</span>}
                                        <span className="text-[10px] text-white/35 font-semibold">· {nodeEpCount} eps</span>
                                      </div>
                                    </div>
                                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? "text-primary" : "text-white/20"}`} />
                                  </Link>
                                );
                              })}
                            </div>
                          </div>

                          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/30">
                            <Sparkles className="w-3 h-3 text-primary shrink-0" />
                            Fan-curated viewing order · open any part to jump straight to it
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })()}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full shadow-lg" />
                      <h2 className="text-2xl font-black text-white tracking-tight">Episodes</h2>
                    </div>

                  {/* ── Right Side Controls ── */}
                  <div className="flex items-center gap-3 flex-wrap max-w-xl justify-end">
                    {currentSeasonEps.length > 0 && (
                      <EpisodeViewSelector mode={episodeView} onChange={handleViewChange} views={["list", "grid", "numbers"]} />
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

                  const items = currentSeasonEps.map(episodeToItem);

                  // Numbers view renders the full list — it's a fast navigation
                  // tool for long series and must never paginate.
                  if (episodeView === "numbers") {
                    return (
                      <div key={`numbers-${currentSeasonId}`}>
                        <EpisodeNumbersView items={items} />
                      </div>
                    );
                  }

                  const totalPages = Math.ceil(items.length / EPISODES_PER_PAGE);
                  const activePage = Math.min(Math.max(1, episodePage), Math.max(1, totalPages));
                  const startIndex = (activePage - 1) * EPISODES_PER_PAGE;
                  const sliceItems = items.slice(startIndex, startIndex + EPISODES_PER_PAGE);

                  const handlePageChange = (newPage: number) => {
                    setEpisodePage(newPage);
                    const el = document.getElementById("anime-episodes-section");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  };

                  return (
                    <div key={`${episodeView}-${currentSeasonId}`}>
                      <EpisodePagination
                        currentPage={activePage}
                        totalPages={totalPages}
                        totalItems={items.length}
                        itemsPerPage={EPISODES_PER_PAGE}
                        onPageChange={handlePageChange}
                        className="pt-0 pb-4 border-t-0 border-b border-white/[0.06] mb-5 mt-0"
                      />

                      {episodeView === "grid" ? (
                        <EpisodeGridView items={sliceItems} />
                      ) : (
                        <EpisodeListView items={sliceItems} />
                      )}

                      <EpisodePagination
                        currentPage={activePage}
                        totalPages={totalPages}
                        totalItems={items.length}
                        itemsPerPage={EPISODES_PER_PAGE}
                        onPageChange={handlePageChange}
                      />
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
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6 px-5 md:px-0">
                  {recommendations.slice(0, 12).map((item: any, i: number) => (
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
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6 px-5 md:px-0">
                  {Array.from({ length: 10 }).map((_, i) => (
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
