export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchlists, mangaBookmarks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const syncItemSchema = z.object({
  mediaId: z.union([z.number().int(), z.string()]),
  mediaType: z.enum(["movie", "tv", "anime", "manga", "manhwa"]),
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

    const mediaList = parsed.data.items.filter((i) => i.mediaType !== "manga" && i.mediaType !== "manhwa");
    const mangaList = parsed.data.items.filter((i) => i.mediaType === "manga" || i.mediaType === "manhwa");

    if (mediaList.length > 0) {
      await db
        .insert(watchlists)
        .values(
          mediaList.map((i) => ({
            userId,
            mediaId: typeof i.mediaId === "number" ? i.mediaId : parseInt(i.mediaId, 10),
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

    if (mangaList.length > 0) {
      await db
        .insert(mangaBookmarks)
        .values(
          mangaList.map((i) => ({
            userId,
            mangaId: String(i.mediaId),
            mediaType: i.mediaType,
            title: i.title,
            posterPath: i.posterPath ?? null,
            backdropPath: i.backdropPath ?? null,
          }))
        )
        .onConflictDoNothing({
          target: [mangaBookmarks.userId, mangaBookmarks.mangaId],
        });
    }

    const [mediaRows, mangaRows] = await Promise.all([
      db
        .select()
        .from(watchlists)
        .where(eq(watchlists.userId, userId))
        .orderBy(desc(watchlists.createdAt))
        .catch(() => []),
      db
        .select()
        .from(mangaBookmarks)
        .where(eq(mangaBookmarks.userId, userId))
        .orderBy(desc(mangaBookmarks.createdAt))
        .catch(() => []),
    ]);

    const mediaItems = mediaRows.map((r) => ({
      mediaId: r.mediaId,
      mediaType: r.mediaType as "movie" | "tv" | "anime",
      title: r.title,
      posterPath: r.posterPath,
      backdropPath: r.backdropPath,
      savedAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    }));

    const mangaItems = mangaRows.map((r) => ({
      mediaId: r.mangaId,
      mediaType: (r.mediaType || "manga") as "manga" | "manhwa",
      title: r.title,
      posterPath: r.posterPath,
      backdropPath: r.backdropPath,
      savedAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    }));

    const combined = [...mediaItems, ...mangaItems].sort((a, b) => b.savedAt - a.savedAt);

    return Response.json({ items: combined });
  } catch (error) {
    console.error("[watchlist sync error]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}