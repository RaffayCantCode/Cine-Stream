export const runtime = 'edge';
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchHistory } from "@/lib/db/schema";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

const ProgressSchema = z.object({
  mediaId: z.number().int(),
  mediaType: z.enum(["movie", "tv", "anime"]),
  season: z.number().int().default(0),
  episode: z.number().int().default(0),
  progress: z.number().int().min(0),
  duration: z.number().int().min(0).optional(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ProgressSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid body", details: parsed.error }, { status: 400 });
    }

    const { mediaId, mediaType, season, episode, progress, duration } = parsed.data;
    const db = getDb();

    await db.update(watchHistory)
      .set({
        progress,
        ...(duration ? { duration } : {}),
        watchedAt: new Date()
      })
      .where(
        and(
          eq(watchHistory.userId, session.user.id),
          eq(watchHistory.mediaId, mediaId),
          eq(watchHistory.mediaType, mediaType),
          eq(watchHistory.season, season),
          eq(watchHistory.episode, episode)
        )
      );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
