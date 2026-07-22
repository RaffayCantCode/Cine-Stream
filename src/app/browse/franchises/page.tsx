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
    <div className="flex h-screen bg-[#060918] text-white font-sans overflow-hidden flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 md:pl-56 lg:pl-64 h-[100dvh] overflow-y-auto w-full custom-scrollbar relative bg-[#060918]">
        
        {/* Premium Header Section */}
        <div className="relative pt-24 md:pt-20 pb-16 px-5 md:px-10 lg:px-16 flex flex-col md:flex-row items-center md:items-end justify-between min-h-[250px]">
          <div className="absolute inset-0 z-0">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#4B5694]/30 via-[#4B5694]/5 to-[#060918] opacity-80" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#060918] via-[#060918]/80 to-transparent" />
          </div>
          
          <div className="relative z-10 text-center md:text-left mb-6 md:mb-0">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#4B5694] to-[#7288AE] drop-shadow-sm">
                Epic
              </span>
              <span className="text-white ml-3">Franchises</span>
            </h1>
            <p className="text-zinc-400 font-medium max-w-lg mt-3 md:mt-4 text-sm md:text-base leading-relaxed">
              Dive deep into your favorite cinematic universes and binge them in perfect order.
            </p>
          </div>
        </div>

        <div className="px-5 md:px-10 lg:px-16 relative z-10">

          <div className="mt-4 md:mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 md:gap-6 pb-24">
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
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#4B5694]/5 aspect-[2/3] hover:border-white/20 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-2xl transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7288AE]"
                >
                  {posterUrl ? (
                    <>
                      <img
                        src={posterUrl}
                        alt={col.name}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-zinc-900">
                      <span className="text-center font-bold text-white text-sm">{col.name}</span>
                    </div>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-3 group-hover:translate-y-0 transition-transform duration-300">
                    <h4 className="text-white font-extrabold text-sm md:text-base tracking-wide line-clamp-2 drop-shadow-lg mb-1 group-hover:text-[#7288AE] transition-colors">
                      {col.name}
                    </h4>
                    <span className="text-[10px] md:text-xs uppercase tracking-widest text-white/50 font-semibold drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                      <span className="w-4 h-[1px] bg-[#7288AE] rounded-full inline-block"></span>
                      Explore
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredFranchises.length === 0 && (
            <div className="w-full flex flex-col items-center justify-center py-24 text-zinc-500 relative z-10">
              <Search className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">No franchises found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
