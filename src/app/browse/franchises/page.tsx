"use client";
export const runtime = 'edge';

import { useState } from "react";
import dynamic from "next/dynamic";
import { FRANCHISES } from "@/lib/franchises";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

import { Sidebar } from "@/components/Sidebar";
const ContinueWatching = dynamic(() => import("@/components/ContinueWatching").then(m => m.ContinueWatching), { ssr: false });

export default function BrowseFranchisesPage() {
  const filteredFranchises = FRANCHISES;

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 md:pl-56 lg:pl-64 h-[100dvh] overflow-y-auto w-full custom-scrollbar relative">
        
        {/* Premium Header Section */}
        <div className="relative pt-24 md:pt-20 pb-12 px-5 md:px-10 lg:px-16 flex flex-col md:flex-row items-center md:items-end justify-between min-h-[240px]">
          <div className="absolute inset-0 z-0 pointer-events-none">
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-accent/10 to-transparent" />
             <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          </div>
          
          <div className="relative z-10 text-center md:text-left mb-4 md:mb-0">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-foreground to-accent drop-shadow-md">
                Epic
              </span>
              <span className="text-foreground ml-3">Franchises</span>
            </h1>
            <p className="text-muted-foreground font-medium max-w-lg mt-2 md:mt-3 text-sm md:text-base leading-relaxed">
              Dive deep into your favorite cinematic universes and binge them in perfect chronological order.
            </p>
          </div>
        </div>

        <div className="px-5 md:px-10 lg:px-16 relative z-10">

          <div className="mt-4 md:mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5 md:gap-6 pb-24">
            {filteredFranchises.map((col) => {
              const posterUrl = col.poster_path
                ? col.poster_path.startsWith("http")
                  ? col.poster_path
                  : `https://image.tmdb.org/t/p/w500${col.poster_path}`
                : null;
              return (
                <Link
                  key={col.id}
                  href={`/browse/franchise/${col.id}`}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-card/80 aspect-[2/3] hover:border-white/35 hover:scale-[1.03] hover:-translate-y-1 shadow-[0_12px_32px_rgba(0,0,0,0.65)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.9)] transition-all duration-300 sheen-wrapper focus:outline-none"
                >
                  {posterUrl ? (
                    <>
                      <img
                        src={posterUrl}
                        alt={col.name}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-card">
                      <span className="text-center font-bold text-foreground text-sm">{col.name}</span>
                    </div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <h4 className="text-white font-extrabold text-sm md:text-base tracking-tight line-clamp-2 drop-shadow-md mb-1.5 group-hover:text-primary transition-colors">
                      {col.name}
                    </h4>
                    <span className="inline-flex items-center gap-1.5 text-[10px] md:text-[11px] uppercase tracking-widest text-white/90 font-bold drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/15 backdrop-blur-md px-2.5 py-0.5 rounded-md border border-white/10">
                      Explore Sagas →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredFranchises.length === 0 && (
            <div className="w-full flex flex-col items-center justify-center py-24 text-muted-foreground relative z-10">
              <Search className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">No franchises found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
