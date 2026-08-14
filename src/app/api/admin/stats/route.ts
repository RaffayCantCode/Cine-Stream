export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { 
  users, 
  siteAnnouncements, 
  customHomeSections, 
  customFranchises, 
  siteSpotlight,
  watchHistory,
  watchlists
} from "@/lib/db/schema";
import { count, eq, sql, gt, or } from "drizzle-orm";
import { FRANCHISES } from "@/lib/franchises";

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;

    // Fetch user metrics
    const totalUsersResult = await db.select({ value: count() }).from(users);
    const totalUsers = Number(totalUsersResult[0]?.value || 0);

    const adminUsersResult = await db.select({ value: count() }).from(users).where(or(eq(users.role, "admin"), eq(users.role, "owner")));
    const adminUsers = Number(adminUsersResult[0]?.value || 0);

    // Active in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsersResult = await db
      .select({ value: count() })
      .from(users)
      .where(gt(users.lastActiveAt, oneDayAgo));
    const activeUsers = Math.max(1, Number(activeUsersResult[0]?.value || 1));

    // Custom sections
    const totalSectionsResult = await db.select({ value: count() }).from(customHomeSections);
    const totalSections = Number(totalSectionsResult[0]?.value || 0);

    const enabledSectionsResult = await db.select({ value: count() }).from(customHomeSections).where(eq(customHomeSections.enabled, true));
    const enabledSections = Number(enabledSectionsResult[0]?.value || 0);

    // Custom franchises
    const customFranchisesResult = await db.select({ value: count() }).from(customFranchises);
    const customFranchisesCount = Number(customFranchisesResult[0]?.value || 0);
    const totalFranchises = FRANCHISES.length + customFranchisesCount;

    // Watch history & watchlist events
    const watchHistoryCountResult = await db.select({ value: count() }).from(watchHistory);
    const watchHistoryCount = Number(watchHistoryCountResult[0]?.value || 0);

    const watchlistCountResult = await db.select({ value: count() }).from(watchlists);
    const watchlistCount = Number(watchlistCountResult[0]?.value || 0);

    // Active announcement
    const announcement = await db.query.siteAnnouncements.findFirst({
      where: eq(siteAnnouncements.id, "current"),
    });
    const hasActiveAnnouncement = !!(announcement?.message && announcement.message.trim().length > 0);

    // Spotlight banner
    const spotlight = await db.query.siteSpotlight.findFirst({
      where: eq(siteSpotlight.id, "current"),
    });
    const isSpotlightActive = !!(spotlight && spotlight.enabled);

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          admins: adminUsers,
          regular: totalUsers - adminUsers,
          activeNow: activeUsers,
        },
        catalog: {
          totalFranchises,
          staticFranchises: FRANCHISES.length,
          customFranchises: customFranchisesCount,
          customSections: totalSections,
          enabledCustomSections: enabledSections,
        },
        activity: {
          totalWatches: watchHistoryCount,
          totalWatchlists: watchlistCount,
        },
        features: {
          announcementActive: hasActiveAnnouncement,
          announcementText: announcement?.message || null,
          spotlightActive: isSpotlightActive,
          spotlightTitle: spotlight?.title || null,
        },
      },
    });
  } catch (error) {
    console.error("[Admin Stats API] Error:", error);
    return NextResponse.json({ error: "Failed to load dashboard statistics" }, { status: 500 });
  }
}
