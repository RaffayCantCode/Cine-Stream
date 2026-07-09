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
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const minItems = Math.max(parseInt(searchParams.get("minItems") || "12", 10), 1);
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

    if (items.length < minItems && fallbackGenres.length > 0) {
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

    const seen = new Set<string>();
    items = items.filter((item: any) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return NextResponse.json({ success: true, items: items.slice(0, Math.max(minItems, 20)) }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" } });
  } catch {
    return NextResponse.json({ success: false, items: [] });
  }
}
