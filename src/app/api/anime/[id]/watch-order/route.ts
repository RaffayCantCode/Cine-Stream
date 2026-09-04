export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest } from "next/server";
import { getCuratedAnimeFranchiseNodes } from "@/lib/franchises";
import {
  buildFranchiseGraph,
  FRANCHISE_GRAPH_CACHE,
  FRANCHISE_GRAPH_TTL,
  anilistQuery,
} from "@/lib/anime-fetch";

const watchOrderCacheHeaders = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  "CDN-Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
  "Cloudflare-CDN-Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return Response.json({ success: true, data: { franchiseNodes: [] } }, { headers: watchOrderCacheHeaders });
  }

  try {
    let targetNumId = parseInt(id.replace(/\D/g, ""), 10);

    // If ID is formatted like "mal-12345", resolve AniList ID
    if (id.startsWith("mal-")) {
      const malIdNum = parseInt(id.replace("mal-", ""), 10);
      if (!isNaN(malIdNum)) {
        try {
          const q = `query ($idMal: Int) {
            Media(idMal: $idMal, type: ANIME) {
              id
            }
          }`;
          const malRes = await anilistQuery(q, { idMal: malIdNum });
          if (malRes?.data?.Media?.id) {
            targetNumId = malRes.data.Media.id;
          }
        } catch {}
      }
    }

    if (isNaN(targetNumId) || targetNumId <= 0) {
      return Response.json({ success: true, data: { franchiseNodes: [] } }, { headers: watchOrderCacheHeaders });
    }

    // 1. Check curated franchise nodes (instant)
    const curated = getCuratedAnimeFranchiseNodes(targetNumId);
    if (curated && curated.length > 1) {
      return Response.json({
        success: true,
        data: { franchiseNodes: curated },
      }, { headers: watchOrderCacheHeaders });
    }

    // 2. Check server in-memory cache (instant)
    const cached = FRANCHISE_GRAPH_CACHE.get(targetNumId);
    if (cached && Date.now() - cached.timestamp < FRANCHISE_GRAPH_TTL) {
      return Response.json({
        success: true,
        data: { franchiseNodes: cached.nodes },
      }, { headers: watchOrderCacheHeaders });
    }

    // 3. Perform the deep franchise BFS crawl in the background
    const nodes = await buildFranchiseGraph(targetNumId);
    return Response.json({
      success: true,
      data: { franchiseNodes: nodes || [] },
    }, { headers: watchOrderCacheHeaders });
  } catch (error) {
    console.error("[Watch Order API Route Error]:", error);
    return Response.json({
      success: true,
      data: { franchiseNodes: [] },
    }, { headers: watchOrderCacheHeaders });
  }
}
