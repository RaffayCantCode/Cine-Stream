"use client";
export const runtime = 'edge';

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Send, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !message.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      setStatus("sent");
      setTopic("");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64">
        <div className="max-w-lg mx-auto px-5 pt-24 md:pt-16 pb-20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white rounded-full text-sm font-medium transition-all border border-white/10 hover:border-white/20 mb-8 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">
            Report an Issue
          </h1>
          <p className="text-white/50 text-sm mb-10">
            Found something broken? Have a suggestion? Let me know and I&apos;ll fix it.
          </p>

          {status === "sent" ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Message Sent!</h2>
              <p className="text-white/50 text-sm mb-8 max-w-xs">
                Thanks for the feedback. I&apos;ll look into it as soon as possible.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="px-6 py-3 bg-[#4B5694] hover:bg-[#7288AE] text-white rounded-xl text-sm font-bold transition-all"
              >
                Send Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="topic" className="block text-sm font-medium text-white/70 mb-2">
                  Topic
                </label>
                <input
                  id="topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Video player not loading, Search broken, etc."
                  maxLength={200}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#7288AE]/50 focus:border-[#7288AE]/50 transition-all"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-white/70 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what's broken, what you were doing, and any steps to reproduce..."
                  maxLength={5000}
                  rows={6}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#7288AE]/50 focus:border-[#7288AE]/50 transition-all resize-y min-h-[140px]"
                />
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending" || !topic.trim() || !message.trim()}
                className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[#4B5694] hover:bg-[#7288AE] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
