"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GridMediaCard } from "@/components/GridMediaCard";

interface ScrollableGridRowProps {
  title: string;
  items: any[];
}

export function ScrollableGridRow({ title, items }: ScrollableGridRowProps) {
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
  }, [items.length]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!items || items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              scrollByAmount("left");
            }}
            disabled={!canScrollLeft}
            className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollLeft ? 'hover:bg-primary hover:border-primary cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 ml-[-1px]" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              scrollByAmount("right");
            }}
            disabled={!canScrollRight}
            className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollRight ? 'hover:bg-primary hover:border-primary cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 mr-[-1px]" />
          </button>
        </div>
      </div>
      <div className="relative group/row">
        <div ref={scrollerRef} className="flex overflow-x-auto gap-4 md:gap-6 pb-6 pt-2 hide-scrollbar w-full">
          {items.map((item, index) => (
            <div key={`${title}-${item.id}-${item.media_type}`} className="w-[140px] sm:w-[160px] md:w-[200px] shrink-0">
              <GridMediaCard item={item} index={index} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
