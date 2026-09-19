"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Film, Sparkles, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeasonInfo } from "@/lib/anime-fetch";

export interface FranchiseNodeItem {
  id: string | number;
  idMal?: string | number | null;
  title: string;
  episodes?: number | null;
  totalEpisodes?: number | null;
  format?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  coverImage?: string | null;
  seasonLabel?: string | null;
  matchingSeason?: SeasonInfo | null;
  duration?: number | null;
  tmdbId?: number | null;
  tmdbSeasonNumber?: number | null;
  episodeOffset?: number | null;
  shortLabel?: string;
}

interface AnimeSeasonSelectorProps {
  franchiseNodes: FranchiseNodeItem[];
  currentSeasons?: SeasonInfo[];
  currentAnimeId: string;
  currentSeasonId?: string;
  animeTitle?: string;
}

const SPECIAL_REGEX = /\b(ova|oav|special|specials|chibi|petit|spin-?off|picture\s+drama|audio\s+drama|recap|summary|digest|omake|bonus|blooper|interlude|side\s+story|lost\s+girls|no\s+regrets|ilse|slime\s+diaries|tensura\s+nikki|coleus\s+no\s+yume|marumaru\s+no\s+mahou|titan\s+junior\s+high|preview|pv|tokubetsu|collab|crossover)\b/i;
const MOVIE_REGEX = /\b(movie|the\s+movie|film|theatrical|gekijouban|scarlet\s+bond|mugen\s+train|jujutsu\s+kaisen\s+0|two\s+heroes|heroes\s+rising|world\s+heroes|you'?re\s+next)\b/i;

function getSafeTitle(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    return val.english || val.romaji || val.native || val.name || val.title || "";
  }
  return String(val);
}

