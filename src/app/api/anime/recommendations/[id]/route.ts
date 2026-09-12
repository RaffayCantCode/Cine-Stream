export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
import { shouldAttemptPrimary, recordPrimarySuccess, recordPrimaryFailure } from "@/lib/anime-health";

const ANILIST_API = "https://graphql.anilist.co";

// In-memory cache for ultra-fast responses (0ms on repeated views)
const RECS_CACHE = new Map<string, { items: any[]; timestamp: number }>();
const RECS_TTL = 12 * 60 * 60 * 1000; // 12 hours

// Generic / low-signal tags to exclude from similarity clustering
const GENERIC_CATS = new Set([
  "present", "earth", "japan", "asia", "novel", "manga", "anime",
  "male-protagonist", "female-protagonist", "primarily-male-cast",
  "primarily-female-cast", "all-ages", "original-work", "web-novel",
  "light-novel", "visual-novel", "doujinshi", "short-episodes"
]);

function cleanFranchiseRoot(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/\s*[:\-\–\—]?\s*((\d+(st|nd|rd|th)?\s+)?(season|part|cour|arc|chapter|series)|\d+(st|nd|rd|th)|the\s+final|final\s+season|the\s+movie|movie\s+\d+|\(movie\)|\(tv\)|\(ova\)|\(special\)|hashira\s+training|thousand-year\s+blood\s+war|war\s+of\s+underworld|alicization|stone\s+ocean|\bIV\b|\bIII\b|\bII\b|\b\d+\b).*/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function isSameFranchise(
  candidateTitle: string,
  currentTitle: string,
  excludeIds: Set<string>,
  candidateId: string | number
): boolean {
  if (!candidateTitle) return false;
  if (excludeIds.has(String(candidateId))) return true;

  const currentRoot = cleanFranchiseRoot(currentTitle);
  const candRoot = cleanFranchiseRoot(candidateTitle);

  if (currentRoot.length >= 3 && candRoot.length >= 3) {
    if (currentRoot === candRoot || currentRoot.includes(candRoot) || candRoot.includes(currentRoot)) {
      return true;
    }
  }

  const currentTokens = currentRoot.split(/\s+/).filter(w => w.length > 2);
  const candTokens = candRoot.split(/\s+/).filter(w => w.length > 2);
  if (currentTokens.length >= 2 && candTokens.length >= 2) {
    const matching = currentTokens.filter(t => candTokens.includes(t));
    if (matching.length >= Math.min(currentTokens.length, candTokens.length)) {
      return true;
    }
  }

  return false;
}

const RECOMMENDATIONS_QUERY = `
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
`;

function transformAniListMedia(media: any) {
  if (!media || media.isAdult) return null;
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const minItems = Math.max(parseInt(searchParams.get("minItems") || "14", 10), 1);
  let currentTitle = searchParams.get("title") || "";
  let fallbackGenres = searchParams.get("genres")?.split(",").map(g => g.trim()).filter(Boolean) || [];
  const reqFormat = (searchParams.get("format") || "").toUpperCase();
  const isMovieReq = reqFormat === "MOVIE" || /\b(movie|film)\b/i.test(currentTitle);

  const excludeIds = new Set(
    searchParams.get("excludeIds")?.split(",").filter(Boolean) || []
  );
  excludeIds.add(String(id));

  // 1. Check in-memory cache
  const cacheKey = `v5_${id}_${currentTitle.toLowerCase().trim()}_${reqFormat}`;
  const cached = RECS_CACHE.get(cacheKey) || (currentTitle ? RECS_CACHE.get(currentTitle.toLowerCase().trim()) : null);
  if (cached && Date.now() - cached.timestamp < RECS_TTL && cached.items.length >= 10) {
    return NextResponse.json(
      { success: true, items: cached.items },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" } }
    );
  }

  try {
    let anilistId: number | null = /^\d+$/.test(id) ? parseInt(id, 10) : null;
    let kitsuId: string | null = id.startsWith("kitsu-") ? id.replace("kitsu-", "") : null;
    let malId: string | null = id.startsWith("mal-") ? id.replace("mal-", "") : null;
    let tmdbId: number | null = id.startsWith("tmdb-") ? parseInt(id.replace("tmdb-", ""), 10) : null;

    // 2. Resolve cross-platform IDs via AniZip
    const azQuery = kitsuId
      ? `kitsu_id=${kitsuId}`
      : malId
      ? `mal_id=${malId}`
      : tmdbId
      ? `themoviedb_id=${tmdbId}`
      : anilistId
      ? `anilist_id=${anilistId}`
      : null;

    if (azQuery) {
      try {
        const azRes = await fetch(`https://api.ani.zip/mappings?${azQuery}`, {
          signal: AbortSignal.timeout(2000),
          headers: { "User-Agent": "CineStream/1.0" },
        });
        if (azRes.ok) {
          const az = await azRes.json();
          if (az?.mappings) {
            if (az.mappings.anilist_id && !anilistId) anilistId = parseInt(String(az.mappings.anilist_id), 10);
            if (az.mappings.kitsu_id && !kitsuId) kitsuId = String(az.mappings.kitsu_id);
            if (az.mappings.mal_id && !malId) malId = String(az.mappings.mal_id);
            if (az.mappings.themoviedb_id && !tmdbId) {
              const t = parseInt(String(az.mappings.themoviedb_id), 10);
              if (!isNaN(t)) tmdbId = t;
            }
          }
          if (!currentTitle && az?.titles) {
            currentTitle = az.titles.en || az.titles.rj || az.titles.en_us || "";
          }
        }
      } catch {}
    }

    const currentRoot = cleanFranchiseRoot(currentTitle);
    const seenFranchiseRoots = new Set<string>();
    if (currentRoot.length >= 3) {
      seenFranchiseRoots.add(currentRoot);
    }

    interface Candidate {
      item: any;
      score: number;
    }
    const candidates: Candidate[] = [];

    const tryAddCandidate = (item: any, baseScore: number): boolean => {
      const itemTitle = item.name || item.title;
      if (!itemTitle) return false;
      const sId = String(item.id);
      if (excludeIds.has(sId)) return false;

      // Never recommend specials, OVAs, or promotional shorts when looking for TV anime shows
      if (!isMovieReq) {
        const fmtUpper = String(item.format || item.type || "").toUpperCase();
        const isSpecialFormat = fmtUpper === "SPECIAL" || fmtUpper === "OVA" || fmtUpper === "TV_SHORT" || fmtUpper === "MUSIC";
        const hasSpecialTitle = /\b(special|specials|ova|oav|jump\s+festa|picture\s+drama|audio\s+drama|recap|side\s+story|omake|bonus|interlude)\b/i.test(itemTitle);
        const isLowEpisodeSpecial = (item.episodes?.sub != null && item.episodes.sub <= 3) && (isSpecialFormat || hasSpecialTitle);
        if (isSpecialFormat || hasSpecialTitle || isLowEpisodeSpecial) {
          return false;
        }
      }

      // Strictly exclude any member of the current show's franchise
      if (isSameFranchise(itemTitle, currentTitle, excludeIds, item.id)) return false;

      // Collapse recommended shows so we don't recommend multiple parts of the same series
      const root = cleanFranchiseRoot(itemTitle);
      if (root.length >= 3) {
        if (seenFranchiseRoots.has(root)) return false;
        for (const seen of seenFranchiseRoots) {
          if (seen === root || seen.includes(root) || root.includes(seen)) {
            return false;
          }
        }
        seenFranchiseRoots.add(root);
      }

      // Genre & format affinity
      const targetGenresLower = new Set(fallbackGenres.map(g => g.toLowerCase().trim()));
      let overlap = 0;
      for (const g of item.genres || []) {
        if (targetGenresLower.has(String(g).toLowerCase().trim())) overlap++;
      }

      const isSameFormat = isMovieReq ? (item.format === "MOVIE") : (item.format !== "MOVIE");
      const formatBonus = isSameFormat ? 4 : 0;

      const ratingVal = parseFloat(item.rating || "7.0");
      const qualityScore = !isNaN(ratingVal) ? ratingVal / 2 : 3.5;
      const totalScore = baseScore + (overlap * 3) + formatBonus + qualityScore;

      candidates.push({ item, score: totalScore });
      excludeIds.add(sId);
      return true;
    };

    // ── STEP 1: AniList Community Recommendations (voted by fans) ───────────
    if (anilistId && !isNaN(anilistId) && shouldAttemptPrimary()) {
      try {
        const alRes = await fetch(ANILIST_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "CineStream/1.0",
          },
          body: JSON.stringify({ query: RECOMMENDATIONS_QUERY, variables: { id: anilistId } }),
          signal: AbortSignal.timeout(1800),
        });
        if (alRes.ok) {
          recordPrimarySuccess();
          const data = await alRes.json();
          const nodes = data?.data?.Media?.recommendations?.nodes || [];
          for (const node of nodes) {
            const rec = node?.mediaRecommendation;
            if (rec) {
              const transformed = transformAniListMedia(rec);
              if (transformed) {
                tryAddCandidate(transformed, 24);
              }
            }
          }
        } else {
          recordPrimaryFailure();
        }
      } catch {
        recordPrimaryFailure();
      }
    }

    // ── STEP 2 & 3: Run Kitsu and TMDB in Parallel if more recommendations needed ───
    let specificCategories: string[] = [];
    const targetSubtype = isMovieReq ? "movie" : "TV";

    if (candidates.length < 16) {
      const kitsuTask = (async () => {
        const searchTarget = kitsuId ? `filter[id]=${kitsuId}` : `filter[text]=${encodeURIComponent(currentTitle || id)}`;
        try {
          const kCatRes = await fetch(`https://kitsu.io/api/edge/anime?${searchTarget}&include=categories&page[limit]=1`, {
            headers: { Accept: "application/vnd.api+json", "User-Agent": "CineStream/1.0" },
            signal: AbortSignal.timeout(1800),
          });
          if (kCatRes.ok) {
            const kCatData = await kCatRes.json();
            const inc = kCatData.included || [];
            const cats = inc
              .filter((x: any) => x.type === "categories")
              .map((x: any) => x.attributes?.slug || x.attributes?.title?.toLowerCase().replace(/\s+/g, "-"))
              .filter(Boolean);
            specificCategories = cats.filter((c: string) => !GENERIC_CATS.has(c));
          }
        } catch {}

        if (specificCategories.length > 0 && candidates.length < 24) {
          const primaryPair = specificCategories.slice(0, 2);
          try {
            const catQuery = `filter[categories]=${encodeURIComponent(primaryPair.join(","))}&filter[subtype]=${targetSubtype}&sort=-userCount&page[limit]=12&include=categories`;
            const kRes = await fetch(`https://kitsu.io/api/edge/anime?${catQuery}`, {
              headers: { Accept: "application/vnd.api+json", "User-Agent": "CineStream/1.0" },
              signal: AbortSignal.timeout(2000),
            });
            if (kRes.ok) {
              const kData = await kRes.json();
              const categoriesMap = new Map<string, string>();
              for (const inc of kData.included || []) {
                if (inc.type === "categories" && inc.attributes?.title) {
                  categoriesMap.set(inc.id, inc.attributes.title);
                }
              }
              for (const kItem of kData.data || []) {
                const attr = kItem.attributes || {};
                const titleEnglish = attr.titles?.en || null;
                const titleRomaji = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
                const catIds = kItem.relationships?.categories?.data?.map((c: any) => c.id) || [];
                const kGenres = catIds.map((cid: string) => categoriesMap.get(cid)).filter(Boolean) as string[];

                tryAddCandidate({
                  id: `kitsu-${kItem.id}`,
                  name: titleEnglish || titleRomaji,
                  jname: attr.titles?.ja_jp || null,
                  poster: attr.posterImage?.large || attr.posterImage?.original || "",
                  bannerImage: attr.coverImage?.large || attr.coverImage?.original || null,
                  type: (attr.subtype || "TV").toUpperCase(),
                  episodes: { sub: attr.episodeCount || null, dub: null },
                  rating: attr.averageRating ? String((parseFloat(attr.averageRating) / 10).toFixed(1)) : null,
                  description: attr.synopsis?.replace(/<[^>]*>/g, "") || "",
                  genres: kGenres.length > 0 ? kGenres : fallbackGenres,
                  status: attr.status === "current" ? "RELEASING" : "FINISHED",
                  seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : null,
                  format: (attr.subtype || "TV").toUpperCase(),
                }, 20);
              }
            }
          } catch {}
        }
      })();

      const tmdbTask = (async () => {
        if (!tmdbId || candidates.length >= 24) return;
        try {
          const endpoint = isMovieReq
            ? `/movie/${tmdbId}/recommendations`
            : `/tv/${tmdbId}/recommendations`;

          const tmdbData = (await tmdbFetch(endpoint).catch(() => null)) as any;
          if (tmdbData?.results && Array.isArray(tmdbData.results)) {
            const animeResults = (tmdbData.results || []).filter((r: any) => {
              const isJapanese = r.original_language === "ja" || (r.origin_country && r.origin_country.includes("JP"));
              const isAnimation = r.genre_ids?.includes(16) || (r.genres && r.genres.some((g: any) => g.id === 16));
              return isJapanese && isAnimation;
            });

            const resolvedPromises = animeResults.slice(0, 6).map(async (r: any) => {
              const itemTitle = r.name || r.title || r.original_name || r.original_title;
              if (!itemTitle) return null;

              let resolvedId: string | null = null;
              try {
                const azRes = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${r.id}`, {
                  signal: AbortSignal.timeout(1500),
                  headers: { "User-Agent": "CineStream/1.0" },
                });
                if (azRes.ok) {
                  const az = await azRes.json();
                  if (az?.mappings?.anilist_id) {
                    resolvedId = String(az.mappings.anilist_id);
                  } else if (az?.mappings?.kitsu_id) {
                    resolvedId = `kitsu-${az.mappings.kitsu_id}`;
                  }
                }
              } catch {}

              if (!resolvedId) {
                try {
                  const kSearch = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(itemTitle)}&filter[subtype]=${targetSubtype}&sort=-userCount&page[limit]=1`, {
                    signal: AbortSignal.timeout(1500),
                    headers: { Accept: "application/vnd.api+json", "User-Agent": "CineStream/1.0" },
                  });
                  if (kSearch.ok) {
                    const kData = await kSearch.json();
                    if (kData?.data?.[0]?.id) {
                      resolvedId = `kitsu-${kData.data[0].id}`;
                    }
                  }
                } catch {}
              }

              if (!resolvedId) return null;

              return {
                id: resolvedId,
                name: itemTitle,
                jname: r.original_name || r.original_title || null,
                poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : "",
                bannerImage: r.backdrop_path ? `https://image.tmdb.org/t/p/original${r.backdrop_path}` : null,
                type: isMovieReq ? "MOVIE" : "TV",
                episodes: { sub: null, dub: null },
                rating: r.vote_average ? String(r.vote_average.toFixed(1)) : null,
                description: r.overview || "",
                genres: fallbackGenres,
                status: "FINISHED",
                seasonYear: (r.release_date || r.first_air_date) ? new Date(r.release_date || r.first_air_date).getFullYear() : null,
                format: isMovieReq ? "MOVIE" : "TV",
              };
            });

            const resolvedCandidates = (await Promise.all(resolvedPromises)).filter(Boolean);
            for (const cand of resolvedCandidates) {
              if (cand) tryAddCandidate(cand, 18);
            }
          }
        } catch {}
      })();

      await Promise.allSettled([kitsuTask, tmdbTask]);
    }

    // ── STEP 4: Secondary High-Affinity Category Fallback ────────────────────
    if (candidates.length < 16 && specificCategories.length > 0) {
      for (const cat of specificCategories.slice(0, 3)) {
        if (candidates.length >= 24) break;
        try {
          const kRes = await fetch(
            `https://kitsu.io/api/edge/anime?filter[categories]=${encodeURIComponent(cat)}&filter[subtype]=${targetSubtype}&sort=-userCount&page[limit]=10&include=categories`,
            {
              headers: { Accept: "application/vnd.api+json", "User-Agent": "CineStream/1.0" },
              signal: AbortSignal.timeout(2000),
            }
          );
          if (kRes.ok) {
            const kData = await kRes.json();
            for (const kItem of kData.data || []) {
              const attr = kItem.attributes || {};
              const titleEnglish = attr.titles?.en || null;
              const titleRomaji = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
              tryAddCandidate({
                id: `kitsu-${kItem.id}`,
                name: titleEnglish || titleRomaji,
                jname: attr.titles?.ja_jp || null,
                poster: attr.posterImage?.large || attr.posterImage?.original || "",
                bannerImage: attr.coverImage?.large || attr.coverImage?.original || null,
                type: (attr.subtype || "TV").toUpperCase(),
                episodes: { sub: attr.episodeCount || null, dub: null },
                rating: attr.averageRating ? String((parseFloat(attr.averageRating) / 10).toFixed(1)) : null,
                description: attr.synopsis?.replace(/<[^>]*>/g, "") || "",
                genres: fallbackGenres,
                status: attr.status === "current" ? "RELEASING" : "FINISHED",
                seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : null,
                format: (attr.subtype || "TV").toUpperCase(),
              }, 12);
            }
          }
        } catch {}
      }
    }

    // ── STEP 5: Top-Rated Safety Net (Guarantees recommendations on ALL anime) ─
    if (candidates.length < 12) {
      try {
        const primaryGenre = fallbackGenres[0]?.toLowerCase() || "action";
        const kRes = await fetch(
          `https://kitsu.io/api/edge/anime?filter[categories]=${encodeURIComponent(primaryGenre)}&filter[subtype]=${targetSubtype}&sort=-averageRating&page[limit]=15`,
          {
            headers: { Accept: "application/vnd.api+json", "User-Agent": "CineStream/1.0" },
            signal: AbortSignal.timeout(2000),
          }
        );
        if (kRes.ok) {
          const kData = await kRes.json();
          for (const kItem of kData.data || []) {
            const attr = kItem.attributes || {};
            const titleEnglish = attr.titles?.en || null;
            const titleRomaji = attr.canonicalTitle || attr.titles?.en_jp || "Anime";
            tryAddCandidate({
              id: `kitsu-${kItem.id}`,
              name: titleEnglish || titleRomaji,
              jname: attr.titles?.ja_jp || null,
              poster: attr.posterImage?.large || attr.posterImage?.original || "",
              bannerImage: attr.coverImage?.large || attr.coverImage?.original || null,
              type: (attr.subtype || "TV").toUpperCase(),
              episodes: { sub: attr.episodeCount || null, dub: null },
              rating: attr.averageRating ? String((parseFloat(attr.averageRating) / 10).toFixed(1)) : null,
              description: attr.synopsis?.replace(/<[^>]*>/g, "") || "",
              genres: fallbackGenres,
              status: attr.status === "current" ? "RELEASING" : "FINISHED",
              seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : null,
              format: (attr.subtype || "TV").toUpperCase(),
            }, 6);
          }
        }
      } catch {}
    }

    // Sort by relevance & quality score descending
    candidates.sort((a, b) => b.score - a.score);

    const sortedItems = candidates.map(c => c.item).slice(0, Math.max(minItems, 18));

    // Cache the resolved recommendations
    if (sortedItems.length > 0) {
      const entry = { items: sortedItems, timestamp: Date.now() };
      RECS_CACHE.set(cacheKey, entry);
      if (currentTitle) RECS_CACHE.set(currentTitle.toLowerCase().trim(), entry);
      RECS_CACHE.set(String(id), entry);
    }

    return NextResponse.json(
      { success: true, items: sortedItems },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" } }
    );
  } catch (error) {
    console.error("[Anime Recommendations Error]:", error);
    return NextResponse.json({ success: false, items: [] });
  }
}

