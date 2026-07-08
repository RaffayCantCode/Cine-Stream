export const runtime = 'edge';
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchHistory, WatchHistoryItem } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const AddWatchHistorySchema = z.object({
  mediaId: z.number().int(),
  mediaType: z.enum(["movie", "tv", "anime"]),
  title: z.string(),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
  season: z.number().int().nullable().optional(),
  episode: z.number().int().nullable().optional(),
  episodeName: z.string().nullable().optional(),
  progress: z.number().int().default(0),
  duration: z.number().int().default(0),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(watchHistory)
    .where(eq(watchHistory.userId, session.user.id))
    .orderBy(desc(watchHistory.watchedAt))
    .limit(30);

  const seen = new Set<string>();
  const deduped = rows.filter((r: WatchHistoryItem) => {
    const key = `${r.mediaType}-${r.mediaId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return Response.json({ items: deduped.slice(0, 20) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const body = await request.json();
  const parsed = AddWatchHistorySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    mediaId,
    mediaType,
    title,
    posterPath,
    backdropPath,
    season,
    episode,
    episodeName,
    progress,
    duration,
  } = parsed.data;

  await db
    .insert(watchHistory)
    .values({
      userId: session.user.id,
      mediaId,
      mediaType,
      title,
      posterPath: posterPath ?? null,
      backdropPath: backdropPath ?? null,
      season: season ?? 0,
      episode: episode ?? 0,
      episodeName: episodeName ?? null,
      progress,
      duration,
      watchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        watchHistory.userId,
        watchHistory.mediaId,
        watchHistory.mediaType,
        watchHistory.season,
        watchHistory.episode,
      ],
      set: {
        title,
        posterPath: posterPath ?? null,
        backdropPath: backdropPath ?? null,
        episodeName: episodeName ?? null,
        progress,
        duration,
        watchedAt: new Date(),
      },
    });

  return Response.json({ success: true });
}
