export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchlists } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const itemSchema = z.object({
  mediaId: z.number().int(),
  mediaType: z.enum(["movie", "tv", "anime"]),
  title: z.string(),
  posterPath: z.string().nullable().optional(),
  backdropPath: z.string().nullable().optional(),
});

const addSchema = itemSchema;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.userId, session.user.id))
    .orderBy(desc(watchlists.createdAt));

  const items = rows.map((r) => ({
    mediaId: r.mediaId,
    mediaType: r.mediaType,
    title: r.title,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    savedAt: new Date(r.createdAt).getTime(),
  }));

  return Response.json({ items });
}

export async function POST(request: Request) {
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
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { mediaId, mediaType, title, posterPath, backdropPath } = parsed.data;

  const db = getDb();
  await db
    .insert(watchlists)
    .values({
      userId: session.user.id,
      mediaId,
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

  return Response.json({ success: true });
}