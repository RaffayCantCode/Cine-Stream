"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { fetchJson, shuffleArray } from "@/lib/utils";
import { Star, BookOpen, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

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
  const [mangas, setMangas] = useState<MangaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"popular" | "latest">("popular");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJson<{
          success: boolean;
          data: MangaItem[];
        }>(`/api/manga?category=${activeTab}`);

        if (data.success && data.data) {
          setMangas(shuffleArray(data.data));
        } else {
          throw new Error("Manga API returned no data");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load manga");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pt-8">
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
                className="h-10 px-4 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 text-sm font-semibold outline-none placeholder:text-white/30 w-40"
              />
              <Link
                href="/manga/search"
                className="h-10 px-4 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition flex items-center gap-2"
              >
                Search
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-8">
            {(["popular", "latest"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${
                  activeTab === tab
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                    : "bg-white/[0.05] text-white/50 hover:bg-white/[0.09] hover:text-white"
                }`}
              >
                {tab === "popular" ? "🔥 Popular" : "🆕 Latest"}
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80">
              <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load manga</div>
              <div className="text-sm text-white/50">{error}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {mangas.map((manga, i) => (
                <MangaCard key={manga.id} item={manga} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MangaCard({ item, index }: { item: MangaItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35 }}
    >
      <Link
        href={`/manga/${item.id}`}
        className="group relative block aspect-[2/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted transition-all duration-300 hover:scale-[1.06] hover:z-10"
        style={{ transformOrigin: "center bottom" }}
      >
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center bg-card">
            <span className="text-muted-foreground text-xs font-medium">{item.name}</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-2 left-2 z-20">
          <span className="bg-amber-600/90 backdrop-blur-sm text-white text-[9px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-md uppercase">
            📚 Manga
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3.5">
          <div className="relative z-10">
            <h3 className="text-white font-bold text-sm leading-tight mb-0.5 line-clamp-2">
              {item.name}
            </h3>
            {item.author && (
              <p className="text-white/40 text-[10px] leading-tight mb-1 line-clamp-1">{item.author}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {item.type && (
                <span className="text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                  {item.type}
                </span>
              )}
              {item.year && (
                <span className="text-white/40 text-[9px]">{item.year}</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}