"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { AnimePlayer } from "@/components/AnimePlayer";
import { fetchJson } from "@/lib/utils";
import { Play, Star, ArrowLeft, Tv2, Clock, Globe } from "lucide-react";
import { motion } from "framer-motion";

interface AnimeDetail {
  id: string;
  animeId: string;
  name: string;
  jname?: string | null;
  poster: string;
  description: string;
  type?: string | null;
  rating?: string | null;
  episodes: { sub: number | null; dub: number | null };
  duration?: string | null;
  premiered?: string | null;
  status?: string | null;
  score?: string | null;
  genres?: string[];
  studios?: string[];
}

interface Episode {
  episodeId: string;
  episodeNum: number;
  title?: string;
  src?: string;
  sources?: { name: string; url: string }[];
  isFiller?: boolean;
}

interface EpisodeSource {
  src: string;
  name: string;
}


export default function AnimeDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodeSources, setEpisodeSources] = useState<EpisodeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [watchMode, setWatchMode] = useState<"sub" | "dub">("sub");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJson<{ success: boolean; data: { anime: AnimeDetail } }>(
          `/api/anime/${id}`
        );
        if (data.success && data.data?.anime) {
          setAnime(data.data.anime);
        } else {
          throw new Error("Anime not found");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load anime");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const loadEps = async () => {
      setEpisodesLoading(true);
      try {
        const data = await fetchJson<{ success: boolean; data: { episodes: Episode[]; totalEpisodes: number } }>(
          `/api/anime/${id}/episodes`
        );
        if (data.success && data.data?.episodes) {
          setEpisodes(data.data.episodes);
          if (data.data.episodes.length > 0) {
            setSelectedEp(data.data.episodes[0]);
          }
        }
      } catch {
        // Episodes failed silently
      } finally {
        setEpisodesLoading(false);
      }
    };
    loadEps();
  }, [id]);

  useEffect(() => {
    if (!selectedEp) {
      setEpisodeSources([]);
      return;
    }

    if (selectedEp.sources && selectedEp.sources.length > 0) {
      setEpisodeSources(
        selectedEp.sources.map((source) => ({
          src: source.url,
          name: source.name,
        }))
      );
      return;
    }

    if (selectedEp.src) {
      setEpisodeSources([{ src: selectedEp.src, name: "AniPub" }]);
      return;
    }

    setEpisodeSources([]);
  }, [selectedEp]);


  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 pt-0">
      {isLoading ? (
        <div className="pt-0 px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="w-full h-[60vh] rounded-2xl bg-muted/50 animate-pulse" />
        </div>
      ) : error ? (
        <div className="pt-0 px-6 md:px-12 max-w-screen-2xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <div className="text-2xl mb-2">😔</div>
            <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load anime</div>
            <div className="text-sm text-white/50">{error}</div>
          </div>
        </div>
      ) : anime ? (
        <>
          {/* Hero backdrop */}
          <div className="relative w-full h-[55vh] md:h-[65vh] flex items-end overflow-hidden">
            <div className="absolute inset-0">
              <img
                src={anime.poster}
                alt={anime.name}
                className="w-full h-full object-cover object-top scale-105 blur-sm brightness-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
            </div>

            <div className="relative z-10 pb-10 md:pb-16 px-5 md:px-12 flex items-end gap-6 md:gap-10 max-w-screen-2xl mx-auto w-full">
              {/* Poster */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="hidden md:block shrink-0 w-40 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
              >
                <img src={anime.poster} alt={anime.name} className="w-full h-full object-cover" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex flex-col gap-3 max-w-2xl"
              >
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-violet-600/90 text-white text-[10px] font-extrabold tracking-widest px-2.5 py-1 rounded-full uppercase">
                    🇯🇵 Anime · JP Sub/Dub
                  </span>
                  {anime.type && (
                    <span className="bg-white/10 text-white/70 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">
                      {anime.type}
                    </span>
                  )}
                  {anime.rating && (
                    <span className="bg-white/10 text-white/70 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">
                      {anime.rating}
                    </span>
                  )}
                </div>

                <h1 className="font-bold text-3xl md:text-5xl text-white leading-tight">
                  {anime.name}
                </h1>
                {anime.jname && (
                  <p className="text-white/40 text-sm md:text-base font-medium">{anime.jname}</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 flex-wrap text-xs text-white/50">
                  {anime.score && (
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {anime.score}
                    </span>
                  )}
                  {anime.episodes.sub !== null && (
                    <span className="flex items-center gap-1">
                      <Tv2 className="w-3.5 h-3.5" />
                      {anime.episodes.sub} eps (sub)
                    </span>
                  )}
                  {anime.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {anime.duration}
                    </span>
                  )}
                  {anime.status && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {anime.status}
                    </span>
                  )}
                </div>

                {/* Genres */}
                {anime.genres && anime.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {anime.genres.slice(0, 6).map((g) => (
                      <span key={g} className="text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full font-semibold">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-white/60 text-sm leading-relaxed line-clamp-3 max-w-xl">
                  {anime.description}
                </p>
              </motion.div>
            </div>
          </div>

          {/* Content below */}
          <div className="px-5 md:px-12 max-w-screen-2xl mx-auto mt-6 space-y-8">
            <Link
              href="/anime"
              className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Anime
            </Link>

            {/* Player + Episodes */}
            {!episodesLoading && episodes.length > 0 && (
              <div className="space-y-6">
                {/* Watch mode toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">Watch in:</span>
                  <div className="flex gap-1 bg-white/[0.05] rounded-xl p-1">
                    {(["sub", "dub"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setWatchMode(mode)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                          watchMode === mode
                            ? "bg-violet-600 text-white shadow-md"
                            : "text-white/40 hover:text-white"
                        }`}
                      >
                        {mode === "sub" ? "🇯🇵 Japanese Sub" : "🎤 English Dub"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Anime Player with iframe embeds */}
                {selectedEp && (
                  <motion.div
                    key={`${selectedEp.episodeNum}-${watchMode}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AnimePlayer
                      animeId={id}
                      animeTitle={anime.name}
                      episode={selectedEp.episodeNum}
                      episodeSources={episodeSources}
                    />
                  </motion.div>
                )}

                {selectedEp && (
                  <div className="text-sm text-white/60">
                    <span className="font-bold text-white">Episode {selectedEp.episodeNum}</span>
                    {selectedEp.title && ` — ${selectedEp.title}`}
                    {selectedEp.isFiller && (
                      <span className="ml-2 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded font-bold uppercase">Filler</span>
                    )}
                  </div>
                )}

                {/* Episode list */}
                <div>
                  <h2 className="text-lg font-bold text-white mb-4">Episodes</h2>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                    {episodes.map((ep) => (
                      <button
                        key={ep.episodeId}
                        onClick={() => setSelectedEp(ep)}
                        className={`aspect-square rounded-lg text-sm font-bold transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                          selectedEp?.episodeId === ep.episodeId
                            ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30 scale-105"
                            : "bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white"
                        }`}
                      >
                        <span>{ep.episodeNum}</span>
                        {ep.isFiller && (
                          <span className="text-[7px] font-bold text-amber-400 uppercase tracking-wider leading-none">filler</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {episodesLoading && (
              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
      </main>
    </div>
  );
}
