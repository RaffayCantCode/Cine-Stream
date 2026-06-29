"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { ServerCrash, RefreshCcw, Home } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if desired
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 text-center max-w-lg mx-auto flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl backdrop-blur-sm">
            <ServerCrash className="w-12 h-12 text-red-500" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
            System Error
          </h1>
          
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            Something went wrong while loading this page. Our servers might be experiencing a hiccup, or the API failed to respond.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <button 
              onClick={() => reset()}
              className="flex items-center justify-center gap-2 bg-white text-black px-8 py-3.5 rounded-full font-medium hover:bg-white/90 transition-all active:scale-95 shadow-lg shadow-white/20"
            >
              <RefreshCcw className="w-5 h-5" />
              Try Again
            </button>
            <Link 
              href="/"
              className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 px-8 py-3.5 rounded-full font-medium hover:bg-white/10 transition-all active:scale-95 backdrop-blur-sm"
            >
              <Home className="w-5 h-5" />
              Return Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
