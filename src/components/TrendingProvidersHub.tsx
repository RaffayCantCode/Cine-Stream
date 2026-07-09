"use client";

import { useState, useEffect, useRef } from "react";
import { fetchJson } from "@/lib/utils";
import { MediaCard } from "@/components/MediaCard";
import { Loader2, Film, Tv, ChevronLeft, ChevronRight } from "lucide-react";
import { PROVIDERS, Provider } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";

function ProviderScrollRow({ title, items, icon, mediaType }: { title: string; items: any[]; icon: React.ReactNode; mediaType: "movie"|"tv" }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft < maxScrollLeft - 2);
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
  }, [items]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, Math.floor(el.clientWidth * 0.85));
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest">{title}</h3>
        </div>
        <div className="hidden md:flex items-center gap-2 pr-6">
          <button
            onClick={(e) => { e.preventDefault(); scrollByAmount("left"); }}
            disabled={!canScrollLeft}
            className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollLeft ? 'hover:bg-primary hover:border-primary cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
          >
            <ChevronLeft className="w-4 h-4 ml-[-1px]" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); scrollByAmount("right"); }}
            disabled={!canScrollRight}
            className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 ${canScrollRight ? 'hover:bg-primary hover:border-primary cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
          >
            <ChevronRight className="w-4 h-4 mr-[-1px]" />
          </button>
        </div>
      </div>
      <div ref={scrollerRef} className="flex gap-4 md:gap-8 overflow-x-auto overflow-y-hidden scrollbar-hide pb-4 pt-4 snap-x pl-6 md:pl-10 relative left-[-24px] w-[calc(100%+48px)] px-6">
        {items.slice(0, 10).map((item, index) => (
          <div key={item.id} className="shrink-0 snap-start">
            <MediaCard item={{...item, media_type: mediaType}} index={index} rank={index + 1} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendingProvidersHub() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [shows, setShows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedProvider) return;

    let active = true;
    const fetchTrending = async () => {
      setIsLoading(true);
      try {
        const ids = [selectedProvider.id, ...(selectedProvider.additionalIds || [])].join("|");
        
        const [moviesRes, showsRes] = await Promise.all([
          fetchJson<{ results: any[] }>(`/api/tmdb/discover/provider?providerId=${ids}&mediaType=movie`),
          fetchJson<{ results: any[] }>(`/api/tmdb/discover/provider?providerId=${ids}&mediaType=tv`)
        ]);

        if (active) {
          setMovies(moviesRes.results || []);
          setShows(showsRes.results || []);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error(err);
          setMovies([]);
          setShows([]);
          setIsLoading(false);
        }
      }
    };
    fetchTrending();
    return () => { active = false; };
  }, [selectedProvider]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-[2px] bg-gradient-to-r from-[#7288AE] to-transparent rounded-full" />
          <div>
            <h2 className="text-lg font-black text-[#EAE0CF] tracking-tight">Trending on Platform</h2>
            <p className="text-[9px] text-[#7288AE]/50 font-semibold tracking-[0.15em] uppercase mt-0.5">
              Top movies & shows by service
            </p>
          </div>
        </div>
      </div>

      {/* Provider Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {PROVIDERS.map((p) => {
          const isSelected = selectedProvider?.id === p.id;
          return (
            <button
              key={p.slug}
              onClick={() => setSelectedProvider(isSelected ? null : p)}
              className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 focus:outline-none flex items-center justify-center min-h-[120px] ${
                isSelected 
                  ? "border-white/40 scale-[1.03] -translate-y-1" 
                  : "border-white/[0.07] hover:scale-[1.03] hover:-translate-y-1"
              }`}
              style={{
                background: isSelected 
                  ? `linear-gradient(145deg, ${p.color}40 0%, ${p.color}15 60%, transparent 100%)`
                  : `linear-gradient(145deg, ${p.color}22 0%, ${p.color}08 60%, transparent 100%)`,
                boxShadow: isSelected 
                  ? `0 0 0 1px ${p.color}40, 0 8px 32px ${p.color}30` 
                  : `0 0 0 1px ${p.color}18, 0 8px 32px ${p.color}10`,
              }}
            >
              <div
                className={`absolute -inset-4 transition-opacity duration-700 blur-2xl ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                style={{ background: `radial-gradient(circle at 60% 40%, ${p.color}30, transparent 70%)` }}
              />
              <div
                className={`absolute top-0 inset-x-0 h-[2px] rounded-t-2xl transition-opacity ${isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
                style={{ background: `linear-gradient(to right, transparent, ${p.color}, transparent)` }}
              />

              <div className="relative p-6 flex items-center justify-center h-full w-full">
                <div className={`transition-transform duration-500 flex items-center justify-center w-full h-full ${isSelected ? "scale-110" : "group-hover:scale-110"}`}>
                  {p.slug === "netflix" && (
                    <img src="https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg" alt="Netflix" className="h-8" />
                  )}
                  {p.slug === "disney-plus" && (
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg" alt="Disney+" className="h-12" style={{ filter: "brightness(0) invert(1)" }} />
                  )}
                  {p.slug === "prime-video" && (
                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png" alt="Prime Video" className="h-16 w-32 object-contain" />
                  )}
                  {p.slug === "apple-tv-plus" && (
                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg" alt="Apple TV+" className="h-8" style={{ filter: "brightness(0) invert(1)" }} />
                  )}
                  {p.slug === "hulu" && (
                    <img src="/hulu-logo.svg" alt="Hulu" className="h-20 w-auto object-contain scale-110" />
                  )}
                  {p.slug === "hbo-max" && (
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/ce/Max_logo.svg" alt="Max" className="h-7" style={{ filter: "brightness(0) invert(1)" }} />
                  )}
                  {p.slug === "paramount-plus" && (
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg" alt="Paramount+" className="h-20 w-auto object-contain scale-110" style={{ filter: "brightness(0) invert(1)" }} />
                  )}
                  {p.slug === "peacock" && (
                    <div className="flex items-center gap-2">
                      <ProviderIcon slug="peacock" className="w-9 h-9" />
                      <span className="text-white font-black text-3xl tracking-tighter" style={{ fontFamily: "Arial, sans-serif" }}>peacock</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Content Row - Only visible when a provider is selected */}
      {selectedProvider && (
        <div className="relative min-h-[300px] w-full rounded-2xl bg-white/[0.02] border border-white/[0.05] p-6 mt-4 animate-fade-in-up overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-white/20" />
            </div>
          ) : (movies.length > 0 || shows.length > 0) ? (
            <div className="flex flex-col gap-8">
              {movies.length > 0 && (
                <ProviderScrollRow 
                  title={`Top 10 Movies on ${selectedProvider.name}`} 
                  items={movies} 
                  icon={<Film className="w-4 h-4 text-white/50" />} 
                  mediaType="movie" 
                />
              )}

              {shows.length > 0 && (
                <ProviderScrollRow 
                  title={`Top 10 Shows on ${selectedProvider.name}`} 
                  items={shows} 
                  icon={<Tv className="w-4 h-4 text-white/50" />} 
                  mediaType="tv" 
                />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/40 text-sm">No trending items found for {selectedProvider.name}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
