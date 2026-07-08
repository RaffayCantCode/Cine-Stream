"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/utils";
import { ChevronLeft, ChevronRight, User } from "lucide-react";

interface Person {
  id: number;
  name: string;
  profile_path?: string;
  known_for_department?: string;
}

export function SimilarPeople({ id, department }: { id: number; department: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchJson<{ results: Person[] }>(`/api/tmdb/person/${id}/similar`);
        setPeople(data.results || []);
      } catch (err) {
        setPeople([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

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
  }, [people.length]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (isLoading || people.length === 0) return null;

  const isDirector = department === "Directing";

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-xl font-bold tracking-tight text-white">
            {isDirector ? "Filmmakers with Similar Styles" : "Frequent Collaborators & Similar Actors"}
          </h2>
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
        <div ref={scrollerRef} className="flex overflow-x-auto overflow-y-hidden gap-4 pb-4 pt-2 hide-scrollbar w-full">
          {people.map((person) => (
            <Link
              href={`/person/${person.id}`}
              key={person.id}
              className="w-[120px] md:w-[140px] shrink-0 text-center group cursor-pointer"
            >
              <div className="aspect-[2/3] rounded-xl bg-card overflow-hidden mb-3 ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary/50 relative">
                {person.profile_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                    alt={person.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <User className="w-8 h-8 text-white/20" />
                  </div>
                )}
              </div>
              <h4 className="font-semibold text-sm text-white line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                {person.name}
              </h4>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
