export const runtime = 'edge';
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { searchAnime, searchViaJikan } from "@/lib/anime-fetch";
import { generateVariants, editDistance } from "@/lib/fuzzy-search";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function dedupAnime(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = String(item.id || item.idMal || item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const [anilistItems, jikanItems] = await Promise.all([
      searchAnime(rawQuery, 1).catch(() => []),
      searchViaJikan(rawQuery).catch(() => []),
    ]);

    let animes = dedupAnime([...anilistItems, ...jikanItems]);
    let didYouMean: string | null = null;

    if (animes.length < 3) {
      const fuzzyVariants = generateVariants(rawQuery, 6);
      const seenIds = new Set(animes.map((a: any) => String(a.id || a.idMal)));
      let bestVariant = "";
      let bestCount = 0;

      for (const variant of fuzzyVariants) {
        try {
          const [variantAnilist, variantJikan] = await Promise.all([
            searchAnime(variant, 1).catch(() => []),
            searchViaJikan(variant).catch(() => []),
          ]);
          const items = dedupAnime([...variantAnilist, ...variantJikan]);
          const newItems = items.filter((a: any) => !seenIds.has(String(a.id || a.idMal)));
          if (newItems.length > bestCount) {
            bestCount = newItems.length;
            bestVariant = variant;
          }
          for (const item of newItems) {
            seenIds.add(String(item.id || item.idMal));
            animes.push(item);
          }
        } catch {}
      }

      if (bestCount > 0 && bestVariant) {
        const nOrig = normalize(rawQuery);
        const nVar = normalize(bestVariant);
        if (nVar !== nOrig && editDistance(nOrig, nVar) <= 3) {
          didYouMean = bestVariant;
        }
      }
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
