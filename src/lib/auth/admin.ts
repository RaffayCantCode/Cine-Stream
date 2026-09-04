import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function verifyAdminSession() {
  try {
    const session = await auth();
    if (!session?.user?.id || typeof session.user.id !== "string") {
      return { error: "Unauthorized: Please sign in", status: 401, user: null };
    }

    const db = getDb();
    if (!db) {
      return { error: "Service unavailable: Database connection offline", status: 503, user: null };
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { id: true, email: true, name: true, role: true, status: true },
    });

    if (!dbUser) {
      return { error: "Forbidden: Account not recognized", status: 403, user: null };
    }

    // Role check: Strictly restrict to active admin or owner
    if (dbUser.role !== "admin" && dbUser.role !== "owner") {
      return { error: "Forbidden: Admin privileges required", status: 403, user: null };
    }

    // Status check: Account must not be disabled, banned, or inactive
    if (dbUser.status !== "active") {
      return { error: "Forbidden: Account is suspended or inactive", status: 403, user: null };
    }

    return { error: null, status: 200, user: dbUser, db };
  } catch (error) {
    console.error("[Security] Admin verification failed:", error);
    return { error: "Unauthorized: Access verification failed", status: 401, user: null };
  }
}
