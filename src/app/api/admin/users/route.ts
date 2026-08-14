export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { users } from "@/lib/db/schema";
import { desc, eq, ilike, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

    let userList = [];
    if (query) {
      userList = await db.query.users.findMany({
        where: or(
          ilike(users.email, `%${query}%`),
          ilike(users.name, `%${query}%`)
        ),
        orderBy: [desc(users.createdAt)],
        limit: 100,
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          image: true,
          theme: true,
          lastActiveAt: true,
          createdAt: true,
        },
      });
    } else {
      userList = await db.query.users.findMany({
        orderBy: [desc(users.createdAt)],
        limit: 100,
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          image: true,
          theme: true,
          lastActiveAt: true,
          createdAt: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      users: userList,
      currentUserId: auth.user.id,
      currentUserRole: auth.user.role,
    });
  } catch (error) {
    console.error("[Admin Users API] GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch user directory" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const body = await request.json().catch(() => ({}));
    const { userId, role, status } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid user ID provided" }, { status: 400 });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, email: true, role: true, status: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isCallerOwner = auth.user.role === "owner";

    // ONLY Site Owner can grant or revoke Admin roles
    if (role !== undefined && role !== targetUser.role) {
      if (!isCallerOwner) {
        return NextResponse.json(
          { error: "Only the Site Owner can grant or remove Admin privileges." },
          { status: 403 }
        );
      }
    }

    // Protection for Owner accounts
    if (targetUser.role === "owner") {
      if (role && role !== "owner") {
        return NextResponse.json({ error: "Site Owner role is permanent and cannot be revoked." }, { status: 403 });
      }
      if (status && status !== "active") {
        return NextResponse.json({ error: "Site Owner account cannot be disabled." }, { status: 403 });
      }
    }

    // Safety check: Prevent admin self-demotion or self-disabling
    if (userId === auth.user.id) {
      if (role && role !== auth.user.role) {
        return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
      }
      if (status && status !== "active") {
        return NextResponse.json({ error: "You cannot disable your own account" }, { status: 400 });
      }
    }

    const updates: Record<string, any> = {};
    if (role === "admin" || role === "user" || role === "owner") {
      updates.role = role;
    }
    if (status === "active" || status === "disabled") {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid role or status modifications provided" }, { status: 400 });
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
      });

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("[Admin Users API] PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update user account" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (auth.error || !auth.db) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = auth.db;
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("userId");

    if (!userId) {
      const body = await request.json().catch(() => ({}));
      userId = body.userId;
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid or missing user ID" }, { status: 400 });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    const isCallerOwner = auth.user.role === "owner";

    // Protection for Owner accounts
    if (targetUser.role === "owner") {
      return NextResponse.json({ error: "Site Owner account cannot be deleted." }, { status: 403 });
    }

    // Protection for Admin accounts: ONLY Site Owner can delete Admin accounts
    if (targetUser.role === "admin" && !isCallerOwner) {
      return NextResponse.json({ error: "Only the Site Owner can delete Admin accounts." }, { status: 403 });
    }

    // Safety check: Prevent deleting logged-in account
    if (userId === auth.user.id) {
      return NextResponse.json({ error: "You cannot delete your own account while logged in." }, { status: 400 });
    }

    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: `User account deleted successfully`,
    });
  } catch (error) {
    console.error("[Admin Users API] DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete user account" }, { status: 500 });
  }
}
