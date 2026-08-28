export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { streamingSourceConfig } from "@/lib/db/schema";
import { resolveSourceConfig, type SourceCategory } from "@/lib/streaming-config";

export async function GET() {
  try {
    let rows: { category: string; sourceKey: string; position: number; tag: string }[] = [];
    try {
      const db = getDb();
      rows = await db.select().from(streamingSourceConfig);
    } catch {}

    const forCategory = (category: SourceCategory) =>
      resolveSourceConfig(
        category,
        rows.filter((r) => r.category === category)
      );

    return NextResponse.json(
      {
        success: true,
        data: {
          movie: forCategory("movie"),
          anime: forCategory("anime"),
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: true,
        data: {
          movie: resolveSourceConfig("movie", []),
          anime: resolveSourceConfig("anime", []),
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=120",
        },
      }
    );
  }
}