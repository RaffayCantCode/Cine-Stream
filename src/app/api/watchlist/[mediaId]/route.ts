export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchlists } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mediaId: mediaIdRaw } = await params;
    const mediaId = Number(mediaIdRaw);
    const mediaType =
      new URL(request.url).searchParams.get("mediaType") ?? "";

    if (!Number.isFinite(mediaId) || !["movie", "tv", "anime"].includes(mediaType)) {
      return Response.json({ error: "Invalid params" }, { status: 400 });
    }

    const db = getDb();
    await db
      .delete(watchlists)
      .where(
        and(
          eq(watchlists.userId, session.user.id),
          eq(watchlists.mediaId, mediaId),
          eq(watchlists.mediaType, mediaType)
        )
      );

    return Response.json({ success: true });
  } catch (error) {
    console.error("[watchlist DELETE error]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}