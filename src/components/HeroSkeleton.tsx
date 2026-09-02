"use client";

import { memo } from "react";

export const HeroSkeleton = memo(function HeroSkeleton() {
  return (
    <div
      className="relative w-full h-[82svh] min-h-[480px] max-h-[700px] sm:h-[58vw] sm:max-h-[610px] md:h-[72vh] flex items-end bg-background overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Ambient background glow & subtle shimmer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 28% 45%, rgba(99, 102, 241, 0.08) 0%, rgba(20, 24, 40, 0.3) 50%, transparent 80%)",
          }}
        />
        <div className="absolute inset-0 skeleton-pulse opacity-40" />
      </div>

      {/* Scrim stack matching HeroBanner */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
      <div className="hidden md:block absolute inset-y-0 left-0 w-full bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
      <div className="md:hidden absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-background/95 via-background/60 to-transparent" />
      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-background/40 to-transparent" />

      {/* Ambient poster silhouette on desktop */}
      <div className="hidden md:flex absolute right-6 lg:right-12 xl:right-16 top-1/2 -translate-y-1/2 w-[200px] lg:w-[240px] xl:w-[270px] aspect-[2/3] rounded-2xl overflow-hidden skeleton-pulse border border-white/[0.06] opacity-30 shadow-2xl" />

      {/* Content skeleton matching HeroBanner layout */}
      <div className="relative z-10 w-full px-5 md:px-12 lg:px-16 xl:px-20 pb-8 sm:pb-9 md:pb-12">
        <div className="max-w-full sm:max-w-lg md:max-w-2xl flex flex-col items-center text-center md:items-start md:text-left mx-auto md:mx-0 rounded-2xl md:bg-transparent bg-black/10 px-4 py-5 md:p-0">
          
          {/* Badge & Tags placeholder */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-2.5 mb-3">
            <div className="h-6 w-16 rounded-lg skeleton-pulse" />
            <div className="h-6 w-14 rounded-lg skeleton-pulse" />
            <div className="h-6 w-20 rounded-lg skeleton-pulse" />
          </div>

          {/* Title placeholder */}
          <div className="h-9 sm:h-12 md:h-14 w-4/5 sm:w-3/4 max-w-md rounded-xl skeleton-pulse mb-3.5" />

          {/* Overview placeholder lines */}
          <div className="w-full max-w-lg space-y-2 mb-6">
            <div className="h-3.5 sm:h-4 w-full rounded-md skeleton-pulse" />
            <div className="h-3.5 sm:h-4 w-11/12 rounded-md skeleton-pulse" />
            <div className="h-3.5 sm:h-4 w-3/4 rounded-md skeleton-pulse" />
          </div>

          {/* Action buttons placeholder */}
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
            <div className="h-12 sm:h-13 w-36 sm:w-40 rounded-xl skeleton-pulse shadow-lg" />
            <div className="h-12 sm:h-13 w-28 sm:w-32 rounded-xl skeleton-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
});
