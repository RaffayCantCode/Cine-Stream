export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = request.nextUrl.searchParams.get("page") || "1";
  const shuffle = request.nextUrl.searchParams.get("shuffle") === "1";
  const seed = request.nextUrl.searchParams.get("seed") || `${Date.now()}`;
  
  const themeMap: Record<string, { endpoint: string, query: Record<string, string>, type: string }> = {
    'k-dramas': { endpoint: '/discover/tv', query: { with_origin_country: 'KR', with_genres: '18' }, type: 'tv' },
    'superhero': { endpoint: '/discover/movie', query: { with_keywords: '9715' }, type: 'movie' },
    'true-crime': { endpoint: '/discover/tv', query: { with_genres: '99,80' }, type: 'tv' },
    'sci-fi-fantasy': { endpoint: '/discover/movie', query: { with_genres: '878,14' }, type: 'movie' },
    'rom-com': { endpoint: '/discover/movie', query: { with_genres: '10749,35' }, type: 'movie' },
    'action-packed': { endpoint: '/discover/movie', query: { with_genres: '28,53' }, type: 'movie' },
    'horror-thriller': { endpoint: '/discover/movie', query: { with_genres: '27,53' }, type: 'movie' },
    'fantasy-magic': { endpoint: '/discover/movie', query: { with_genres: '14,12' }, type: 'movie' },
    'feel-good-comedy': { endpoint: '/discover/movie', query: { with_genres: '35,10751' }, type: 'movie' },
    'documentary': { endpoint: '/discover/movie', query: { with_genres: '99' }, type: 'movie' },
  };

  const theme = themeMap[params.slug];
  if (!theme) return Response.json({ results: [] }, { headers: noStoreHeaders });

  try {
    const requestedPage = Number(page) || 1;
    const seedValue = hashSeed(`${params.slug}-${seed}`);
    const randomFirstPage = shuffle && requestedPage === 1
      ? String((seedValue % 20) + 1)
      : String(requestedPage);
    const dateSort = theme.type === "tv" ? "first_air_date.desc" : "primary_release_date.desc";
    const sortOptions = ["popularity.desc", "vote_count.desc", dateSort];
    const sortBy = shuffle
      ? sortOptions[seedValue % sortOptions.length]
      : "popularity.desc";

    const data: any = await tmdbFetch(
      theme.endpoint,
      { ...theme.query, page: randomFirstPage, sort_by: sortBy },
      { noCache: shuffle }
    );
    // Add media_type for components to route correctly
    if (data.results) {
      const mapped = data.results.map((r: any) => ({ ...r, media_type: theme.type }));
      data.results = shuffle ? seededShuffle(mapped, `${params.slug}-${seed}-${page}`) : mapped;
    }
    return Response.json(data, { headers: shuffle ? noStoreHeaders : undefined });
  } catch (error) {
    return Response.json({ error: "Failed to fetch theme" }, { status: 500, headers: noStoreHeaders });
  }
}
