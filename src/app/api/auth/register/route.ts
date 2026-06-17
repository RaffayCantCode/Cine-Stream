export const dynamic = "force-dynamic";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    // Get database instance dynamically
    const db = getDb();

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const emailNormalized = email.trim().toLowerCase();

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, emailNormalized),
    });

    if (existingUser) {
      return Response.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(users)
      .values({
        name,
        email: emailNormalized,
        password: hashedPassword,
      })
      .returning();

    return Response.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[Register Error]:", error);
    const message = error instanceof Error ? error.message : "Failed to create account";
    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}
