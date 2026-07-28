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


interface ThemeConfig {
  movieQuery?: Record<string, string>;
  tvQuery?: Record<string, string>;
}

const themeConfigs: Record<string, ThemeConfig> = {
  'k-dramas': {
    tvQuery: { with_origin_country: 'KR', with_genres: '18' },
  },
  'superhero': {
    movieQuery: { with_keywords: '9715' },
    tvQuery: { with_keywords: '9715' },
  },
  'true-crime': {
    tvQuery: { with_genres: '99,80' },
    movieQuery: { with_genres: '99,80' },
  },
  'sci-fi-fantasy': {
    movieQuery: { with_genres: '878,14' },
    tvQuery: { with_genres: '10765' },
  },
  'rom-com': {
    movieQuery: { with_genres: '10749,35' },
    tvQuery: { with_genres: '35' },
  },
  'action-packed': {
    movieQuery: { with_genres: '28,53' },
    tvQuery: { with_genres: '10759' },
  },
  'horror-thriller': {
    movieQuery: { with_genres: '27,53' },
    tvQuery: { with_genres: '9648,80' },
  },
  'fantasy-magic': {
    movieQuery: { with_genres: '14,12' },
    tvQuery: { with_genres: '10765' },
  },
  'feel-good-comedy': {
    movieQuery: { with_genres: '35,10751' },
    tvQuery: { with_genres: '35' },
  },
  'documentary': {
    movieQuery: { with_genres: '99' },
    tvQuery: { with_genres: '99' },
  },
};

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = request.nextUrl.searchParams.get("page") || "1";
  const typeFilter = request.nextUrl.searchParams.get("type") || "all";
  const shuffle = request.nextUrl.searchParams.get("shuffle") === "1";
  const seed = request.nextUrl.searchParams.get("seed") || `${Date.now()}`;

  const config = themeConfigs[params.slug];
  if (!config) return Response.json({ results: [], availableTypes: [] }, { headers: noStoreHeaders });

  const availableTypes: string[] = [];
  if (config.movieQuery) availableTypes.push("movie");
  if (config.tvQuery) availableTypes.push("tv");

  try {
    const requestedPage = Number(page) || 1;
    const seedValue = hashSeed(`${params.slug}-${seed}`);
    const randomFirstPage = shuffle && requestedPage === 1
      ? String((seedValue % 20) + 1)
      : String(requestedPage);

    let finalResults: any[] = [];
    let totalPages = 1;

    const fetchMovie = async () => {
      if (!config.movieQuery) return { results: [], total_pages: 1 };
      const res: any = await tmdbFetch("/discover/movie", { ...config.movieQuery, page: randomFirstPage, sort_by: "popularity.desc" }, { noCache: shuffle });
      return {
        results: (res?.results || []).map((r: any) => ({ ...r, media_type: "movie" })),
        total_pages: res?.total_pages || 1
      };
    };

    const fetchTv = async () => {
      if (!config.tvQuery) return { results: [], total_pages: 1 };
      const res: any = await tmdbFetch("/discover/tv", { ...config.tvQuery, page: randomFirstPage, sort_by: "popularity.desc" }, { noCache: shuffle });
      return {
        results: (res?.results || []).map((r: any) => ({ ...r, media_type: "tv" })),
        total_pages: res?.total_pages || 1
      };
    };

    if (typeFilter === "movie" && config.movieQuery) {
      const movieRes = await fetchMovie();
      finalResults = movieRes.results;
      totalPages = movieRes.total_pages;
    } else if (typeFilter === "tv" && config.tvQuery) {
      const tvRes = await fetchTv();
      finalResults = tvRes.results;
      totalPages = tvRes.total_pages;
    } else {
      // All media types: fetch both movies and TV in parallel
      const [mRes, tRes] = await Promise.all([fetchMovie(), fetchTv()]);
      const mList = mRes.results;
      const tList = tRes.results;
      totalPages = Math.max(mRes.total_pages, tRes.total_pages);

      // Strict 1:1 equal balance interleaving
      const count = Math.min(mList.length, tList.length);
      for (let i = 0; i < count; i++) {
        finalResults.push(mList[i]);
        finalResults.push(tList[i]);
      }
      // Append remainder if one list is longer
      if (mList.length > count) finalResults.push(...mList.slice(count));
      else if (tList.length > count) finalResults.push(...tList.slice(count));
    }

    if (shuffle) {
      finalResults = seededShuffle(finalResults, `${params.slug}-${seed}-${page}`);
    }

    return Response.json({ results: finalResults, total_pages: totalPages, page: requestedPage, availableTypes }, { headers: shuffle ? noStoreHeaders : undefined });
  } catch (error) {
    return Response.json({ error: "Failed to fetch theme" }, { status: 500, headers: noStoreHeaders });
  }
}
