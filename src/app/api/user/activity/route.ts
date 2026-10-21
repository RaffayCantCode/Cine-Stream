export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import {
  cleanupInactiveMangaHistory,
  recordUserActivity,
} from "@/lib/user-activity";

/**
 * Lightweight heartbeat used by the client to keep lastActiveAt accurate and
 * to opportunistically clear manga history for users inactive for 30+ days.
 * The client only calls this a few times per day.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { success: false },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  // Order matters: stale rows for a returning user are deleted before their
  // lastActiveAt is refreshed.
  await recordUserActivity(session.user.id);
  await cleanupInactiveMangaHistory();

  return Response.json(
    { success: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
