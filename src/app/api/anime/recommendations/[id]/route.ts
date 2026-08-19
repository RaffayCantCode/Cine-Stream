export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextResponse } from "next/server";

const ANILIST_API = "https://graphql.anilist.co";

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

const GENRE_SEARCH_QUERY = `
query ($genres: [String], $page: Int) {
  Page(page: $page, perPage: 25) {
    media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC], genre_in: $genres) {
      id idMal isAdult title { romaji english native }
      coverImage { large extraLarge }
      episodes genres averageScore description status type format season seasonYear
    }
  }
}
`;

async function anilistQuery(query: string, variables: Record<string, any>): Promise<any> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Accept": "application/json",
      "User-Agent": "CineStream/1.0 (https://github.com/RaffayCantCode/Cine-Stream)"
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("AniList query failed");
  return res.json();
}

function transformAniListMedia(media: any) {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const minItems = Math.max(parseInt(searchParams.get("minItems") || "12", 10), 1);
  const currentTitle = searchParams.get("title") || "";
  const fallbackGenres = searchParams.get("genres")?.split(",").filter(Boolean) || [];
  const excludeIds = new Set(
    searchParams.get("excludeIds")?.split(",").filter(Boolean) || []
  );

  try {
    let items: any[] = [];

    try {
      const data = await anilistQuery(RECOMMENDATIONS_QUERY, { id: parseInt(id, 10) });
      const nodes = data?.data?.Media?.recommendations?.nodes || [];
      items = nodes
        .map((node: any) => node?.mediaRecommendation)
        .filter(Boolean)
        .map(transformAniListMedia)
        .filter(Boolean)
        .filter((item: any) => !excludeIds.has(item.id) && item.id !== id);
    } catch { /* recommendations not available */ }

    if (items.length < 24 && fallbackGenres.length > 0) {
      try {
        const existingIds = new Set(items.map((i: any) => i.id));
        const padData = await anilistQuery(GENRE_SEARCH_QUERY, { genres: fallbackGenres, page: 1 });
        const padItems = (padData?.data?.Page?.media || [])
          .map(transformAniListMedia)
          .filter(Boolean)
          .filter((item: any) => !existingIds.has(item.id) && !excludeIds.has(item.id) && item.id !== id);
        items = [...items, ...padItems];
      } catch { /* padding failed */ }
    }

    // Fallback: Kitsu category & popular recommendations (when AniList is down)
    if (items.length < 12) {
      try {
        const existingIds = new Set(items.map((i: any) => i.id));
        const primaryGenre = fallbackGenres[0] || "";
        const genreSlug = primaryGenre ? primaryGenre.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-") : "";
        let kUrl = `https://kitsu.io/api/edge/anime?sort=-userCount&page[limit]=20&include=categories`;
        if (genreSlug) {
          kUrl += `&filter[categories]=${encodeURIComponent(genreSlug)}`;
        }
        const kRes = await fetch(kUrl, {
          headers: { "Accept": "application/vnd.api+json", "User-Agent": "CineStream/1.0" },
          signal: AbortSignal.timeout(4000),
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
            const kId = "kitsu-" + kItem.id;
            if (!existingIds.has(kId) && !excludeIds.has(kId) && kItem.id !== id) {
              const attr = kItem.attributes || {};
              const catIds = kItem.relationships?.categories?.data?.map((c: any) => c.id) || [];
              const kGenres = catIds.map((cid: string) => categoriesMap.get(cid)).filter(Boolean) as string[];
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
                description: attr.synopsis?.replace(/<[^>]*>/g, "") || "",
                genres: kGenres,
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

    const balanced = balanceRecommendations(items, currentTitle, id, excludeIds, 4, Math.max(minItems, 12));
    return NextResponse.json({ success: true, items: balanced }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" } });
  } catch {
    return NextResponse.json({ success: false, items: [] });
  }
}
