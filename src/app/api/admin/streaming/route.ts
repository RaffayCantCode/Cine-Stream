export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { sql, and, eq, notInArray } from "drizzle-orm";
import { verifyAdminSession } from "@/lib/auth/admin";
import { streamingSourceConfig } from "@/lib/db/schema";
import {
  resolveSourceConfig,
  defaultSourceOrder,
  SOURCE_TAGS,
  DEFAULT_TAGS,
  isSourceTag,
  type SourceCategory,
  type SourceTag,
} from "@/lib/streaming-config";

interface ConfigEntry {
  key: string;
  tag: SourceTag;
}

function effectiveConfig(rows: { category: string; sourceKey: string; position: number; tag: string }[]) {
  const forCategory = (category: SourceCategory) =>
    resolveSourceConfig(
      category,
      rows.filter((r) => r.category === category)
    );
  return { movie: forCategory("movie"), anime: forCategory("anime") };
}

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rows = await auth.db.select().from(streamingSourceConfig);
    return NextResponse.json({ success: true, config: effectiveConfig(rows) });
  } catch (error) {
    console.error("[Admin Streaming API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch streaming sources" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));

    for (const category of ["movie", "anime"] as SourceCategory[]) {
      const provided = Array.isArray(body[category]) ? (body[category] as unknown[]) : [];
      const baseKeys = defaultSourceOrder(category);
      const defaults = DEFAULT_TAGS[category];
      const seen = new Set<string>();
      const entries: { category: SourceCategory; sourceKey: string; position: number; tag: string }[] = [];

      provided.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") return;
        const e = entry as Record<string, unknown>;
        const key = typeof e.key === "string" ? e.key : "";
        if (!key || seen.has(key) || !baseKeys.includes(key)) return;
        const tag = isSourceTag(e.tag) ? e.tag : (defaults[key] ?? "unknown");
        seen.add(key);
        entries.push({ category, sourceKey: key, position: index, tag });
      });

      baseKeys.forEach((key) => {
        if (seen.has(key)) return;
        entries.push({ category, sourceKey: key, position: entries.length, tag: defaults[key] ?? "unknown" });
      });

      if (entries.length === 0) continue;

      try {
        await auth.db.delete(streamingSourceConfig).where(
          and(
            eq(streamingSourceConfig.category, category),
            notInArray(streamingSourceConfig.sourceKey, baseKeys)
          )
        );
      } catch {}

      await auth.db
        .insert(streamingSourceConfig)
        .values(entries)
        .onConflictDoUpdate({
          target: [streamingSourceConfig.category, streamingSourceConfig.sourceKey],
          set: {
            position: sql`excluded.position`,
            tag: sql`excluded.tag`,
            updatedAt: new Date(),
          },
        });
    }

    const rows = await auth.db.select().from(streamingSourceConfig);
    return NextResponse.json({ success: true, config: effectiveConfig(rows) });
  } catch (error) {
    console.error("[Admin Streaming API] POST Error:", error);
    return NextResponse.json({ error: "Failed to save streaming sources" }, { status: 500 });
  }
}

export async function DELETE() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await auth.db.delete(streamingSourceConfig);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Streaming API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to reset streaming sources" }, { status: 500 });
  }
}