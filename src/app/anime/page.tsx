"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { fetchJson } from "@/lib/utils";

type AnimeTab = "popular" | "ongoing" | "recent" | "subbed";

const ANIME_GENRES = ["Action", "Adventure", "Fantasy", "Romance", "Sci-Fi", "Comedy", "Drama", "Sports"];

export default function AnimeBrowsePage() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [tab, setTab] = useState<AnimeTab>("popular");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnime = async (search?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const category = search
        ? `search&q=${encodeURIComponent(search)}`
        : tab === "recent"
          ? "latest"
          : "popular";

      const data = await fetchJson<{
        success: boolean;
        data: { latestEpisodeAnimes?: AnimeItem[]; newReleases?: AnimeItem[]; spotlightAnimes?: AnimeItem[] };
      }>(`/api/anime?category=${category}&page=1`, { cacheTtlMs: 120000 });

      const merged = [
        ...(data.data.spotlightAnimes || []),
        ...(data.data.latestEpisodeAnimes || []),
        ...(data.data.newReleases || []),
      ];

      const seen = new Set<string>();
      const filtered = merged.filter((x: AnimeItem) => {
        const key = x.id;
        if (!key || seen.has(key)) return false;
        seen.add(key);

        if (tab === "subbed") return true;
        if (tab === "ongoing") return /episode|ep/i.test(x.type || "");
        return true;
      });

      setItems(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load anime");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnime();
  }, [tab]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white">Anime</h1>
            <p className="text-sm text-white/40 mt-2">Japanese audio with English subtitles only.</p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(["popular", "ongoing", "recent", "subbed"] as AnimeTab[]).map((item) => (
              <button key={item} onClick={() => setTab(item)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === item ? "bg-violet-600 text-white" : "bg-white/[0.05] text-white/60"}`}>
                {item === "ongoing" ? "Ongoing" : item === "recent" ? "Recently Aired" : item === "subbed" ? "Subbed" : "Popular"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {ANIME_GENRES.map((genre) => (
              <button key={genre} onClick={() => { setQuery(genre); loadAnime(genre); }} className="px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/70 hover:bg-white/[0.1] text-xs">
                {genre}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-8">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anime" className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm" />
            <button onClick={() => loadAnime(query)} className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold">Search</button>
          </div>

          {error && <div className="mb-6 text-sm text-red-300">{error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {isLoading && Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] rounded-xl bg-muted/50 animate-pulse" />)}
            {!isLoading && items.map((item, i) => (
              <div key={`${item.id}-${i}`} className="w-full h-full flex justify-center">
                <AnimeCard item={item} index={i} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
