"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MediaRow } from "@/components/MediaRow";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { Play, Star, Calendar, CheckCircle2, Loader2 } from "lucide-react";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer").then(m => m.VideoPlayer), { ssr: false });
import { cn, fetchJson, shuffleArray } from "@/lib/utils";
import { format } from "date-fns";

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string;
  vote_average?: number;
  runtime?: number;
}

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  episodes?: Episode[];
}

interface TvShow {
  id: number;
  name: string;
  tagline?: string;
  overview: string;
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  first_air_date?: string;
  number_of_seasons?: number;
  adult?: boolean;
  genres?: { id: number; name: string }[];
  seasons?: Season[];
  credits?: { cast: { id: number; name: string; character: string; profile_path?: string }[] };
  similar?: { results: any[] };
  recommendations?: { results: any[] };
}

export default function TvDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const { status } = useSession();
  const [show, setShow] = useState<TvShow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const selectedEpRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchShow = async () => {
      setError(null);
      try {
        const data = await fetchJson<TvShow>(`/api/tmdb/tv/${id}`);
        if (data.adult) {
          setError("This content is not available.");
          setShow(null);
          return;
        }
        // Preload backdrop immediately
        if (data.backdrop_path) {
          const link = document.createElement("link");
          link.rel = "preload"; link.as = "image";
          link.href = `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`;
          link.fetchPriority = "high";
          document.head.appendChild(link);
        }
        setShow(data);
        const firstSeason = data.seasons?.find((s: Season) => s.season_number > 0)?.season_number ?? 1;
        setSelectedSeason(prev => {
          if (prev > 1) return prev;
          const urlSeason = Number(searchParams.get("season") || "");
          return urlSeason > 0 ? urlSeason : firstSeason;
        });
      } catch (error) {
        setShow(null);
        setError(error instanceof Error ? error.message : "Failed to fetch show");
      } finally {
        setIsLoading(false);
      }
    };

    fetchShow();
  }, [id]);

  useEffect(() => {
    const autoPlay = searchParams.get("autoplay") === "1";
    const season = Number(searchParams.get("season") || "");
    const episode = Number(searchParams.get("episode") || "");

    if (season > 0) setSelectedSeason(season);
    if (episode > 0) setSelectedEpisode(episode);
    if (autoPlay) setIsPlaying(true);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedSeason) return;

    const fetchSeason = async () => {
      setSeasonLoading(true);
      try {
        const data = await fetchJson<Season>(`/api/tmdb/tv/${id}/season/${selectedSeason}`);
        setSeasonData(data);
      } catch (error) {
        setSeasonData(null);
        setError(error instanceof Error ? error.message : "Failed to fetch season");
      } finally {
        setSeasonLoading(false);
      }
    };

    fetchSeason();
  }, [id, selectedSeason]);

  const handleWatchEpisode = async (season: number, episodeNumber: number, episodeName?: string) => {
    setSelectedSeason(season);
    setSelectedEpisode(episodeNumber);

    if (status === "authenticated" && show) {
      await fetch("/api/watch-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: show.id,
          mediaType: "tv",
          title: show.name,
          posterPath: show.poster_path ?? null,
          backdropPath: show.backdrop_path ?? null,
          season,
          episode: episodeNumber,
          episodeName: episodeName ?? null,
        }),
      });
    }

    setIsPlaying(true);
  };

  // ── Scroll to player on play ──
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  // ── Scroll queue to selected episode ──
  useEffect(() => {
    if (!isPlaying || !selectedEpRef.current) return;
    selectedEpRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedEpisode, isPlaying]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="w-full h-[65vh] bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <Sidebar />
        <main className="md:pl-56 lg:pl-64">
          <div className="pt-0 px-6 md:px-12 max-w-screen-2xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80">
              <div className="text-lg font-bold text-white mb-1">Couldn&apos;t load this TV show</div>
              {error ? (
                <div className="text-sm text-white/50 break-words">{error}</div>
              ) : (
                <div className="text-sm text-white/50">Not found.</div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const backdropUrl = show.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}`
    : null;
  const posterUrl = show.poster_path
    ? `https://image.tmdb.org/t/p/w185${show.poster_path}`
    : null;

  const seasons = show.seasons?.filter((s) => s.season_number > 0) ?? [];
  const score = show.vote_average ?? 0;
  const scoreColor =
    score >= 7.5 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";
  const currentEpisode = seasonData?.episodes?.find((ep) => ep.episode_number === selectedEpisode);
  const nextEpisode = seasonData?.episodes?.find((ep) => ep.episode_number === selectedEpisode + 1);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 bleed-header">
      <div className="relative w-full h-[62vh] md:h-[72vh] overflow-hidden flex items-end">
        <div className="absolute inset-0 z-0">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={show.name}
              className="w-full h-full object-cover object-center md:object-top scale-[1.03]"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-card" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/30 to-transparent" />
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-background/50 to-transparent" />
        </div>

        <div className="relative z-10 pb-12 px-5 md:px-10 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-8 items-end">
          {posterUrl && (
            <img
              src={posterUrl}
              alt={show.name}
              className="hidden md:block w-48 lg:w-60 shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/10"
              fetchPriority="high"
              decoding="async"
              width={240}
              height={360}
            />
          )}

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="font-bold text-5xl md:text-7xl text-white leading-none tracking-wide mb-2">
                {show.name}
              </h1>
              {show.tagline && (
                <p className="text-primary/90 font-semibold italic text-base md:text-lg">
                  {show.tagline}
                </p>
              )}
            </div>

            <div
              className="flex flex-wrap items-center gap-3 text-sm"
            >
              {score > 0 && (
                <div className={`flex items-center gap-1.5 font-bold ${scoreColor}`}>
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-base">{score.toFixed(1)}</span>
                  <span className="text-white/30 font-normal text-xs">/ 10</span>
                </div>
              )}
              {show.first_air_date && (
                <span className="flex items-center gap-1.5 text-white/40 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(show.first_air_date), "yyyy")}
                </span>
              )}
              {show.number_of_seasons && (
                <span className="text-white/40 font-medium">
                  {show.number_of_seasons} Season{show.number_of_seasons > 1 ? "s" : ""}
                </span>
              )}
              <div className="flex flex-wrap gap-1.5 ml-1">
                {show.genres?.map((g) => (
                  <span
                    key={g.id}
                    className="px-2.5 py-0.5 bg-white/[0.07] border border-white/[0.08] rounded-full text-xs font-semibold text-white/70"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>

            <p
              className="text-white/65 text-base leading-relaxed max-w-2xl"
            >
              {show.overview}
            </p>

            <div>
              <button
                onClick={() => {
                  const ep = seasonData?.episodes?.find(e => e.episode_number === selectedEpisode) || seasonData?.episodes?.[0];
                  handleWatchEpisode(selectedSeason, ep?.episode_number ?? 1, ep?.name);
                }}
                className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                Watch S{selectedSeason} E{selectedEpisode}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-10 space-y-14">
      {isPlaying && (
        <div ref={playerRef} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div>
            <VideoPlayer
              key={`${id}-s${selectedSeason}-e${selectedEpisode}`}
              type="tv"
              id={id}
              season={selectedSeason}
              episode={selectedEpisode}
              title={`${show.name} - S${selectedSeason}E${selectedEpisode}`}
              startProgress={Number(searchParams.get("t") || 0)}
            />
            <div className="mt-3 text-sm text-white/60">
              <span className="font-bold text-white">Now Playing: </span>
              S{selectedSeason}E{selectedEpisode}
              {currentEpisode?.name ? ` - ${currentEpisode.name}` : ""}
            </div>
            {nextEpisode && (
              <button
                onClick={() => handleWatchEpisode(selectedSeason, nextEpisode.episode_number, nextEpisode.name)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/85 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Play Next: E{nextEpisode.episode_number}
              </button>
            )}
          </div>

          <aside className="w-full xl:w-80 shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col max-h-[60vh] xl:max-h-[70vh]">
            <div className="p-4 border-b border-white/[0.06] bg-white/[0.01]">
              <div className="text-sm font-bold text-white flex items-center justify-between">
                <span>Episode Queue</span>
                <span className="text-xs font-normal text-white/40">Season {selectedSeason}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
              {seasonLoading ? (
                <div className="flex items-center justify-center py-8 text-white/30 text-xs">Loading episodes...</div>
              ) : !seasonData?.episodes?.length ? (
                <div className="flex items-center justify-center py-8 text-white/30 text-xs">No episodes found</div>
              ) : (
                seasonData.episodes.map((episode) => (
                  <button
                    key={`queue-${episode.id}`}
                    ref={selectedEpisode === episode.episode_number ? selectedEpRef : undefined}
                    onClick={() => handleWatchEpisode(selectedSeason, episode.episode_number, episode.name)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                      selectedEpisode === episode.episode_number
                        ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/20"
                        : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <span className={`text-sm font-black w-10 shrink-0 ${selectedEpisode === episode.episode_number ? "text-white" : ""}`}>
                      E{episode.episode_number}
                    </span>
                    <span className="text-xs truncate flex-1 line-clamp-1">{episode.name}</span>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
        <section>
          <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-primary rounded-full shrink-0" />
              <h2 className="text-base font-bold text-white tracking-wide">Episodes</h2>
            </div>

            {seasons.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {seasons.map((s) => (
                  <button
                    key={s.season_number}
                    onClick={() => setSelectedSeason(s.season_number)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5",
                      selectedSeason === s.season_number
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border border-white/[0.06]"
                    )}
                  >
                    S{s.season_number}
                    {selectedSeason === s.season_number && seasonLoading && (
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

            {!seasonLoading && seasonData && (
              <div
                key={selectedSeason}
              >
                {seasonData.overview && (
                  <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-2xl italic">
                    {seasonData.overview}
                  </p>
                )}

                <div className="space-y-3">
                  {seasonData.episodes?.map((episode, i) => (
                    <div
                      key={episode.id}
                      onClick={() => handleWatchEpisode(selectedSeason, episode.episode_number, episode.name)}
                      className="group flex gap-4 p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12]"
                    >
                      <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05] shrink-0 self-start mt-1">
                        <span className="text-sm font-bold text-white/40">{episode.episode_number}</span>
                      </div>

                      <div className="w-36 md:w-48 shrink-0 aspect-video rounded-xl overflow-hidden bg-muted relative self-start">
                        {episode.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w185${episode.still_path}`}
                            alt={episode.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-card">
                            <Play className="w-6 h-6 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="font-bold text-sm leading-tight text-white">
                            <span className="sm:hidden text-white/40 mr-1.5">E{episode.episode_number}.</span>
                            {episode.name}
                          </h4>
                          {episode.vote_average && episode.vote_average > 0 && (
                            <div className="flex items-center gap-1 text-amber-400 shrink-0">
                              <Star className="w-3 h-3 fill-current" />
                              <span className="font-bold text-xs">{episode.vote_average.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        {episode.overview && (
                          <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{episode.overview}</p>
                        )}
                        {episode.runtime && <p className="text-white/30 text-xs mt-1.5">{episode.runtime} min</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </section>

        {show.credits?.cast && show.credits.cast.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-primary rounded-full" />
              <h2 className="text-base font-bold text-white tracking-wide">Cast</h2>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar">
              {show.credits.cast.slice(0, 16).map((person, i) => (
                <div
                  key={person.id}
                  className="w-[100px] shrink-0 text-center"
                >
                  <div className="aspect-[2/3] rounded-xl bg-card overflow-hidden mb-2.5 ring-1 ring-white/[0.06]">
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
                        <span className="text-muted-foreground/40 text-lg font-bold">{person.name?.[0]}</span>
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-xs text-white line-clamp-1 leading-tight">{person.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{person.character}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(() => {
          const recs = show.recommendations?.results || [];
          const similar = show.similar?.results || [];
          const seen = new Set<number>();
          const merged: any[] = [];
          for (const item of recs) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
          }
          for (const item of similar) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            merged.push(item);
            if (merged.length >= 20) break;
          }
          const filtered = merged.filter(item => item.poster_path || item.backdrop_path);
          if (filtered.length >= 6) {
            return (
              <div className="-mx-5 md:-mx-10">
                <MediaRow title="You May Like" items={shuffleArray(filtered)} />
              </div>
            );
          }
          return null;
        })()}
        </div>
      </main>
    </div>
  );
}
