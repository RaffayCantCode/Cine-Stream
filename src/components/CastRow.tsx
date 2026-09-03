"use client";

import { memo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Person {
  id: number;
  name: string;
  character?: string;
  job?: string;
  profile_path?: string;
}

interface CastRowProps {
  cast: Person[];
  crew: Person[];
}

export const CastRow = memo(function CastRow({ cast, crew }: CastRowProps) {
  const [failedImageIds, setFailedImageIds] = useState<Set<number>>(new Set());

  const hasValidPicture = (p: Person) =>
    Boolean(
      p?.profile_path &&
      typeof p.profile_path === "string" &&
      p.profile_path.trim().length > 0 &&
      p.profile_path !== "null" &&
      !p.profile_path.includes("null") &&
      !failedImageIds.has(p.id)
    );

  // Combine directors/creators with cast (only those with a valid picture)
  const directors = (crew || []).filter(
    (c) => (c.job === "Director" || c.job === "Creator") && hasValidPicture(c)
  );
  
  // Create a combined list, removing duplicates if someone directed AND acted
  const seenIds = new Set<number>();
  const combined: Person[] = [];

  for (const d of directors) {
    if (!seenIds.has(d.id)) {
      seenIds.add(d.id);
      combined.push({ ...d, character: d.job || "Director" }); // Use character field to display "Director"
    }
  }

  for (const c of (cast || [])) {
    if (!seenIds.has(c.id) && hasValidPicture(c)) {
      const charName = c.character?.toLowerCase() || "";
      if (
        !charName.includes("background") &&
        !charName.includes("uncredited") &&
        !charName.includes("extra") &&
        !charName.includes("additional") &&
        combined.length < 24
      ) {
        seenIds.add(c.id);
        combined.push(c);
      }
    }
  }

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
  }, [combined.length]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (combined.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-base font-bold text-white tracking-wide">Cast & Crew</h2>
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
        <div ref={scrollerRef} className="flex overflow-x-auto overflow-y-visible gap-4 pt-3 pb-5 -mt-1 -mb-1 hide-scrollbar w-full">
          {combined.map((person) => (
            <Link
              href={`/person/${person.id}`}
              prefetch={false}
              key={person.id}
              className="w-[100px] shrink-0 text-center group cursor-pointer"
            >
              <div className="aspect-[2/3] rounded-xl bg-card overflow-hidden mb-2.5 ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary/50 relative">
                <img
                  src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={() => {
                    setFailedImageIds((prev) => {
                      const next = new Set(prev);
                      next.add(person.id);
                      return next;
                    });
                  }}
                />
                {/* Director Badge */}
                {person.job && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded backdrop-blur-sm uppercase tracking-wider shadow-lg">
                    {person.job}
                  </div>
                )}
              </div>
              <h4 className="font-semibold text-xs text-white line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                {person.name}
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 group-hover:text-white/70 transition-colors">
                {person.character}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
});
