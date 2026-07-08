export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = request.nextUrl.searchParams.get("page") || "1";
  
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
  if (!theme) return Response.json({ results: [] });

  try {
    const data: any = await tmdbFetch(theme.endpoint, { ...theme.query, page, sort_by: 'popularity.desc' });
    // Add media_type for components to route correctly
    if (data.results) {
      data.results = data.results.map((r: any) => ({ ...r, media_type: theme.type }));
    }
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Failed to fetch theme" }, { status: 500 });
  }
}
