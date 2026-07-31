"use client";

import { memo, useEffect, useRef, useState } from "react";
import { MediaCard } from "./MediaCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

interface MediaRowProps {
  title: string;
  items?: MediaItem[];
  isLoading?: boolean;
  seeAllHref?: string;
  accentIcon?: React.ReactNode;
  isTop10?: boolean;
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="aspect-[2/3] w-[136px] sm:w-[164px] md:w-[190px] shrink-0 rounded-xl shimmer"
      style={{ animationDelay: `${index * 80}ms` }}
    />
  );
}

export const MediaRow = memo(function MediaRow({ title, items, isLoading, seeAllHref, accentIcon, isTop10 }: MediaRowProps) {
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
    const cardEl = el.querySelector(".row-item") || el.firstElementChild?.firstElementChild;
    const step = cardEl ? (cardEl as HTMLElement).offsetWidth + 16 : 200;
    const scrollCount = Math.max(1, Math.floor(el.clientWidth / step));
    const amount = step * scrollCount;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div
      className="py-3 md:py-4 space-y-3 animate-fade-in-up"
      style={{ animationDuration: "0.45s", contentVisibility: "auto", containIntrinsicSize: "auto 240px" }}
    >
      <div className="flex items-center justify-between px-3 md:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <div className={`w-1 bg-gradient-to-b from-[#D3D1CE] to-[#6C6D74] rounded-full ${isTop10 ? "h-6 md:h-8" : "h-5"}`} />
          <div className="flex items-center gap-2">
            {accentIcon}
            <h2 className={isTop10 ? "text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md" : "text-base md:text-xl font-black text-white tracking-tight"}>{title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                scrollByAmount("left");
              }}
              disabled={!canScrollLeft}
              className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollLeft ? 'hover:bg-white/15 hover:border-white/30 cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
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
              className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollRight ? 'hover:bg-white/15 hover:border-white/30 cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 mr-[-1px]" />
            </button>
          </div>
          {seeAllHref && (
            <a
              href={seeAllHref}
              className="flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-[#D3D1CE] transition-colors group px-3 py-2 rounded-lg hover:bg-white/[0.05]"
            >
              See all
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
        </div>
      </div>

      <div className="relative group/row">
        <div ref={scrollerRef} className="w-full overflow-x-auto overflow-y-hidden pb-5 pt-1 hide-scrollbar will-change-transform touch-pan-y touch-pan-x scroll-smooth">
          <div className="flex px-3 md:px-8 lg:px-10 w-max gap-3 md:gap-4">
            {isLoading
              ? Array.from({ length: isTop10 ? 10 : 8 }).map((_, i) => (
                  <SkeletonCard key={i} index={i} />
                ))
              : (isTop10 ? items?.slice(0, 10) : items)?.map((item, i) => (
                  <MediaCard key={item.id} item={item} index={i} rank={isTop10 ? i + 1 : undefined} priority={isTop10 && i < 4} />
                ))}
          </div>
        </div>
      </div>
    </div>
  );
});
