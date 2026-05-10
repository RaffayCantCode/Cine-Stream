"use client";

import { useEffect, useRef, useState } from "react";
import { MediaCard } from "./MediaCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

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
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 rounded-xl shimmer"
      style={{ animationDelay: `${index * 80}ms` }}
    />
  );
}

export function MediaRow({ title, items, isLoading, seeAllHref }: MediaRowProps) {
  if (!isLoading && (!items || items.length === 0)) return null;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const update = () => {
      const target = scrollerRef.current;
      if (!target) return;
      const maxScrollLeft = target.scrollWidth - target.clientWidth;
      setCanScrollLeft(target.scrollLeft > 2);
      setCanScrollRight(target.scrollLeft < maxScrollLeft - 2);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items?.length, isLoading]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="py-6 md:py-8 space-y-5"
    >
      <div className="flex items-center justify-between px-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-gradient-to-b from-violet-500 to-violet-600 rounded-full" />
          <h2 className="text-base md:text-xl font-bold text-white tracking-wide">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollByAmount("left")}
              disabled={!canScrollLeft}
              className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-white/[0.03] transition-all duration-200 glass-light"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 mx-auto" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount("right")}
              disabled={!canScrollRight}
              className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-white/[0.03] transition-all duration-200 glass-light"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 mx-auto" />
            </button>
          </div>
          {seeAllHref && (
            <a
              href={seeAllHref}
              className="flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-violet-400 transition-colors group px-3 py-2 rounded-lg hover:bg-white/[0.05]"
            >
              See all
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
        </div>
      </div>

      <div ref={scrollerRef} className="w-full overflow-x-auto pb-6 pt-2 hide-scrollbar">
        <div className="flex gap-4 md:gap-5 px-5 md:px-10 w-max">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} index={i} />
              ))
            : items?.map((item, i) => (
                <MediaCard key={item.id} item={item} index={i} />
              ))}
        </div>
      </div>
    </motion.div>
  );
}
