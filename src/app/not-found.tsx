"use client";

import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { AlertCircle, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 text-center max-w-lg mx-auto flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl backdrop-blur-sm">
            <AlertCircle className="w-12 h-12 text-primary" />
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
            404
          </h1>
          
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">
            Lost in the Void
          </h2>
          
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            The movie, show, or page you're looking for has been moved, deleted, or never existed in this universe.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link 
              href="/"
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-medium hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/25"
            >
              <Home className="w-5 h-5" />
              Return Home
            </Link>
            <Link 
              href="/search"
              className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 px-8 py-3.5 rounded-full font-medium hover:bg-white/10 transition-all active:scale-95 backdrop-blur-sm"
            >
              <Search className="w-5 h-5" />
              Search Library
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
