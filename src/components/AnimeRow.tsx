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
      className="aspect-[2/3] w-[140px] sm:w-[168px] md:w-[195px] lg:w-[215px] shrink-0 rounded-xl shimmer"
      style={{ animationDelay: `${index * 80}ms` }}
    />
  );
}

export const AnimeRow = memo(function AnimeRow({ title, items, isLoading, seeAllHref, isTop10 }: AnimeRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!isLoading && (!items || items.length === 0)) return;
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

  if (!isLoading && (!items || items.length === 0)) return null;

  return (
    <div
      className="py-4 md:py-6 space-y-4 animate-fade-in-up"
      style={{ animationDuration: "0.45s" }}
    >
      <div className="flex items-center justify-between px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16">
        <div className="flex items-center gap-3">
          <div className={`w-1 bg-gradient-to-b from-[#D3D1CE] to-[#6C6D74] rounded-full ${isTop10 ? "h-6 md:h-8" : "h-5"}`} />
          <h2 className={isTop10 ? "text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md" : "text-base md:text-xl font-black text-white tracking-tight"}>{title}</h2>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                scrollByAmount("left");
              }}
              disabled={!canScrollLeft}
              className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollLeft ? 'hover:bg-[#4B5694] hover:border-[#4B5694] cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 ml-[-1px]" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                scrollByAmount("right");
              }}
              disabled={!canScrollRight}
              className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollRight ? 'hover:bg-[#4B5694] hover:border-[#4B5694] cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 mr-[-1px]" />
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

      <div className="relative group/row">
        <div ref={scrollerRef} className="w-full overflow-x-auto overflow-y-visible pt-6 pb-8 -mt-3 -mb-3 hide-scrollbar will-change-transform scroll-smooth">
          <div className="flex px-3 md:px-6 lg:px-8 xl:px-10 2xl:px-12 3xl:px-16 w-max gap-3.5 md:gap-5">
            {isLoading
              ? Array.from({ length: isTop10 ? 10 : 8 }).map((_, i) => (
                  <SkeletonCard key={i} index={i} />
                ))
              : (isTop10 ? items?.slice(0, 10) : items)?.map((item, i) => (
                  <div key={item.id} className={isTop10 ? "shrink-0" : "w-[140px] sm:w-[168px] md:w-[195px] lg:w-[215px] shrink-0"}>
                    <AnimeCard item={item} index={i} rank={isTop10 ? i + 1 : undefined} />
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
});
