export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { issueReports } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, message, userEmail: rawEmail } = body;

    if (!topic || !message || typeof topic !== "string" || typeof message !== "string") {
      return NextResponse.json({ error: "Topic and message are required" }, { status: 400 });
    }

    const trimmedTopic = topic.trim();
    const trimmedMessage = message.trim();
    const userEmail = (typeof rawEmail === "string" && rawEmail.trim()) ? rawEmail.trim() : "user@cinestream.app";

    if (trimmedTopic.length < 2 || trimmedTopic.length > 200) {
      return NextResponse.json({ error: "Topic must be between 2 and 200 characters" }, { status: 400 });
    }

    if (trimmedMessage.length < 5 || trimmedMessage.length > 5000) {
      return NextResponse.json({ error: "Message must be between 5 and 5000 characters" }, { status: 400 });
    }

    const db = getDb();
    await db.insert(issueReports).values({
      id: crypto.randomUUID(),
      topic: trimmedTopic,
      message: trimmedMessage,
      userEmail: userEmail,
      status: "open",
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Issue report submitted successfully!",
    });
  } catch (error) {
    console.error("[Contact API] Error processing issue report:", error);
    return NextResponse.json({ error: "Failed to submit issue report" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession();
    if (auth.error || !auth.db) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const db = auth.db;
    const reports = await db.select().from(issueReports).orderBy(desc(issueReports.createdAt)).limit(100);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[Contact API GET] Error fetching reports:", error);
    return NextResponse.json({ reports: [] });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdminSession();
    if (auth.error || !auth.db) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: "Report ID and status are required" }, { status: 400 });
    }

    const db = auth.db;
    await db.update(issueReports).set({ status }).where(eq(issueReports.id, id));

    return NextResponse.json({ success: true, message: `Report marked as ${status}` });
  } catch (error) {
    console.error("[Contact API PATCH] Error updating report:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminSession();
    if (auth.error || !auth.db) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const db = auth.db;
    await db.delete(issueReports).where(eq(issueReports.id, id));

    return NextResponse.json({ success: true, message: "Report deleted successfully" });
  } catch (error) {
    console.error("[Contact API DELETE] Error deleting report:", error);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
