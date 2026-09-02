export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

const STOP_WORDS = new Set(["the", "a", "an", "and", "of", "to", "in", "with", "part", "season"]);

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildQueryVariants(query: string): string[] {
  const normalized = normalizeQuery(query);
  const words = normalized.split(" ").filter(Boolean);
  const meaningful = words.filter(word => !STOP_WORDS.has(word));
  const variants = [
    query.trim(),
    normalized,
    meaningful.join(" "),
    meaningful.slice(0, 4).join(" "),
    words.slice(0, 3).join(" "),
  ].filter(value => value.length >= 2);

  return [...new Set(variants)].slice(0, 4);
}

function scoreResult(item: any, query: string): number {
  const normalizedQuery = normalizeQuery(query);
  const title = normalizeQuery(item.title || item.name || "");
  if (!title) return 0;
  if (title === normalizedQuery) return 1000 + Math.min(Number(item.popularity || 0), 200);
  if (title.startsWith(normalizedQuery)) return 850 + Math.min(Number(item.popularity || 0), 100);
  if (title.includes(normalizedQuery)) return 720 + Math.min(Number(item.popularity || 0), 100);

  const queryWords = normalizedQuery.split(" ").filter(word => !STOP_WORDS.has(word));
  const titleWords = new Set(title.split(" "));
  const matches = queryWords.filter(word => titleWords.has(word)).length;
  const coverage = queryWords.length ? matches / queryWords.length : 0;
  const popularity = Math.min(Number(item.popularity || 0), 100) / 100;
  const voteBonus = Math.min(Number(item.vote_count || 0), 10000) / 50;
  return Math.round(coverage * 600 + popularity * 80 + voteBonus);
}

/**
 * Returns true if a TMDB item is Japanese anime (original_language=ja + Animation genre 16).
 * Used to prevent anime from appearing in Movies/TV search results.
 * Person results are never filtered by this check.
 */
function isAnimeItem(item: any): boolean {
  if (item.media_type === "person") return false;
  return (
    item.original_language === "ja" &&
    Array.isArray(item.genre_ids) &&
    item.genre_ids.includes(16)
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const type = searchParams.get("type") || "multi";
  const page = searchParams.get("page") || "1";

  if (!query) {
    return Response.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const variants = page === "1" ? buildQueryVariants(query) : [query];
    const responses = await Promise.allSettled(
      variants.map(variant => tmdbFetch(`/search/${type}`, { query: variant, page, include_adult: "false" }))
    );

    let totalPages = 1;
    const seen = new Set<string>();
    const results: any[] = [];

    for (const response of responses) {
      if (response.status !== "fulfilled") continue;
      const data: any = response.value;
      totalPages = Math.max(totalPages, data.total_pages || 1);
      for (const item of data.results || []) {
        const key = `${item.media_type || type}-${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
      }
    }

    results.sort((a, b) => scoreResult(b, query) - scoreResult(a, query));

    // Exclude anime (Japanese animated content) from general movie/tv search results unless include_anime=true.
    // Anime content belongs exclusively to the Anime section, but anime resolvers pass include_anime=true.
    const includeAnime = searchParams.get("include_anime") === "true";
    const filteredResults = includeAnime ? results : results.filter((item) => !isAnimeItem(item));

    return Response.json({
      page: Number(page) || 1,
      total_pages: totalPages,
      total_results: filteredResults.length,
      results: filteredResults,
    });
  } catch (error) {
    return Response.json({ error: "Failed to search" }, { status: 500 });
  }
}

