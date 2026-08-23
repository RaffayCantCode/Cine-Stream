export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchlists, mangaBookmarks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const itemSchema = z.object({
  mediaId: z.union([z.number().int(), z.string()]),
  mediaType: z.enum(["movie", "tv", "anime", "manga", "manhwa"]),
  title: z.string(),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    
    // Fetch both media watchlists and manga bookmarks in parallel
    const [mediaRows, mangaRows] = await Promise.all([
      db
        .select()
        .from(watchlists)
        .where(eq(watchlists.userId, session.user.id))
        .orderBy(desc(watchlists.createdAt))
        .catch(() => []),
      db
        .select()
        .from(mangaBookmarks)
        .where(eq(mangaBookmarks.userId, session.user.id))
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
    console.error("[watchlist GET error]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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

    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[watchlist POST parse error]", parsed.error);
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const { mediaId, mediaType, title, posterPath, backdropPath } = parsed.data;
    const db = getDb();

    if (mediaType === "manga" || mediaType === "manhwa") {
      const mangaIdStr = String(mediaId);
      await db
        .insert(mangaBookmarks)
        .values({
          userId: session.user.id,
          mangaId: mangaIdStr,
          mediaType,
          title,
          posterPath: posterPath ?? null,
          backdropPath: backdropPath ?? null,
        })
        .onConflictDoUpdate({
          target: [mangaBookmarks.userId, mangaBookmarks.mangaId],
          set: {
            mediaType,
            title,
            posterPath: posterPath ?? null,
            backdropPath: backdropPath ?? null,
            createdAt: new Date(),
          },
        });
    } else {
      const numMediaId = typeof mediaId === "number" ? mediaId : parseInt(mediaId, 10);
      if (!isNaN(numMediaId)) {
        await db
          .insert(watchlists)
          .values({
            userId: session.user.id,
            mediaId: numMediaId,
            mediaType,
            title,
            posterPath: posterPath ?? null,
            backdropPath: backdropPath ?? null,
          })
          .onConflictDoUpdate({
            target: [watchlists.userId, watchlists.mediaId, watchlists.mediaType],
            set: {
              title,
              posterPath: posterPath ?? null,
              backdropPath: backdropPath ?? null,
              createdAt: new Date(),
            },
          });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[watchlist POST error]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}