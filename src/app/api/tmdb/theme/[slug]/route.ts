export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";
import { filterExcludeAnime } from "@/lib/utils";
import { getPopularAnime } from "@/lib/anime-fetch";

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


const themeAnimeGenres: Record<string, string> = {
  'rom-com': 'Romance',
  'fantasy-magic': 'Fantasy',
  'action-packed': 'Action',
  'feel-good-comedy': 'Comedy',
  'sci-fi-fantasy': 'Sci-Fi',
  'horror-thriller': 'Horror',
  'superhero': 'Action',
};

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = request.nextUrl.searchParams.get("page") || "1";
  const typeFilter = request.nextUrl.searchParams.get("type") || "all";
  const shuffle = request.nextUrl.searchParams.get("shuffle") === "1";
  const seed = request.nextUrl.searchParams.get("seed") || `${Date.now()}`;

  const config = themeConfigs[params.slug];
  const animeGenre = themeAnimeGenres[params.slug];
  if (!config && !animeGenre) return Response.json({ results: [], availableTypes: [] }, { headers: noStoreHeaders });

  const availableTypes: string[] = [];
  if (config?.movieQuery) availableTypes.push("movie");
  if (config?.tvQuery) availableTypes.push("tv");
  if (animeGenre) availableTypes.push("anime");

  try {
    const requestedPage = Number(page) || 1;
    const seedValue = hashSeed(`${params.slug}-${seed}`);
    const randomFirstPage = shuffle && requestedPage === 1
      ? String((seedValue % 20) + 1)
      : String(requestedPage);

    let finalResults: any[] = [];
    let totalPages = 1;

    const fetchMovie = async () => {
      if (!config?.movieQuery) return { results: [], total_pages: 1 };
      const res: any = await tmdbFetch("/discover/movie", {
        ...config.movieQuery,
        without_keywords: "210024",
        without_original_language: "ja",
        without_genres: "16",
        page: randomFirstPage,
        sort_by: "popularity.desc"
      }, { noCache: shuffle });
      const raw = (res?.results || []).map((r: any) => ({ ...r, media_type: "movie" }));
      return {
        results: filterExcludeAnime(raw),
        total_pages: res?.total_pages || 1
      };
    };

    const fetchTv = async () => {
      if (!config?.tvQuery) return { results: [], total_pages: 1 };
      const res: any = await tmdbFetch("/discover/tv", {
        ...config.tvQuery,
        without_keywords: "210024",
        without_original_language: "ja",
        without_genres: "16",
        page: randomFirstPage,
        sort_by: "popularity.desc"
      }, { noCache: shuffle });
      const raw = (res?.results || []).map((r: any) => ({ ...r, media_type: "tv" }));
      return {
        results: filterExcludeAnime(raw),
        total_pages: res?.total_pages || 1
      };
    };

    const fetchAnime = async () => {
      if (!animeGenre) return { results: [], total_pages: 1 };
      try {
        const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2500));
        const animePromise = (async () => {
          const items = await getPopularAnime(requestedPage, animeGenre);
          return items || [];
        })();
        const animeItems = await Promise.race([animePromise, timeoutPromise]);
        const results = (animeItems || []).map((a) => ({
          id: a.id,
          anilistId: a.id,
          title: a.name,
          name: a.name,
          poster_path: a.poster,
          backdrop_path: a.bannerImage || a.poster,
          media_type: "anime" as const,
          vote_average: a.rating ? parseFloat(a.rating) : 8.5,
          vote_count: 500,
          overview: a.description || "",
          release_date: a.seasonYear ? `${a.seasonYear}-01-01` : "",
          original_language: "ja",
          genre_ids: [16],
          isTmdbAnime: false,
        }));
        return {
          results,
          total_pages: 5,
        };
      } catch {
        return { results: [], total_pages: 1 };
      }
    };

    if (typeFilter === "movie" && config?.movieQuery) {
      const movieRes = await fetchMovie();
      finalResults = movieRes.results;
      totalPages = movieRes.total_pages;
    } else if (typeFilter === "tv" && config?.tvQuery) {
      const tvRes = await fetchTv();
      finalResults = tvRes.results;
      totalPages = tvRes.total_pages;
    } else if (typeFilter === "anime" && animeGenre) {
      const animeRes = await fetchAnime();
      finalResults = animeRes.results;
      totalPages = animeRes.total_pages;
    } else {
      // All media types: fetch movies, TV, and anime in parallel
      const [mRes, tRes, aRes] = await Promise.all([fetchMovie(), fetchTv(), fetchAnime()]);
      const mList = mRes.results;
      const tList = tRes.results;
      // In All Media view, include a curated subset (max 4 per page) so anime doesn't overwhelm the page
      const aList = aRes.results.slice(0, 4);
      totalPages = Math.max(mRes.total_pages, tRes.total_pages);

      // Balanced 4:1 ratio (2 movies, 2 TV shows, 1 anime)
      let mIdx = 0, tIdx = 0, aIdx = 0;
      while (mIdx < mList.length || tIdx < tList.length || aIdx < aList.length) {
        if (mIdx < mList.length) finalResults.push(mList[mIdx++]);
        if (mIdx < mList.length) finalResults.push(mList[mIdx++]);
        if (tIdx < tList.length) finalResults.push(tList[tIdx++]);
        if (tIdx < tList.length) finalResults.push(tList[tIdx++]);
        if (aIdx < aList.length) finalResults.push(aList[aIdx++]);
      }
    }

    // Filter out hidden items
    try {
      const { getHiddenMediaSet, isMediaItemHidden } = await import("@/lib/media-overrides");
      const hiddenSet = await getHiddenMediaSet();
      finalResults = finalResults.filter((item: any) => !isMediaItemHidden(item, hiddenSet));
    } catch {}

    if (shuffle) {
      finalResults = seededShuffle(finalResults, `${params.slug}-${seed}-${page}`);
    }

    return Response.json(
      { results: finalResults, total_pages: totalPages, page: requestedPage, availableTypes },
      { headers: shuffle ? noStoreHeaders : cacheHeaders(3600) }
    );
  } catch (error) {
    return Response.json({ error: "Failed to fetch theme" }, { status: 500, headers: noStoreHeaders });
  }
}
