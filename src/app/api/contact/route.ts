export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { topic, message } = await request.json();

    if (!topic || !message || typeof topic !== "string" || typeof message !== "string") {
      return NextResponse.json({ error: "Topic and message are required" }, { status: 400 });
    }

    const trimmedTopic = topic.trim();
    const trimmedMessage = message.trim();

    if (trimmedTopic.length < 2 || trimmedTopic.length > 200) {
      return NextResponse.json({ error: "Topic must be between 2 and 200 characters" }, { status: 400 });
    }

    if (trimmedMessage.length < 5 || trimmedMessage.length > 5000) {
      return NextResponse.json({ error: "Message must be between 5 and 5000 characters" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const recipient = process.env.CONTACT_EMAIL || "asifraffy@gmail.com";

    if (!apiKey) {
      console.error("RESEND_API_KEY not configured");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CineStream <onboarding@resend.dev>",
        to: [recipient],
        subject: `[CineStream Feedback] ${trimmedTopic}`,
        text: `Topic: ${trimmedTopic}\n\nMessage:\n${trimmedMessage}`,
        html: `<h2>${trimmedTopic}</h2><p>${trimmedMessage.replace(/\n/g, "<br>")}</p>`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend API error:", err);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    console.log("Contact email sent");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact email error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
