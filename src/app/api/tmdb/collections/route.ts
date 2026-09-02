export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextResponse } from "next/server";
import { FRANCHISES } from "@/lib/franchises";
import { cacheHeaders } from "@/lib/tmdb";
import { getDb } from "@/lib/db";
import { customFranchises } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCachedCollectionsList, setCachedCollectionsList } from "@/lib/server-cache";

export async function GET() {
  const cached = getCachedCollectionsList();
  if (cached) {
    return NextResponse.json({ collections: cached }, { headers: cacheHeaders(86400 * 7) });
  }

  try {
    const staticCols = FRANCHISES.map(f => ({
      id: f.id,
      name: f.name,
      overview: f.overview,
      poster_path: f.poster_path,
      backdrop_path: f.backdrop_path,
    }));

    let dynamicCols: any[] = [];
    const dbMap = new Map<string, any>();
    try {
      const db = getDb();
      const dbFranchises = await db.query.customFranchises.findMany({
        where: eq(customFranchises.enabled, true),
      });
      for (const f of dbFranchises) {
        dbMap.set(f.id, {
          id: f.id,
          name: f.name,
          overview: f.overview || "",
          poster_path: f.posterPath || "",
          backdrop_path: f.backdropPath || "",
        });
      }
    } catch {}

    const collections: any[] = [];
    const seenIds = new Set<string>();

    // Dynamic collections first
    for (const [id, col] of dbMap.entries()) {
      collections.push(col);
      seenIds.add(id);
    }

    // Static collections (if not overridden by DB)
    for (const f of FRANCHISES) {
      if (!seenIds.has(f.id)) {
        collections.push({
          id: f.id,
          name: f.name,
          overview: f.overview,
          poster_path: f.poster_path,
          backdrop_path: f.backdrop_path,
        });
        seenIds.add(f.id);
      }
    }

    setCachedCollectionsList(collections);

    return NextResponse.json({ collections }, { headers: cacheHeaders(86400 * 7) });
  } catch (error) {
    console.error("Collections error:", error);
    return NextResponse.json({ collections: [] }, { status: 500 });
  }
}
