import { Router, type IRouter, type Request, type Response } from "express";
import { db, watchHistoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const AddWatchHistorySchema = z.object({
  mediaId: z.number().int(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string(),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
  season: z.number().int().nullable().optional(),
  episode: z.number().int().nullable().optional(),
  episodeName: z.string().nullable().optional(),
});

router.get("/watch-history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db
    .select()
    .from(watchHistoryTable)
    .where(eq(watchHistoryTable.userId, req.user.id))
    .orderBy(desc(watchHistoryTable.watchedAt))
    .limit(30);

  // Deduplicate by mediaId+mediaType (keep most recent per show/movie)
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = `${r.mediaType}-${r.mediaId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json({ items: deduped.slice(0, 20) });
});

router.post("/watch-history", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = AddWatchHistorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const { mediaId, mediaType, title, posterPath, backdropPath, season, episode, episodeName } = parsed.data;

  await db
    .insert(watchHistoryTable)
    .values({
      userId: req.user.id,
      mediaId,
      mediaType,
      title,
      posterPath: posterPath ?? null,
      backdropPath: backdropPath ?? null,
      season: season ?? null,
      episode: episode ?? null,
      episodeName: episodeName ?? null,
      watchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        watchHistoryTable.userId,
        watchHistoryTable.mediaId,
        watchHistoryTable.mediaType,
        watchHistoryTable.season,
        watchHistoryTable.episode,
      ],
      set: {
        title,
        posterPath: posterPath ?? null,
        backdropPath: backdropPath ?? null,
        episodeName: episodeName ?? null,
        watchedAt: new Date(),
      },
    });

  res.json({ success: true });
});

router.delete("/watch-history/:mediaId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const mediaId = Number(req.params.mediaId);
  const mediaType = req.query.mediaType as string;

  if (!mediaId || !mediaType) {
    res.status(400).json({ error: "mediaId and mediaType required" });
    return;
  }

  await db
    .delete(watchHistoryTable)
    .where(
      and(
        eq(watchHistoryTable.userId, req.user.id),
        eq(watchHistoryTable.mediaId, mediaId),
        eq(watchHistoryTable.mediaType, mediaType),
      ),
    );

  res.json({ success: true });
});

export default router;
