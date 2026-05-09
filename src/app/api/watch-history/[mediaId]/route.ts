export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { watchHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mediaId } = await params;
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get("mediaType");

  if (!mediaId || !mediaType) {
    return Response.json(
      { error: "mediaId and mediaType required" },
      { status: 400 }
    );
  }

  const db = getDb();
  await db
    .delete(watchHistory)
    .where(
      and(
        eq(watchHistory.userId, session.user.id),
        eq(watchHistory.mediaId, parseInt(mediaId)),
        eq(watchHistory.mediaType, mediaType)
      )
    );

  return Response.json({ success: true });
}
