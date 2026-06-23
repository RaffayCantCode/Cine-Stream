"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { MediaCard } from "@/components/MediaCard";
import { fetchJson, filterReleasedSafeContent } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Film, Tv, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  original_language?: string;
  genre_ids?: number[];
}

interface FranchiseResponse {
  results: MediaItem[];
  curated: boolean;
  description?: string;
  name?: string;
}

export default function FranchisePage() {
  const params = useParams();
  const name = (params?.name as string) || "";
  const decodedName = decodeURIComponent(name);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [isCurated, setIsCurated] = useState(false);

  useEffect(() => {
    setItems([]);
    setIsLoading(true);
    setError(null);
    setDescription(null);

    const load = async () => {
      try {
        const data = await fetchJson<FranchiseResponse>(
          `/api/tmdb/franchise?name=${encodeURIComponent(decodedName)}`,
          { cacheTtlMs: 300000 }
        );

        setItems(filterReleasedSafeContent(data.results || []));
        setDescription(data.description || null);
        setIsCurated(data.curated ?? false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load franchise");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [name, decodedName]);

  const movieCount = items.filter((i) => i.media_type === "movie").length;
  const tvCount = items.filter((i) => i.media_type === "tv").length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 pt-6 md:pt-10">
        <div className="px-6 md:px-12 max-w-screen-2xl mx-auto">

          {/* ─── Header ─── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-6 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to home
            </Link>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {isCurated && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded-full bg-[#4B5694]/20 border border-[#7288AE]/20 text-[#7288AE]">
                      <Sparkles className="w-2.5 h-2.5" />
                      Curated
                    </span>
                  )}
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">
                  {decodedName}
                </h1>
                {description && (
                  <p className="text-sm text-white/50 max-w-xl leading-relaxed">
                    {description}
                  </p>
                )}
              </div>

              {/* Stats badges */}
              {!isLoading && items.length > 0 && (
                <div className="flex items-center gap-3 shrink-0 mt-1">
                  {movieCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <Film className="w-4 h-4 text-[#7288AE]" />
                      <span className="text-sm font-semibold text-white">{movieCount}</span>
                      <span className="text-xs text-white/40">{movieCount === 1 ? "Film" : "Films"}</span>
                    </div>
                  )}
                  {tvCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <Tv className="w-4 h-4 text-[#7288AE]" />
                      <span className="text-sm font-semibold text-white">{tvCount}</span>
                      <span className="text-xs text-white/40">{tvCount === 1 ? "Series" : "Series"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {error && (
            <div className="mb-6 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* ─── Grid ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[2/3] rounded-2xl shimmer"
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                ))
              : items.map((item, idx) => (
                  <motion.div
                    key={`${item.media_type}-${item.id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex justify-center"
                  >
                    <MediaCard
                      item={{ ...item, media_type: item.media_type || "movie" }}
                      index={idx}
                    />
                  </motion.div>
                ))}
          </div>

          {!isLoading && items.length === 0 && !error && (
            <div className="text-center py-24 text-white/30">
              <p className="text-lg font-semibold mb-2">No titles found</p>
              <p className="text-sm">This franchise doesn&apos;t have any titles available yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
