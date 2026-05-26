"use client";

import { useEffect, useRef, useState } from "react";
import { AnimeCard, AnimeItem } from "./AnimeCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface AnimeRowProps {
  title: string;
  items?: AnimeItem[];
  isLoading?: boolean;
  seeAllHref?: string;
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="aspect-[2/3] w-[150px] sm:w-[180px] md:w-[210px] shrink-0 rounded-xl bg-muted/40 animate-pulse"
      style={{ animationDelay: `${index * 80}ms` }}
    />
  );
}

export function AnimeRow({ title, items, isLoading, seeAllHref }: AnimeRowProps) {
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
      className="py-5 md:py-7 space-y-4"
    >
      <div className="flex items-center justify-between px-5 md:px-10">
        <div className="flex items-center gap-3">
          {/* Violet accent for anime rows */}
          <div className="w-1 h-5 bg-[#831C91] rounded-full" />
          <h2 className="text-base md:text-lg font-bold text-white tracking-wide">{title}</h2>
          <span className="text-[10px] font-bold tracking-widest text-[#D552A3] bg-[#831C91]/10 border border-[#D552A3]/20 px-2 py-0.5 rounded-full uppercase">
            🇯🇵 JP Sub/Dub
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollByAmount("left")}
              disabled={!canScrollLeft}
              className="w-9 h-9 rounded-full border border-[#D552A3]/20 bg-[#831C91]/[0.05] text-white/70 hover:text-white hover:bg-[#831C91]/[0.12] disabled:opacity-40 disabled:hover:bg-[#831C91]/[0.05] transition"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 mx-auto" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount("right")}
              disabled={!canScrollRight}
              className="w-9 h-9 rounded-full border border-[#D552A3]/20 bg-[#831C91]/[0.05] text-white/70 hover:text-white hover:bg-[#831C91]/[0.12] disabled:opacity-40 disabled:hover:bg-[#831C91]/[0.05] transition"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 mx-auto" />
            </button>
          </div>
          {seeAllHref && (
            <a
              href={seeAllHref}
              className="flex items-center gap-0.5 text-xs font-semibold text-[#D552A3]/70 hover:text-[#D552A3] transition-colors group"
            >
              See all
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
        </div>
      </div>

      <div ref={scrollerRef} className="w-full overflow-x-auto pb-4 pt-2 hide-scrollbar">
        <div className="flex gap-3 md:gap-4 px-5 md:px-10 w-max">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} index={i} />
              ))
            : items?.map((item, i) => (
                <AnimeCard key={item.id} item={item} index={i} />
              ))}
        </div>
      </div>
    </motion.div>
  );
}
