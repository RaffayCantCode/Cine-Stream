export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { fetchAnimeApi, searchViaJikan } from "@/lib/anime-fetch";
import { generateVariants, editDistance } from "@/lib/fuzzy-search";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function findAnimeSuggestion(query: string, animeResults: any[]): string | null {
  const normalizedQuery = normalize(query);
  if (animeResults.length >= 3) return null;
  const titles = animeResults.map((a: any) => a.name || a.title || "").filter(Boolean);
  if (titles.length === 0) return null;
  for (const title of titles) {
    const dist = editDistance(normalizedQuery.split(" ")[0], normalize(title).split(" ")[0]);
    if (dist <= 2) return null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawQuery = searchParams.get("q");

  if (!rawQuery) {
    return Response.json(
      { error: "Missing query parameter", success: false },
      { status: 400 }
    );
  }

  try {
    const data = await fetchAnimeApi(
      `/api/search?keyword=${encodeURIComponent(rawQuery)}`
    );
    let animes = data.data || [];
    let didYouMean: string | null = null;

    if (animes.length < 3) {
      const fuzzyVariants = generateVariants(rawQuery, 6);
      const fuzzyResults: any[] = [];
      const seenIds = new Set(animes.map((a: any) => a.id));
      let bestVariant = "";
      let bestCount = 0;

      for (const variant of fuzzyVariants) {
        try {
          const variantData = await fetchAnimeApi(`/api/search?keyword=${encodeURIComponent(variant)}`);
          const items = (variantData.data || []).filter((a: any) => !seenIds.has(a.id));
          if (items.length > bestCount) {
            bestCount = items.length;
            bestVariant = variant;
          }
          for (const item of items) {
            seenIds.add(item.id);
            fuzzyResults.push(item);
          }
        } catch {}
      }

      if (fuzzyResults.length > 0) {
        animes = [...animes, ...fuzzyResults];
      }

      if (bestCount > 0 && bestVariant) {
        const nOrig = normalize(rawQuery);
        const nVar = normalize(bestVariant);
        if (nVar !== nOrig && editDistance(nOrig, nVar) <= 3) {
          didYouMean = bestVariant;
        }
      }
    }

    if (animes.length < 3) {
      try {
        const jikanItems = await searchViaJikan(rawQuery);
        const existingIds = new Set(animes.map((a: any) => a.id));
        for (const item of jikanItems) {
          if (!existingIds.has(item.id)) {
            animes.push(item);
          }
        }
      } catch {}
    }

    const suggestion = findAnimeSuggestion(rawQuery, animes);
    if (suggestion) didYouMean = suggestion;

    return Response.json({
      success: true,
      data: { animes },
      did_you_mean: didYouMean,
    });
  } catch (error) {
    console.error("[Anime Search Error]:", error);
    return Response.json({ error: "Failed to search anime", success: false }, { status: 500 });
  }
}
