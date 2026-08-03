export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchlists } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const syncItemSchema = z.object({
  mediaId: z.number().int(),
  mediaType: z.enum(["movie", "tv", "anime"]),
  title: z.string(),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
});

const syncSchema = z.object({
  items: z.array(syncItemSchema).max(200),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const parsed = syncSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[watchlist sync parse error]", parsed.error);
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const db = getDb();
    const userId = session.user.id;

    if (parsed.data.items.length > 0) {
      // Merge guests' local items into the user's DB watchlist.
      await db
        .insert(watchlists)
        .values(
          parsed.data.items.map((i) => ({
            userId,
            mediaId: i.mediaId,
            mediaType: i.mediaType,
            title: i.title,
            posterPath: i.posterPath ?? null,
            backdropPath: i.backdropPath ?? null,
          }))
        )
        .onConflictDoNothing({
          target: [watchlists.userId, watchlists.mediaId, watchlists.mediaType],
        });
    }

    const rows = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(desc(watchlists.createdAt));

    const items = rows.map((r) => ({
      mediaId: r.mediaId,
      mediaType: r.mediaType as "movie" | "tv" | "anime",
      title: r.title,
      posterPath: r.posterPath,
      backdropPath: r.backdropPath,
      savedAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    }));

    return Response.json({ items });
  } catch (error) {
    console.error("[watchlist sync error]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}