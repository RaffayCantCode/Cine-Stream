import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { mangaReadingHistory, users } from "@/lib/db/schema";

/**
 * Reading progress is kept for 30 days after a user's last visit. Once a user
 * has been inactive for longer than this, their "Continue reading" rows are
 * removed. The cleanup runs lazily from activity/history requests so it works
 * on Cloudflare D1 without a separate cron worker.
 */
export const MANGA_HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Avoid writing lastActiveAt on every request; once every 6 hours is enough. */
const ACTIVITY_WRITE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Global cleanup is at most once per hour per worker isolate. */
const GLOBAL_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let lastGlobalCleanupAt = 0;

function inactiveCutoff(): Date {
  return new Date(Date.now() - MANGA_HISTORY_MAX_AGE_MS);
}

/**
 * Removes stale rows for one user, but only when the user's own lastActiveAt is
 * older than the cutoff. This is deliberately a single DELETE so opening the
 * manga history page does not add a read query.
 */
export async function cleanupInactiveMangaHistoryForUser(userId: string): Promise<number> {
  if (!userId) return 0;
  const cutoff = inactiveCutoff();

  try {
    const db = getDb();
    const inactiveUser = db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.id, userId), lt(users.lastActiveAt, cutoff))
      );

    const result = await db
      .delete(mangaReadingHistory)
      .where(
        and(
          eq(mangaReadingHistory.userId, userId),
          lt(mangaReadingHistory.updatedAt, cutoff),
          inArray(mangaReadingHistory.userId, inactiveUser)
        )
      );

    return Number((result as any)?.meta?.changes ?? 0);
  } catch (error) {
    console.warn("[UserActivity] Per-user manga cleanup failed:", error);
    return 0;
  }
}

/**
 * Removes manga history for every user whose last activity is older than 30
 * days. Throttled per isolate so normal page requests do not trigger a write
 * every time.
 */
export async function cleanupInactiveMangaHistory(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastGlobalCleanupAt < GLOBAL_CLEANUP_INTERVAL_MS) {
    return 0;
  }
  lastGlobalCleanupAt = now;
  const cutoff = inactiveCutoff();

  try {
    const db = getDb();
    const inactiveUsers = db
      .select({ id: users.id })
      .from(users)
      .where(lt(users.lastActiveAt, cutoff));

    const result = await db
      .delete(mangaReadingHistory)
      .where(
        and(
          lt(mangaReadingHistory.updatedAt, cutoff),
          inArray(mangaReadingHistory.userId, inactiveUsers)
        )
      );

    return Number((result as any)?.meta?.changes ?? 0);
  } catch (error) {
    // Allow a later request to retry if D1 was temporarily unavailable.
    lastGlobalCleanupAt = 0;
    console.warn("[UserActivity] Global manga cleanup failed:", error);
    return 0;
  }
}

/**
 * Marks a user as active. The stale-history delete happens before the
 * lastActiveAt update, so a user returning after 30+ days still gets their old
 * "Continue reading" rows cleared on that first request.
 */
export async function recordUserActivity(userId: string): Promise<void> {
  if (!userId) return;
  const cutoff = inactiveCutoff();

  try {
    const db = getDb();
    const [user] = await db
      .select({ lastActiveAt: users.lastActiveAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return;

    const lastActiveMs = user.lastActiveAt
      ? new Date(user.lastActiveAt).getTime()
      : 0;
    const now = Date.now();

    if (!lastActiveMs || lastActiveMs < cutoff.getTime()) {
      await db
        .delete(mangaReadingHistory)
        .where(
          and(
            eq(mangaReadingHistory.userId, userId),
            lt(mangaReadingHistory.updatedAt, cutoff)
          )
        );
    }

    if (!lastActiveMs || now - lastActiveMs > ACTIVITY_WRITE_INTERVAL_MS) {
      await db
        .update(users)
        .set({ lastActiveAt: new Date(now) })
        .where(eq(users.id, userId));
    }
  } catch (error) {
    console.warn("[UserActivity] Failed to record activity:", error);
  }
}
