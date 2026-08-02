export const runtime = "edge";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isThemeId, ThemeId, DEFAULT_THEME } from "@/lib/themes";

const themeSchema = z.object({
  theme: z.string().max(32),
});

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ theme: null }, { status: 200 });
  }

  try {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const theme = isThemeId(user?.theme) ? (user.theme as ThemeId) : null;
    return Response.json({ theme });
  } catch (error) {
    console.error("[theme] GET error:", error);
    return Response.json({ theme: null }, { status: 200 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = themeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid theme" }, { status: 400 });
  }

  const requested = parsed.data.theme;
  const theme: ThemeId = isThemeId(requested) ? requested : DEFAULT_THEME;

  try {
    const db = getDb();
    await db.update(users).set({ theme }).where(eq(users.id, userId));
    return Response.json({ theme });
  } catch (error) {
    console.error("[theme] PATCH error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}