import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function verifyAdminSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized: Please sign in", status: 401, user: null };
  }

  const db = getDb();
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, email: true, name: true, role: true, status: true },
  });

  if (!dbUser || dbUser.role !== "admin") {
    return { error: "Forbidden: Admin privileges required", status: 403, user: null };
  }

  if (dbUser.status === "disabled" || dbUser.status === "banned") {
    return { error: "Forbidden: Account is suspended", status: 403, user: null };
  }

  return { error: null, status: 200, user: dbUser, db };
}
