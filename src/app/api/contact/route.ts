import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

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

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    const recipient = process.env.CONTACT_EMAIL || "asifraffy@gmail.com";

    if (!user || !pass) {
      console.error("GMAIL_USER or GMAIL_APP_PASSWORD not configured");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: user,
      to: recipient,
      subject: `[CineStream Feedback] ${trimmedTopic}`,
      text: `Topic: ${trimmedTopic}\n\nMessage:\n${trimmedMessage}`,
      html: `<h2>${trimmedTopic}</h2><p>${trimmedMessage.replace(/\n/g, "<br>")}</p>`,
    });

    console.log("Contact email sent:", info.messageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact email error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
