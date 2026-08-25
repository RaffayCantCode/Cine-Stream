export const runtime = 'edge';
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { mangaReadingHistory, MangaReadingHistoryItem } from "@/lib/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { z } from "zod";

const SaveMangaProgressSchema = z.object({
  mangaId: z.string(),
  mangaTitle: z.string(),
  mangaCover: z.string(),
  mangaType: z.string().optional().transform((val) => {
    if (val === "manhwa" || val === "manhua") return val;
    return "manga";
  }),
  chapterId: z.string(),
  chapterNumber: z.union([z.string(), z.number()]).transform(String),
  chapterTitle: z.string().nullable().optional(),
  pageNumber: z.number().int().default(1),
  totalPages: z.number().int().default(1),
  nextChapterId: z.string().nullable().optional(),
  nextChapterNumber: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ items: [], item: null });
    }

    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    const db = getDb();

    if (mangaId) {
      const rows = await db
        .select()
        .from(mangaReadingHistory)
        .where(
          and(
            eq(mangaReadingHistory.userId, session.user.id),
            eq(mangaReadingHistory.mangaId, mangaId)
          )
        )
        .limit(1);

      return Response.json({ item: rows[0] || null });
    }

    const rows = await db
      .select()
      .from(mangaReadingHistory)
      .where(eq(mangaReadingHistory.userId, session.user.id))
      .orderBy(desc(mangaReadingHistory.updatedAt))
      .limit(30);

    return Response.json({ items: rows });
  } catch (err: any) {
    console.warn("[API/manga/history] GET failed:", err);
    return Response.json({ items: [], item: null });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = SaveMangaProgressSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid body", details: parsed.error.format() }, { status: 400 });
    }

    const {
      mangaId,
      mangaTitle,
      mangaCover,
      mangaType,
      chapterId,
      chapterNumber,
      chapterTitle,
      pageNumber,
      totalPages,
      nextChapterId,
      nextChapterNumber,
    } = parsed.data;

    const db = getDb();

    try {
      await db
        .insert(mangaReadingHistory)
        .values({
          userId: session.user.id,
          mangaId,
          mangaTitle,
          mangaCover,
          mangaType,
          chapterId,
          chapterNumber,
          chapterTitle: chapterTitle ?? null,
          pageNumber,
          totalPages,
          nextChapterId: nextChapterId ?? null,
          nextChapterNumber: nextChapterNumber ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [mangaReadingHistory.userId, mangaReadingHistory.mangaId],
          set: {
            mangaTitle,
            mangaCover,
            mangaType,
            chapterId,
            chapterNumber,
            chapterTitle: chapterTitle ?? null,
            pageNumber,
            totalPages,
            nextChapterId: nextChapterId ?? null,
            nextChapterNumber: nextChapterNumber ?? null,
            updatedAt: new Date(),
          },
        });
    } catch (upsertErr) {
      // Fallback for database instances where explicit unique index target differs
      const existing = await db
        .select({ id: mangaReadingHistory.id })
        .from(mangaReadingHistory)
        .where(
          and(
            eq(mangaReadingHistory.userId, session.user.id),
            eq(mangaReadingHistory.mangaId, mangaId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(mangaReadingHistory)
          .set({
            mangaTitle,
            mangaCover,
            mangaType,
            chapterId,
            chapterNumber,
            chapterTitle: chapterTitle ?? null,
            pageNumber,
            totalPages,
            nextChapterId: nextChapterId ?? null,
            nextChapterNumber: nextChapterNumber ?? null,
            updatedAt: new Date(),
          })
          .where(eq(mangaReadingHistory.id, existing[0].id));
      } else {
        await db.insert(mangaReadingHistory).values({
          userId: session.user.id,
          mangaId,
          mangaTitle,
          mangaCover,
          mangaType,
          chapterId,
          chapterNumber,
          chapterTitle: chapterTitle ?? null,
          pageNumber,
          totalPages,
          nextChapterId: nextChapterId ?? null,
          nextChapterNumber: nextChapterNumber ?? null,
          updatedAt: new Date(),
        });
      }
    }

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[API/manga/history] POST failed:", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const mangaId = url.searchParams.get("mangaId");

    if (!mangaId) {
      return Response.json({ error: "Missing mangaId" }, { status: 400 });
    }

    const db = getDb();
    const cleanId = mangaId.replace(/^(wc|asura)-/, "");

    await db
      .delete(mangaReadingHistory)
      .where(
        and(
          eq(mangaReadingHistory.userId, session.user.id),
          or(
            eq(mangaReadingHistory.mangaId, mangaId),
            eq(mangaReadingHistory.mangaId, cleanId),
            eq(mangaReadingHistory.mangaId, `wc-${cleanId}`),
            eq(mangaReadingHistory.mangaId, `asura-${cleanId}`)
          )
        )
      );

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[API/manga/history] DELETE failed:", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
