export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextResponse } from "next/server";
import { FRANCHISES } from "@/lib/franchises";
import { cacheHeaders } from "@/lib/tmdb";

import { getDb } from "@/lib/db";
import { customFranchises } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const staticCols = FRANCHISES.map(f => ({
      id: f.id,
      name: f.name,
      overview: f.overview,
      poster_path: f.poster_path,
      backdrop_path: f.backdrop_path,
    }));

    let dynamicCols: any[] = [];
    try {
      const db = getDb();
      const dbFranchises = await db.query.customFranchises.findMany({
        where: eq(customFranchises.enabled, true),
      });
      dynamicCols = dbFranchises.map(f => ({
        id: f.id,
        name: f.name,
        overview: f.overview || "",
        poster_path: f.posterPath || "",
        backdrop_path: f.backdropPath || "",
      }));
    } catch {}

    const collections = [...dynamicCols, ...staticCols];

    return NextResponse.json({ collections }, { headers: cacheHeaders(60) });
  } catch (error) {
    console.error("Collections error:", error);
    return NextResponse.json({ collections: [] }, { status: 500 });
  }
}

