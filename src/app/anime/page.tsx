"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AnimeCard, AnimeItem } from "@/components/AnimeCard";
import { fetchJson, shuffleArray } from "@/lib/utils";
import { motion } from "framer-motion";

export default function AnimeBrowsePage() {
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"spotlight" | "latest" | "popular">("spotlight");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadAnime = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const categoryMap = {
        spotlight: "home",
        latest: "latest",
        popular: "popular",
      };

      const data = await fetchJson<{
        success: boolean;
        data: { latestEpisodeAnimes?: AnimeItem[]; newReleases?: AnimeItem[] };
      }>(`/api/anime?category=${categoryMap[activeTab]}&page=${pageNum}`);

      if (data.success && data.data) {
        const newAnimes = [
          ...(data.data.latestEpisodeAnimes || []),
          ...(data.data.newReleases || []),
        ];

        const seen = new Set<string>();
        const deduped = newAnimes.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });

        if (append) {
          setAnimes((prev) => [...prev, ...deduped]);
        } else {
          setAnimes(shuffleArray(deduped));
        }
        setHasMore(deduped.length > 0);
        setPage(pageNum);
      } else {
        throw new Error("No data returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load anime");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadAnime(1, false);
  }, [activeTab, loadAnime]);

  const handleLoadMore = () => {
    loadAnime(page + 1, true);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{
        success: boolean;
        data: { latestEpisodeAnimes?: AnimeItem[]; newReleases?: AnimeItem[] };
      }>(`/api/anime?category=search&q=${encodeURIComponent(searchQuery)}`);
      if (data.success && data.data) {
        const all = [...(data.data.latestEpisodeAnimes || []), ...(data.data.newReleases || [])];
        setAnimes(all);
        setHasMore(false);
      } else {
        throw new Error("Search failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-6">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1.5 h-8 bg-violet-500 rounded-full" />
                <h1 className="text-4xl font-bold text-white">Anime</h1>
                <span className="text-xs font-bold tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full uppercase">
                  🇯🇵 Japanese Dub · English Subtitles
                </span>
              </div>
              <p className="text-sm text-white/40 mt-1 ml-5">
                All anime here are in Japanese audio with English subtitles. Different from English-dubbed shows.
              </p>
            </div>
            <div className="flex items-center gap-2 ml-5 md:ml-0">
              <input
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold outline-none placeholder:text-white/30 w-40"
              />
              <button
                onClick={handleSearch}
                className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-8">
            {(["spotlight", "latest", "popular"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${
                  activeTab === tab
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "bg-white/[0.05] text-white/50 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                {tab === "spotlight" ? "✨ Spotlight" : tab === "latest" ? "🆕 Latest" : "🔥 Popular"}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80 mb-10">
              <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load anime</div>
              <div className="text-sm text-white/50 break-words">{error}</div>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : animes.length > 0 ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
              >
                {animes.map((item, i) => (
                  <div key={`${item.id}-${i}`} className="w-full h-full flex justify-center">
                    <AnimeCard item={item} index={i} />
                  </div>
                ))}
              </motion.div>

              {hasMore && (
                <div className="flex justify-center mt-12">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="h-11 px-8 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 disabled:opacity-50 transition"
                  >
                    {isLoadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          ) : (
            !error && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <div className="text-6xl mb-4">🍥</div>
                <h3 className="text-xl font-medium text-white mb-2">No anime found</h3>
                <p>The anime library couldn&apos;t be loaded right now. Try again later.</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}