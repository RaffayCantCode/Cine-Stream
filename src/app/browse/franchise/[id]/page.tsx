"use client";
export const runtime = 'edge';
import { useState, useEffect, use, useRef, useMemo } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { CinematicHero } from "@/components/CinematicHero";
import { GridMediaCard } from "@/components/GridMediaCard";
import { Loader2, ArrowLeft } from "lucide-react";
import { fetchJson } from "@/lib/utils";

interface Collection {
  id: string | number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: any[];
  groups?: { name: string; parts: any[] }[];
}

function DoomsdayCountdown() {
  const targetDate = useMemo(() => new Date("2026-12-16T00:00:00Z").getTime(), []);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, targetDate - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="flex flex-col gap-3 items-start md:items-end">
      {/* Tagline Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 backdrop-blur-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
          Doom is coming in
        </span>
      </div>

      {/* Box-Free Typography Countdown */}
      <div className="flex items-center gap-3.5 sm:gap-5 text-emerald-400">
        <div className="flex flex-col items-center">
          <span className="text-3xl md:text-4xl font-extrabold font-mono text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]">
            {String(timeLeft.days).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mt-1">Days</span>
        </div>

        <span className="text-emerald-500/40 text-xl font-bold pb-4">:</span>

        <div className="flex flex-col items-center">
          <span className="text-3xl md:text-4xl font-extrabold font-mono text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]">
            {String(timeLeft.hours).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mt-1">Hours</span>
        </div>

        <span className="text-emerald-500/40 text-xl font-bold pb-4">:</span>

        <div className="flex flex-col items-center">
          <span className="text-3xl md:text-4xl font-extrabold font-mono text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]">
            {String(timeLeft.minutes).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mt-1">Mins</span>
        </div>

        <span className="text-emerald-500/40 text-xl font-bold pb-4">:</span>

        <div className="flex flex-col items-center">
          <span className="text-3xl md:text-4xl font-extrabold font-mono text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]">
            {String(timeLeft.seconds).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mt-1">Secs</span>
        </div>
      </div>
    </div>
  );
}

export default function FranchisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydratedPosterIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    window.scrollTo(0, 0);
    hydratedPosterIds.current.clear();
    const load = async () => {
      try {
        const data = await fetchJson<Collection>(`/api/tmdb/collection/${id}?v=franchise-complete-v3`, { skipCache: true });
        setCollection(data);
      } catch (err) {
        setError("Failed to load franchise");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!collection) return;

    const flatItems = [
      ...(collection.parts || []),
      ...(collection.groups || []).flatMap(group => group.parts || []),
    ];
    const missingPosterItems = flatItems.filter(item => {
      const key = `${item.media_type || "movie"}-${item.id}`;
      return item?.id && !item.poster_path && !hydratedPosterIds.current.has(key) && item.media_type !== "anime";
    });

    if (missingPosterItems.length === 0) return;

    let cancelled = false;

    const hydratePosters = async () => {
      const updates = new Map<string, any>();

      const searchFallback = async (item: any, mediaType: "movie" | "tv") => {
        const title = item.title || item.name;
        if (!title) return null;

        const search = await fetchJson<any>(
          `/api/tmdb/search?query=${encodeURIComponent(title)}&type=${mediaType}&page=1`,
          { skipCache: true }
        );
        const normalizedTitle = title.toLowerCase();
        const results = search.results || [];
        return (
          results.find((result: any) => (result.title || result.name || "").toLowerCase() === normalizedTitle && result.poster_path) ||
          results.find((result: any) => result.poster_path) ||
          null
        );
      };

      for (let i = 0; i < missingPosterItems.length; i += 6) {
        const batch = missingPosterItems.slice(i, i + 6);
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            const mediaType = item.media_type === "tv" ? "tv" : "movie";
            const key = `${mediaType}-${item.id}`;

            let detail: any = null;
            let fallback: any = null;

            try {
              detail = await fetchJson<any>(`/api/tmdb/${mediaType}/${item.id}`, {
                skipCache: true,
              });
            } catch {}

            if (!detail?.poster_path) {
              try {
                fallback = await searchFallback(item, mediaType);
              } catch {}
            }

            return {
              key,
              id: item.id,
              media_type: item.media_type,
              title: item.title || detail?.title || detail?.name || fallback?.title || fallback?.name,
              name: item.name || item.title || detail?.title || detail?.name || fallback?.title || fallback?.name,
              overview: item.overview || detail?.overview || fallback?.overview,
              poster_path: detail?.poster_path || fallback?.poster_path || item.poster_path || null,
              backdrop_path: item.backdrop_path || detail?.backdrop_path || fallback?.backdrop_path || null,
              vote_average: item.vote_average ?? detail?.vote_average ?? fallback?.vote_average,
              release_date: item.release_date || detail?.release_date || detail?.first_air_date || fallback?.release_date || fallback?.first_air_date,
              first_air_date: item.first_air_date || detail?.first_air_date || fallback?.first_air_date,
            };
          })
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value.poster_path) {
            hydratedPosterIds.current.add(result.value.key);
            updates.set(result.value.key, result.value);
          }
        }

        if (cancelled || updates.size === 0) continue;

        setCollection(prev => {
          if (!prev) return prev;
          const applyUpdate = (item: any) => updates.get(`${item.media_type || "movie"}-${item.id}`) || item;
          return {
            ...prev,
            parts: (prev.parts || []).map(applyUpdate),
            groups: prev.groups?.map(group => ({
              ...group,
              parts: (group.parts || []).map(applyUpdate),
            })),
          };
        });
      }
    };

    hydratePosters().catch(() => {});
    return () => { cancelled = true; };
  }, [collection]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Sidebar />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Sidebar />
        <p className="text-white/50">{error || "Collection not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 bleed-header">
        <CinematicHero
          backdropPath={collection.backdrop_path}
          title={collection.name}
          theme="movie"
        >
          <div className="pb-12 px-5 md:px-10 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <Link 
                href="/browse/franchises"
                className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white rounded-full text-sm font-medium transition-all mb-6 border border-white/10 hover:border-white/20 w-fit"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Franchises
              </Link>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4">
                {collection.name}
              </h1>
              {collection.overview && (
                <p className="text-white/70 max-w-2xl text-sm md:text-base leading-relaxed">
                  {collection.overview}
                </p>
              )}
            </div>

            {id === "marvel" && (
              <div className="hidden md:block shrink-0 pb-2">
                <DoomsdayCountdown />
              </div>
            )}
          </div>
        </CinematicHero>

        {id === "marvel" && (
          <div className="md:hidden max-w-screen-2xl mx-auto px-5 pt-6 pb-2">
            <DoomsdayCountdown />
          </div>
        )}

        <div className="max-w-screen-2xl mx-auto px-5 md:px-10 pb-10 pt-8">
          {collection.groups && collection.groups.length > 0 ? (
            <div className="flex flex-col gap-12">
              {collection.groups.map((group, gIdx) => (
                <div key={gIdx}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-5 bg-primary rounded-full" />
                    <h2 className="text-xl font-bold tracking-tight text-white">{group.name}</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                    {group.parts.map((item, index) => (
                      <GridMediaCard key={item.id} item={item} index={index} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 bg-primary rounded-full" />
                <h2 className="text-xl font-bold tracking-tight text-white">Chronological Order</h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                {collection.parts.map((item, index) => (
                  <GridMediaCard key={item.id} item={item} index={index} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
