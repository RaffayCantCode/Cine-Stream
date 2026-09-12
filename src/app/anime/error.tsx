"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { RefreshCcw, Home, Sparkles } from "lucide-react";

export default function AnimeHubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Anime Hub Route Error]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#07080d] text-foreground flex">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#4B5694]/15 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-lg mx-auto flex flex-col items-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-[#4B5694]/20 border border-[#7288AE]/30 flex items-center justify-center shadow-2xl backdrop-blur-md text-[#9EB2D1]">
            <Sparkles className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Anime Hub Error
            </h1>
            <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
              We couldn&apos;t load the anime catalog right now. Please try again in a moment.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-md"
            >
              <RefreshCcw className="w-4 h-4" />
              Try Again
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white text-sm font-bold transition-all active:scale-95"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