export function AnimeSeasonSelector({
  franchiseNodes,
  currentSeasons = [],
  currentAnimeId,
  currentSeasonId,
  animeTitle,
}: AnimeSeasonSelectorProps) {
  const [moviesOpen, setMoviesOpen] = useState(false);
  const [specialsOpen, setSpecialsOpen] = useState(false);

  const moviesRef = useRef<HTMLDivElement>(null);
  const specialsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (moviesRef.current && !moviesRef.current.contains(e.target as Node)) {
        setMoviesOpen(false);
      }
      if (specialsRef.current && !specialsRef.current.contains(e.target as Node)) {
        setSpecialsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Categorize franchise items into: seasons, movies, specials
  const { seasons, movies, specials } = useMemo(() => {
    // 1. Determine base source: franchiseNodes is the curated multi-part source.
    // currentSeasons is only a fallback when franchiseNodes has 0 or 1 item.
    const rawNodes = (franchiseNodes && franchiseNodes.length > 1)
      ? franchiseNodes
      : (currentSeasons && currentSeasons.length > 0)
        ? currentSeasons.map(s => ({
            id: String(s.id),
            idMal: s.idMal,
            title: getSafeTitle(s.name || s.seasonLabel || "Season"),
            episodes: s.totalEpisodes,
            totalEpisodes: s.totalEpisodes,
            format: (s.seasonLabel || "").startsWith("Movie") ? "MOVIE" : (s.seasonLabel || "").startsWith("OVA") ? "OVA" : "TV",
            seasonYear: s.seasonYear,
            seasonLabel: s.seasonLabel || null,
            coverImage: s.coverImage,
          }))
        : (franchiseNodes || []);

    const sourceNodes: FranchiseNodeItem[] = rawNodes.map(node => ({
      ...node,
      title: getSafeTitle(node.title || (node as any).name || (node as any).seasonLabel || "Season"),
    }));

    const combined: FranchiseNodeItem[] = [];
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    for (const item of sourceNodes) {
      const sId = String(item.id || "").trim().toLowerCase();
      const numId = sId.replace(/\D/g, "");
      const titleKey = getSafeTitle(item.title).toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      const yearKey = item.seasonYear ? String(item.seasonYear) : "";

      // Deduplicate by exact ID
      if (seenIds.has(sId)) continue;
      // Deduplicate by numeric ID only for fallback tmdb entries (avoid blocking distinct anime)
      if (numId && sId.startsWith("tmdb-") && seenIds.has(numId)) continue;
      // Deduplicate by title + year (e.g. duplicate entries from 1-hop relations)
      const fullTitleKey = `${titleKey}::${yearKey}`;
      if (titleKey && yearKey && seenTitles.has(fullTitleKey)) continue;

      seenIds.add(sId);
      if (numId) seenIds.add(numId);
      if (titleKey && yearKey) seenTitles.add(fullTitleKey);
      combined.push(item);
    }

    const specialsList: FranchiseNodeItem[] = [];
    const moviesList: FranchiseNodeItem[] = [];
    const rawSeasons: FranchiseNodeItem[] = [];

    for (const item of combined) {
      const title = getSafeTitle(item.title).trim();
      const fmt = (item.format || "").toUpperCase();
      const label = (item.seasonLabel || "").toLowerCase();
      const eps = item.totalEpisodes || item.episodes || 0;
      const duration = item.duration || 0;

      const cleanCurr = String(currentAnimeId || "").trim().toLowerCase();
      const itemId = String(item.id || "").trim().toLowerCase();
      const isCurrentActive = itemId === cleanCurr || (item.idMal && String(item.idMal).toLowerCase() === cleanCurr);
      const hasExplicitSeason = /\b(season\s*\d+|\d+(?:st|nd|rd|th)\s+season|final\s+season)\b/i.test(title);
      const isChibiOrMini = (duration > 0 && duration <= 15);
      const isAuthoritativeTv = fmt === "TV" && (eps >= 5 || hasExplicitSeason) && !isChibiOrMini;

      // 1. Specials (OVAs, Chibis, side stories, short ONAs, recaps, mini-series, collabs)
      const isSpecialFmt = fmt === "OVA" || fmt === "SPECIAL" || fmt === "TV_SHORT";
      const isSpecialLabel = label.startsWith("ova") || label.startsWith("special");
      const isSpecialTitle = SPECIAL_REGEX.test(title);
      const isShortOna = fmt === "ONA" && (duration <= 15 || !hasExplicitSeason || (eps > 0 && eps <= 4));
      const isShortSpecial = eps > 0 && eps <= 2 && duration > 0 && duration <= 25 && fmt !== "MOVIE";
      const isCollabTitle = /\b(collab|crossover|\bx\b)\b/i.test(title);

      const isClassedSpecial = !isAuthoritativeTv && !isCurrentActive && (isSpecialFmt || isSpecialLabel || isSpecialTitle || isShortOna || isShortSpecial || isCollabTitle || isChibiOrMini);

      if (isClassedSpecial) {
        specialsList.push(item);
        continue;
      }

      // 2. Movies (Never classify a TV series as a movie unless explicitly labeled)
      const isExplicitMovieTitle = /\b(the\s+movie|movie\s+\d+|gekijouban)\b/i.test(title);
      if (
        fmt === "MOVIE" ||
        label.startsWith("movie") ||
        (fmt !== "TV" && (MOVIE_REGEX.test(title) || isExplicitMovieTitle)) ||
        (isExplicitMovieTitle && (!eps || eps <= 2))
      ) {
        moviesList.push(item);
        continue;
      }

      // 3. Main Series Seasons
      rawSeasons.push(item);
    }

    // Filter out unreleased placeholder seasons with 0 episodes from future years or without release dates
    const currentYear = new Date().getFullYear();
    const validSeasons = rawSeasons.filter((item) => {
      const status = String((item as any).status || "").toUpperCase();
      const eps = item.totalEpisodes || item.episodes || 0;
      const yr = item.seasonYear;
      if ((!eps || eps === 0) && (status === "NOT_YET_RELEASED" || status === "UNRELEASED" || !yr || yr > currentYear)) {
        return false;
      }
      return true;
    });

    // Sort seasons chronologically, respecting curated/TMDB seasons and natural order
    validSeasons.sort((a, b) => {
      // 1. Explicit TMDB season numbers take priority if same tmdbId
      const tmdbIdA = a.matchingSeason?.tmdbId || (a as any).tmdbId || null;
      const tmdbIdB = b.matchingSeason?.tmdbId || (b as any).tmdbId || null;
      const tmdbA = a.matchingSeason?.tmdbSeasonNumber || (a as any).tmdbSeasonNumber || null;
      const tmdbB = b.matchingSeason?.tmdbSeasonNumber || (b as any).tmdbSeasonNumber || null;
      if (tmdbA && tmdbB && tmdbIdA && tmdbIdB && String(tmdbIdA) === String(tmdbIdB)) {
        if (tmdbA !== tmdbB) return tmdbA - tmdbB;
        const offA = (a as any).episodeOffset || 0;
        const offB = (b as any).episodeOffset || 0;
        if (offA !== offB) return offA - offB;
      }

      // 2. Year comparison
      const yA = a.seasonYear || 9999;
      const yB = b.seasonYear || 9999;
      if (yA !== yB) return yA - yB;

      // 3. Airing season (WINTER < SPRING < SUMMER < FALL)
      const seasonOrder = ["WINTER", "SPRING", "SUMMER", "FALL"];
      const sA = a.season ? seasonOrder.indexOf(a.season.toUpperCase()) : -1;
      const sB = b.season ? seasonOrder.indexOf(b.season.toUpperCase()) : -1;
      if (sA !== -1 && sB !== -1 && sA !== sB) {
        return sA - sB;
      }

      // 4. Check explicit season numbers in title
      const titleA = getSafeTitle(a.title).toLowerCase();
      const titleB = getSafeTitle(b.title).toLowerCase();
      const numA = titleA.match(/season\s*(\d+)/i) || titleA.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
      const numB = titleB.match(/season\s*(\d+)/i) || titleB.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
      if (numA && numB) {
        const diff = parseInt(numA[1], 10) - parseInt(numB[1], 10);
        if (diff !== 0) return diff;
      }

      // 5. Check explicit part numbers in title
      const partA = titleA.match(/(?:part|cour)\s*(\d+)/i);
      const partB = titleB.match(/(?:part|cour)\s*(\d+)/i);
      if (partA && partB) {
        const diff = parseInt(partA[1], 10) - parseInt(partB[1], 10);
        if (diff !== 0) return diff;
      }

      // 6. Source order preservation
      const idxA = sourceNodes.findIndex(x => String(x.id) === String(a.id));
      const idxB = sourceNodes.findIndex(x => String(x.id) === String(b.id));
      return idxA - idxB;
    });

    // Label seasons with clean TV-style badges: S1, S2, S3, S3 P2, S4, S4 P2...
    let seasonCounter = 0;
    let lastMainSeasonNum = 0;

    const labeledSeasons = validSeasons.map((item) => {
      const title = getSafeTitle(item.title).toLowerCase();
      const explicitSeason = title.match(/season\s*(\d+)/i) || title.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
      const explicitPart = title.match(/(?:part|cour)\s*(\d+)/i);
      const partNum = explicitPart ? parseInt(explicitPart[1], 10) : null;
      const isFinalSeason = /\b(final\s+season|the\s+final)\b/i.test(title);

      // Curated / TMDB season number takes precedence if explicitly mapped (e.g. JoJo, Fate, Pokemon)
      let sNum: number | null = item.matchingSeason?.tmdbSeasonNumber || (item as any).tmdbSeasonNumber || null;
      let forcePart: number | null = null;

      if (!sNum) {
        if (explicitSeason) {
          sNum = parseInt(explicitSeason[1], 10);
          if (partNum && partNum > 1) {
            forcePart = partNum;
          }
        } else if (isFinalSeason) {
          // Attack on Titan Final Season: if Part 2/3, stay on season 4 (or lastMainSeasonNum)!
          if (partNum && partNum > 1 && lastMainSeasonNum > 0) {
            sNum = lastMainSeasonNum;
            forcePart = partNum;
          } else {
            sNum = Math.max(lastMainSeasonNum + 1, 4);
          }
        } else if (partNum && (partNum === 2 || partNum === 3) && lastMainSeasonNum > 0 && !title.includes("jojo")) {
          // Split-cour continuing preceding season (e.g. Mushoku Tensei Part 2, Spy x Family Part 2, 86 Part 2)
          sNum = lastMainSeasonNum;
          forcePart = partNum;
        } else {
          seasonCounter++;
          sNum = seasonCounter;
        }
      } else {
        // sNum was explicitly provided (e.g. curated franchise or TMDB mapped)
        if (explicitSeason && partNum && partNum > 1) {
          forcePart = partNum;
        } else if (isFinalSeason && partNum && partNum > 1) {
          forcePart = partNum;
        }
      }

      // Check offset for split parts (e.g. JoJo Egypt offset 24 -> P2, Pokemon offset -> P2)
      if (!forcePart && (item as any).episodeOffset && (item as any).episodeOffset > 0) {
        forcePart = 2;
      }

      lastMainSeasonNum = sNum;
      seasonCounter = Math.max(seasonCounter, sNum);

      let shortLabel = `S${sNum}`;
      if (forcePart && forcePart > 1) {
        shortLabel += ` P${forcePart}`;
      }

      return {
        ...item,
        shortLabel,
      };
    });

    // Deduplicate by shortLabel so duplicate seasons (e.g. two S1 or two S2) can never appear
    const finalSeasons: FranchiseNodeItem[] = [];
    const seenLabels = new Set<string>();
    for (const s of labeledSeasons) {
      if (s.shortLabel && seenLabels.has(s.shortLabel)) {
        continue;
      }
      if (s.shortLabel) seenLabels.add(s.shortLabel);
      finalSeasons.push(s);
    }

    // Sort movies and specials chronologically, preserving source order when years are equal
    moviesList.sort((a, b) => {
      const yA = a.seasonYear || 9999;
      const yB = b.seasonYear || 9999;
      if (yA !== yB) return yA - yB;
      const idxA = sourceNodes.findIndex(x => String(x.id) === String(a.id));
      const idxB = sourceNodes.findIndex(x => String(x.id) === String(b.id));
      return idxA - idxB;
    });

    specialsList.sort((a, b) => {
      const yA = a.seasonYear || 9999;
      const yB = b.seasonYear || 9999;
      if (yA !== yB) return yA - yB;
      const idxA = sourceNodes.findIndex(x => String(x.id) === String(a.id));
      const idxB = sourceNodes.findIndex(x => String(x.id) === String(b.id));
      return idxA - idxB;
    });

    return {
      seasons: finalSeasons,
      movies: moviesList,
      specials: specialsList,
    };
  }, [franchiseNodes, currentSeasons]);

  // If there are no multi-part entries to switch between (e.g. standalone movie or single 1-season show with no specials/movies), don't show the bar
  const totalEntries = seasons.length + movies.length + specials.length;
  if (totalEntries <= 1) {
    return null;
  }

  const cleanCurrentId = String(currentAnimeId || "").trim().toLowerCase();
  const cleanSeasonId = String(currentSeasonId || "").trim().toLowerCase();
  const numCurrentId = parseInt(cleanCurrentId.replace(/\D/g, ""), 10) || 0;

  const isItemActive = (item: FranchiseNodeItem) => {
    if (!item?.id) return false;
    const sId = String(item.id).trim().toLowerCase();
    if (sId === cleanCurrentId || sId === cleanSeasonId) return true;
    if (item.idMal && String(item.idMal).toLowerCase() === cleanCurrentId) return true;
    const itemNum = parseInt(sId.replace(/\D/g, ""), 10);
    if (numCurrentId > 0 && itemNum > 0 && itemNum === numCurrentId) return true;
    if (item.matchingSeason?.id && String(item.matchingSeason.id).toLowerCase() === cleanSeasonId) return true;
    return false;
  };

  const isAnyMovieActive = movies.some(isItemActive);
  const isAnySpecialActive = specials.some(isItemActive);

  return (
    <div className="w-full flex items-center justify-end gap-2 flex-wrap mb-3 select-none">
      {/* Main TV Seasons */}
      {seasons.map((s) => {
        const active = isItemActive(s);
        return (
          <Link
            key={`season-pill-${s.id}`}
            href={`/anime/${s.id}`}
            title={getSafeTitle(s.title)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0",
              active
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-1 ring-primary/40 font-black"
                : "bg-white/[0.06] text-white/70 hover:bg-white/[0.14] hover:text-white border border-white/[0.08]"
            )}
          >
            <span>{s.shortLabel}</span>
            {s.seasonYear && (
              <span className={cn("text-[10px] font-bold tracking-tight inline", active ? "text-primary-foreground/95" : "text-white/80")}>
                {s.seasonYear}
              </span>
            )}
          </Link>
        );
      })}

      {/* Vertical divider if we have movies or specials */}
      {(movies.length > 0 || specials.length > 0) && seasons.length > 0 && (
        <div className="w-px h-5 bg-white/10 shrink-0 self-center mx-0.5 hidden sm:block" />
      )}

      {/* Movies Dropdown */}
      {movies.length > 0 && (
        <div className="relative" ref={moviesRef}>
          <button
            onClick={() => {
              setMoviesOpen((v) => !v);
              setSpecialsOpen(false);
            }}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-sm border shrink-0 active:scale-95",
              isAnyMovieActive
                ? "bg-purple-600/30 text-purple-200 border-purple-500/40 ring-1 ring-purple-500/30"
                : "bg-white/[0.06] text-white/75 hover:bg-white/[0.12] hover:text-white border-white/[0.08]"
            )}
            aria-expanded={moviesOpen}
          >
            <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Movies</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-white/10 text-white/70">
              {movies.length}
            </span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200 opacity-60", moviesOpen && "rotate-180")} />
          </button>

          {moviesOpen && (
            <div className="absolute right-0 mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-1.5 space-y-1 max-h-80 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/40 border-b border-white/[0.06] mb-1">
                Theatrical Movies ({movies.length})
              </div>
              {movies.map((m) => {
                const active = isItemActive(m);
                return (
                  <Link
                    key={`movie-${m.id}`}
                    href={`/anime/${m.id}`}
                    onClick={() => setMoviesOpen(false)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors group",
                      active
                        ? "bg-purple-500/20 text-purple-200 border border-purple-500/30"
                        : "text-white/80 hover:bg-white/[0.08] hover:text-white"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate group-hover:text-white">{getSafeTitle(m.title)}</div>
                      <div className="text-[10px] text-white/70 mt-0.5 flex items-center gap-2">
                        {m.seasonYear && <span className="text-white/90 font-medium">{m.seasonYear}</span>}
                        <span>Movie</span>
                      </div>
                    </div>
                    {active && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Specials Dropdown */}
      {specials.length > 0 && (
        <div className="relative" ref={specialsRef}>
          <button
            onClick={() => {
              setSpecialsOpen((v) => !v);
              setMoviesOpen(false);
            }}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-sm border shrink-0 active:scale-95",
              isAnySpecialActive
                ? "bg-amber-600/30 text-amber-200 border-amber-500/40 ring-1 ring-amber-500/30"
                : "bg-white/[0.06] text-white/75 hover:bg-white/[0.12] hover:text-white border-white/[0.08]"
            )}
            aria-expanded={specialsOpen}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Specials</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-white/10 text-white/70">
              {specials.length}
            </span>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200 opacity-60", specialsOpen && "rotate-180")} />
          </button>

          {specialsOpen && (
            <div className="absolute right-0 mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-1.5 space-y-1 max-h-80 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/40 border-b border-white/[0.06] mb-1">
                OVAs & Specials ({specials.length})
              </div>
              {specials.map((sp) => {
                const active = isItemActive(sp);
                const isOva = (sp.format || "").toUpperCase() === "OVA" || (sp.seasonLabel || "").toLowerCase().startsWith("ova");
                return (
                  <Link
                    key={`special-${sp.id}`}
                    href={`/anime/${sp.id}`}
                    onClick={() => setSpecialsOpen(false)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors group",
                      active
                        ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                        : "text-white/80 hover:bg-white/[0.08] hover:text-white"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate group-hover:text-white">{getSafeTitle(sp.title)}</div>
                      <div className="text-[10px] text-white/70 mt-0.5 flex items-center gap-2">
                        {sp.seasonYear && <span className="text-white/90 font-medium">{sp.seasonYear}</span>}
                        <span className={isOva ? "text-amber-300" : "text-white/70"}>
                          {isOva ? "OVA" : "Special"}
                        </span>
                        {(sp.totalEpisodes || sp.episodes) && (
                          <span>{sp.totalEpisodes || sp.episodes} eps</span>
                        )}
                      </div>
                    </div>
                    {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
