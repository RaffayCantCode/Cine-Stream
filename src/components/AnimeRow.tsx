"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AnimeCard, AnimeItem } from "./AnimeCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AnimeRowProps {
  title: string;
  items?: AnimeItem[];
  isLoading?: boolean;
  seeAllHref?: string;
  isTop10?: boolean;
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 rounded-2xl shimmer"
      style={{ animationDelay: `${index * 80}ms` }}
    />
  );
}

export const AnimeRow = memo(function AnimeRow({ title, items, isLoading, seeAllHref, isTop10 }: AnimeRowProps) {
  if (!isLoading && (!items || items.length === 0)) return null;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const target = scrollerRef.current;
      if (!target) return;
      const maxScrollLeft = target.scrollWidth - target.clientWidth;
      setCanScrollLeft(target.scrollLeft > 2);
      setCanScrollRight(target.scrollLeft < maxScrollLeft - 2);
    };

    const throttledUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    update();
    el.addEventListener("scroll", throttledUpdate, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      el.removeEventListener("scroll", throttledUpdate);
      window.removeEventListener("resize", update);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [items?.length, isLoading]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div
      className="py-6 md:py-8 space-y-5 animate-fade-in-up"
      style={{ animationDuration: "0.5s" }}
    >
      <div className="flex items-center justify-between px-5 md:px-14">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-gradient-to-b from-[#7288AE] to-[#4B5694] rounded-full" />
          <h2 className="text-lg md:text-2xl font-black text-white tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollByAmount("left")}
              disabled={!canScrollLeft}
              className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.12] hover:border-[#7288AE]/30 disabled:opacity-30 transition-all duration-200 backdrop-blur-sm"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 mx-auto" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount("right")}
              disabled={!canScrollRight}
              className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.12] hover:border-[#7288AE]/30 disabled:opacity-30 transition-all duration-200 backdrop-blur-sm"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 mx-auto" />
            </button>
          </div>
          {seeAllHref && (
            <a
              href={seeAllHref}
              className="flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-[#7288AE] transition-colors group px-3 py-2 rounded-lg hover:bg-white/[0.05]"
            >
              See all
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div ref={scrollerRef} className="w-full overflow-x-auto pb-6 pt-2 hide-scrollbar">
          <div className={`flex gap-4 md:gap-5 px-5 md:px-14 w-max ${isTop10 ? "pl-8 md:pl-16" : ""}`}>
            {isLoading
              ? Array.from({ length: isTop10 ? 10 : 8 }).map((_, i) => (
                  <SkeletonCard key={i} index={i} />
                ))
              : (isTop10 ? items?.slice(0, 10) : items)?.map((item, i) => (
                  <AnimeCard key={item.id} item={item} index={i} rank={isTop10 ? i + 1 : undefined} />
                ))}
          </div>
        </div>
      </div>
    </div>
  );
});