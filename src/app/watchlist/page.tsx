"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked, X, Compass, Clapperboard, Tv, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/Sidebar";
import { GridMediaCard } from "@/components/GridMediaCard";
import { useWatchlist } from "@/context/WatchlistContext";
import type { MediaType } from "@/lib/watchlist";

type Filter = "all" | MediaType;

const FILTERS: { id: Filter; label: string; icon: typeof Clapperboard }[] = [
  { id: "all", label: "All", icon: Layers },
  { id: "movie", label: "Movies", icon: Clapperboard },
  { id: "tv", label: "TV Shows", icon: Tv },
  { id: "anime", label: "Anime", icon: Sparkles },
];

export default function WatchlistPage() {
  const { items, loading, remove } = useWatchlist();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((i) => i.mediaType === filter),
    [items, filter]
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, movie: 0, tv: 0, anime: 0 };
    items.forEach((i) => {
      if (i.mediaType === "movie" || i.mediaType === "tv" || i.mediaType === "anime") {
        c[i.mediaType] += 1;
      }
    });
    return c;
  }, [items]);

  const showEmpty = !loading && items.length === 0;

  const filterLabel = (f: Filter) => FILTERS.find((x) => x.id === f)?.label ?? "items";
  const filterIcon = (f: Filter) => FILTERS.find((x) => x.id === f)?.icon ?? Layers;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-5 md:px-12 max-w-screen-2xl mx-auto">
          <div className="mb-8">
            <h1 className="flex items-center gap-3 text-4xl md:text-5xl font-black text-foreground tracking-tight">
              Your Watchlist
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Movies, shows and anime you saved to watch later.
            </p>
            <div className="h-0.5 w-16 bg-primary/70 rounded-full mt-3 mb-6" />
          </div>

          {showEmpty ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Filters — left column on desktop, top on mobile.
                  Always visible so you can flip back even when a type has 0 items. */}
              <nav className="lg:w-52 shrink-0" aria-label="Watchlist filters">
                <div className="lg:sticky lg:top-20 flex lg:flex-col gap-2 lg:gap-1.5 overflow-x-auto hide-scrollbar lg:overflow-visible pb-1">
                  {FILTERS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setFilter(id)}
                      aria-pressed={filter === id}
                      className={cn(
                        "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all touch-manipulation whitespace-nowrap lg:whitespace-normal",
                        filter === id
                          ? "bg-primary text-primary-foreground shadow-lg shadow-black/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-card"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      <span
                        className={cn(
                          "ml-auto rounded-full px-1.5 text-[10px] font-black",
                          filter === id ? "bg-background/25" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {counts[id]}
                      </span>
                    </button>
                  ))}

                  <Link
                    href="/browse/trending"
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-card transition-all whitespace-nowrap"
                  >
                    <Compass className="w-4 h-4 shrink-0" />
                    Browse Content
                  </Link>
                </div>
              </nav>

              {/* Cards */}
              <div className="flex-1">
                {loading && items.length === 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5 md:gap-6">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="aspect-[2/3] w-full rounded-2xl bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <InlineEmpty
                    label={filterLabel(filter)}
                    icon={filterIcon(filter)}
                    hasItems={items.length > 0}
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5 md:gap-6">
                    {filtered.map((item) => (
                      <div key={`${item.mediaType}-${item.mediaId}`} className="group relative">
                        <GridMediaCard
                          item={{
                            id: item.mediaId,
                            title: item.title,
                            media_type: item.mediaType,
                            poster_path: item.posterPath ?? undefined,
                          }}
                        />
                        <button
                          onClick={() => remove(item.mediaId, item.mediaType)}
                          aria-label={`Remove ${item.title} from watchlist`}
                          className="absolute top-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 backdrop-blur-md text-white shadow-lg ring-1 ring-white/20 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-rose-600 hover:scale-110"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function InlineEmpty({
  label,
  icon: Icon,
  hasItems,
}: {
  label: string;
  icon: typeof Clapperboard;
  hasItems: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground/50 mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <p className="text-lg font-bold text-foreground">
        {hasItems ? `No ${label.toLowerCase()} are wished listed yet` : "No items in your watchlist yet"}
      </p>
      <p className="text-sm text-muted-foreground mt-1">Pick another filter from the left, or add more content.</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 md:py-24">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground/60 mb-6">
        <BookMarked className="w-10 h-10" />
      </div>
      <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
        Your watchlist is empty
      </h2>
      <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-md">
        Save movies, shows, and anime to watch later. Your picks are kept here so you never lose track.
      </p>
      <Link
        href="/browse/trending"
        className="mt-8 inline-flex items-center gap-2 bg-primary hover:bg-primary/85 text-primary-foreground font-bold px-6 py-3.5 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-black/30"
      >
        <Compass className="w-4 h-4" />
        Browse Content
      </Link>
    </div>
  );
}