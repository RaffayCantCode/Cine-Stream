"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { fetchJson, shuffleArray } from "@/lib/utils";
import { motion } from "framer-motion";
import { Globe, Database, AlertCircle, Loader2 } from "lucide-react";

interface MangaItem {
  id: string;
  name: string;
  poster: string;
  type?: string;
  genres?: string[];
  year?: number;
  author?: string;
}

export default function MangaBrowsePage() {
  return (
    <Suspense fallback={<MangaBrowseLoading />}>
      <MangaBrowseContent />
    </Suspense>
  );
}

function MangaBrowseLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-0">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="h-12 w-48 bg-muted/50 rounded-xl animate-pulse mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function MangaBrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mangas, setMangas] = useState<MangaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"popular" | "latest">("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const source = (searchParams.get("source") as "mangadex" | "weebcentral") || "mangadex";

  const loadManga = useCallback(async (pageNum: number, append: boolean = false, sourceParam?: string) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError(null);

    try {
      const src = sourceParam || source;
      const url = `/api/manga?category=${activeTab}&page=${pageNum}&source=${src}`;
      const data = await fetchJson<{ success: boolean; data: MangaItem[]; error?: string }>(url);

      if (data.success && data.data) {
        if (append) setMangas(prev => [...prev, ...data.data]);
        else setMangas(shuffleArray(data.data));
        setHasMore(data.data.length > 0);
        setPage(pageNum);
      } else {
        throw new Error(data.error || "No data returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load manga");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, source]);

  useEffect(() => {
    loadManga(1, false);
  }, [activeTab, source]);

  const handleLoadMore = () => loadManga(page + 1, true);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    fetchJson<{ success: boolean; data: MangaItem[] }>(
      `/api/manga?category=search&q=${encodeURIComponent(searchQuery)}&source=${source}`
    ).then(data => {
      if (data.success) setMangas(data.data || []);
      setHasMore(false);
    }).catch(e => setError(e instanceof Error ? e.message : "Search failed"))
      .finally(() => setIsLoading(false));
  };

  const handleSourceChange = (newSource: "mangadex" | "weebcentral") => {
    router.push(`/manga?source=${newSource}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-0">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                <h1 className="text-4xl font-bold text-white">Manga</h1>
                <span className="text-xs font-bold tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase">
                  📚 Read Online
                </span>
              </div>
              <p className="text-sm text-white/40 mt-1 ml-5">
                Read your favorite manga online. Track your reading progress!
              </p>
            </div>
            <div className="flex items-center gap-2 ml-5 md:ml-0">
              <input
                type="text"
                placeholder="Search manga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold outline-none placeholder:text-white/30 w-44"
              />
              <button onClick={handleSearch} className="h-10 px-4 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition">
                Search
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-8 flex-wrap">
            {(["popular", "latest"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${activeTab === tab ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20" : "bg-white/[0.05] text-white/50 hover:bg-white/[0.09] hover:text-white"}`}>
                {tab === "popular" ? "🔥 Popular" : "🆕 Latest"}
              </button>
            ))}

            <div className="w-px h-6 bg-white/10 mx-2" />

            <div className="flex items-center gap-1 bg-white/[0.05] rounded-xl p-1">
              <button onClick={() => handleSourceChange("mangadex")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${source === "mangadex" ? "bg-violet-600 text-white" : "text-white/50 hover:text-white"}`}>
                <Database className="w-3.5 h-3.5" /> MangaDex
              </button>
              <button onClick={() => handleSourceChange("weebcentral")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${source === "weebcentral" ? "bg-emerald-600 text-white" : "text-white/50 hover:text-white"}`}>
                <Globe className="w-3.5 h-3.5" /> WeebCentral
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load manga</div>
                  <div className="text-sm text-white/50 mb-4">{error}</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSourceChange(source === "mangadex" ? "weebcentral" : "mangadex")}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-500 transition">
                      Try {source === "mangadex" ? "WeebCentral" : "MangaDex"}
                    </button>
                    <button onClick={() => loadManga(1, false)} className="px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm font-bold hover:bg-white/20 transition">
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {mangas.map((manga, i) => (
                  <MangaCard key={`${manga.id}-${i}`} item={manga} index={i} source={source} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-12">
                  <button onClick={handleLoadMore} disabled={isLoadingMore}
                    className="h-11 px-8 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 disabled:opacity-50 transition">
                    {isLoadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function MangaCard({ item, index, source }: { item: MangaItem; index: number; source: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, duration: 0.35 }}>
      <Link href={`/manga/${item.id}?source=${source}`}
        className="group relative block aspect-[2/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted transition-all duration-300 hover:scale-[1.06] hover:z-10"
        style={{ transformOrigin: "center bottom" }}>
        {item.poster ? (
          <img src={item.poster} alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{item.name}</span>
          </div>
        )}

        <div className="absolute top-2 left-2 z-20">
          <span className={`${source === "mangadex" ? "bg-violet-600" : "bg-emerald-600"}/90 backdrop-blur-sm text-white text-[9px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-md uppercase`}>
            📚 {item.type || "Manga"}
          </span>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3.5">
          <div className="relative z-10">
            <h3 className="text-white font-bold text-sm leading-tight mb-0.5 line-clamp-2">{item.name}</h3>
            {item.genres && item.genres.length > 0 && (
              <p className="text-white/40 text-[10px] leading-tight mb-1 line-clamp-1">{item.genres.slice(0, 2).join(", ")}</p>
            )}
            {item.year && <span className="text-white/40 text-[9px]">{item.year}</span>}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}