export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { streamingSourceConfig } from "@/lib/db/schema";
import { resolveSourceConfig, type SourceCategory } from "@/lib/streaming-config";
import { getCachedStreamingSources, setCachedStreamingSources } from "@/lib/server-cache";

export async function GET() {
  const cached = getCachedStreamingSources();
  if (cached) {
    return NextResponse.json(
      {
        success: true,
        data: cached,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, max-age=3600",
          "Cloudflare-CDN-Cache-Control": "public, max-age=3600",
        },
      }
    );
  }

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

    const payload = {
      movie: forCategory("movie"),
      anime: forCategory("anime"),
    };

    setCachedStreamingSources(payload);

    return NextResponse.json(
      {
        success: true,
        data: payload,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, max-age=3600",
          "Cloudflare-CDN-Cache-Control": "public, max-age=3600",
        },
      }
    );
  } catch (error) {
    const fallback = {
      movie: resolveSourceConfig("movie", []),
      anime: resolveSourceConfig("anime", []),
    };

    return NextResponse.json(
      {
        success: true,
        data: fallback,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, max-age=3600",
          "Cloudflare-CDN-Cache-Control": "public, max-age=3600",
        },
      }
    );
  }
}