export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
import { generateVariants, editDistance, getTitleExtractor, computeWordOverlap } from "@/lib/fuzzy-search";

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
  const title = normalizeQuery(getTitleExtractor(item));
  if (!title) return 0;
  if (title === normalizedQuery) return 1000;
  if (title.startsWith(normalizedQuery)) return 850;
  if (title.includes(normalizedQuery)) return 720;

  const queryWords = normalizedQuery.split(" ").filter(word => !STOP_WORDS.has(word));
  const titleWords = new Set(title.split(" "));
  const matches = queryWords.filter(word => titleWords.has(word)).length;
  const coverage = queryWords.length ? matches / queryWords.length : 0;
  const popularity = Math.min(Number(item.popularity || 0), 100) / 100;
  return Math.round(coverage * 600 + popularity * 80 + Number(item.vote_count || 0) / 1000);
}

function findDidYouMean(query: string, results: any[]): string | null {
  if (results.length >= 3) return null;
  const normalizedQuery = normalizeQuery(query);
  const allTitles = results.map(getTitleExtractor).filter(Boolean);
  if (allTitles.length === 0) return null;
  for (const title of allTitles) {
    const overlap = computeWordOverlap(normalizedQuery, title);
    if (overlap >= 0.5) return null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get("query");
  const type = searchParams.get("type") || "multi";
  const page = searchParams.get("page") || "1";

  if (!rawQuery) {
    return Response.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const variants = page === "1" ? buildQueryVariants(rawQuery) : [rawQuery];
    const responses = await Promise.allSettled(
      variants.map(variant => tmdbFetch(`/search/${type}`, { query: variant, page, include_adult: "false" }))
    );

    let totalPages = 1;
    const seen = new Set<string>();
    const results: any[] = [];
    let bestVariantResultCount = 0;

    for (const response of responses) {
      if (response.status !== "fulfilled") continue;
      const data: any = response.value;
      totalPages = Math.max(totalPages, data.total_pages || 1);
      let count = 0;
      for (const item of data.results || []) {
        const key = `${item.media_type || type}-${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
        count++;
      }
      if (count > bestVariantResultCount) bestVariantResultCount = count;
    }

    results.sort((a, b) => scoreResult(b, rawQuery) - scoreResult(a, rawQuery));

    let didYouMean: string | null = null;

    if (results.length < 2 && page === "1") {
      const fuzzyVariants = generateVariants(rawQuery, 6);
      const fuzzyResponses = await Promise.allSettled(
        fuzzyVariants.map(v => tmdbFetch(`/search/${type}`, { query: v, page: "1", include_adult: "false" }))
      );

      const fuzzySeen = new Set<string>();
      const fuzzyResults: any[] = [];
      let bestFuzzyVariant = "";
      let bestFuzzyCount = 0;

      for (let i = 0; i < fuzzyResponses.length; i++) {
        const fr = fuzzyResponses[i];
        if (fr.status !== "fulfilled") continue;
        const data: any = fr.value;
        const items = (data.results || []).filter((item: any) => {
          const title = getTitleExtractor(item);
          if (!title) return false;
          const dist = editDistance(normalizeQuery(rawQuery).split(" ")[0], normalizeQuery(title).split(" ")[0]);
          return dist <= 3;
        });
        if (items.length > bestFuzzyCount) {
          bestFuzzyCount = items.length;
          bestFuzzyVariant = fuzzyVariants[i];
        }
        for (const item of items) {
          const key = `${item.media_type || type}-${item.id}`;
          if (fuzzySeen.has(key)) continue;
          fuzzySeen.add(key);
          fuzzyResults.push(item);
        }
      }

      if (fuzzyResults.length > 0) {
        const existingKeys = new Set(results.map(r => `${r.media_type || type}-${r.id}`));
        for (const item of fuzzyResults) {
          const key = `${item.media_type || type}-${item.id}`;
          if (!existingKeys.has(key)) {
            results.push(item);
          }
        }
      }

      if (bestFuzzyCount > 0 && bestFuzzyVariant) {
        const normalizedOriginal = normalizeQuery(rawQuery);
        const normalizedVariant = normalizeQuery(bestFuzzyVariant);
        if (normalizedVariant !== normalizedOriginal && editDistance(normalizedOriginal, normalizedVariant) <= 3) {
          didYouMean = bestFuzzyVariant;
        }
      }
    }

    if (results.length < 3) {
      const candidates = results.map(getTitleExtractor).filter(Boolean);
      if (candidates.length > 0) {
        const suggestion = findDidYouMean(rawQuery, results);
        if (suggestion) didYouMean = suggestion;
      }
    }

    return Response.json({
      page: Number(page) || 1,
      total_pages: totalPages,
      total_results: results.length,
      results,
      did_you_mean: didYouMean,
    });
  } catch (error) {
    return Response.json({ error: "Failed to search" }, { status: 500 });
  }
}
