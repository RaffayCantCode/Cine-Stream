"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MediaRow } from "@/components/MediaRow";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { Play, Star, Calendar, CheckCircle2, Loader2, Users } from "lucide-react";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer").then(m => m.VideoPlayer), { ssr: false });
import { CinematicHero } from "@/components/CinematicHero";
import { GridMediaCard } from "@/components/GridMediaCard";
import { cn, fetchJson, shuffleArray, getRecommendationReason } from "@/lib/utils";
import { format } from "date-fns";
import { CastRow } from "@/components/CastRow";

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
}

interface Season {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  poster_path?: string;
  episodes?: Episode[];
  videos?: { results: any[] };
}

interface TvShow {
  id: number;
  name: string;
  tagline?: string;
  overview: string;
  backdrop_path?: string;
  poster_path?: string;
  vote_average?: number;
  vote_count?: number;
  first_air_date?: string;
  number_of_seasons?: number;
  adult?: boolean;
  genres?: { id: number; name: string }[];
  seasons?: Season[];
  credits?: { cast: { id: number; name: string; character: string; profile_path?: string }[] };
  similar?: { results: any[] };
  recommendations?: { results: any[] };
  videos?: { results: any[] };
}

export default function TvClient() {
  const params = useParams();
  const id = Number(params.id);
  const { data: session, status } = useSession();
  const [show, setShow] = useState<TvShow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [playingSeason, setPlayingSeason] = useState<number>(1);
  const [playingEpisode, setPlayingEpisode] = useState<number>(1);
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  useEffect(() => {
    if (status === "loading" || isStateLoaded) return;
    let initSeason = 1;
    let initEp = 1;
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSeason = searchParams.get("season");
      const urlEp = searchParams.get("episode");
      
      if (urlSeason || urlEp) {
        if (urlSeason && Number(urlSeason) > 0) initSeason = Number(urlSeason);
        if (urlEp && Number(urlEp) > 0) initEp = Number(urlEp);
      } else {
        try {
          const userId = session?.user?.id || "guest";
          const saved = localStorage.getItem(`sv_tv_state_${userId}_${id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.season) initSeason = parsed.season;
            if (parsed?.episode) initEp = parsed.episode;
          }
        } catch {}
      }
    }
    setSelectedSeason(initSeason);
    setPlayingSeason(initSeason);
    setPlayingEpisode(initEp);
    setIsStateLoaded(true);
  }, [id, status, session, isStateLoaded]);

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
          // If we haven't loaded state yet, or we're on season 1 and there's no explicitly requested season,
          // then default to the first available season (often >1 for anime/some shows).
          if (prev === 1 && firstSeason > 1 && typeof window !== "undefined" && !new URLSearchParams(window.location.search).get("season")) {
            return firstSeason;
          }
          return prev;
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

  const autoPlayHandledRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !show || status === "loading") return;
    if (autoPlayHandledRef.current) return;
    
    autoPlayHandledRef.current = true;
    const searchParams = new URLSearchParams(window.location.search);
    const autoPlay = searchParams.get("autoplay") === "1";
    const season = Number(searchParams.get("season"));
    const episode = Number(searchParams.get("episode"));

    if (season > 0) { setSelectedSeason(season); setPlayingSeason(season); }
    if (episode > 0) setPlayingEpisode(episode);

    if (autoPlay) {
      const targetSeason = season > 0 ? season : 1;
      const targetEpisode = episode > 0 ? episode : 1;
      if (status === "authenticated") {
        fetch("/api/watch-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: show.id,
            mediaType: "tv",
            title: show.name,
            posterPath: show.poster_path ?? null,
            backdropPath: show.backdrop_path ?? null,
            season: targetSeason,
            episode: targetEpisode,
          }),
        }).catch(() => {});
      }
      setIsPlaying(true);
    }
  }, [show, status]);

  // Persist state
  useEffect(() => {
    if (typeof window !== "undefined" && status !== "loading") {
      try {
        const userId = session?.user?.id || "guest";
        localStorage.setItem(`sv_tv_state_${userId}_${id}`, JSON.stringify({ season: playingSeason, episode: playingEpisode }));
      } catch {}
    }
  }, [id, playingSeason, playingEpisode, status, session]);

  useEffect(() => {
    if (!selectedSeason) return;
    let isActive = true;

    const fetchSeason = async () => {
      setSeasonLoading(true);
      try {
        const data = await fetchJson<Season>(`/api/tmdb/tv/${id}/season/${selectedSeason}`);
        if (isActive) setSeasonData(data);
      } catch (error) {
        if (isActive) {
          setSeasonData(null);
          setError(error instanceof Error ? error.message : "Failed to fetch season");
        }
      } finally {
        if (isActive) setSeasonLoading(false);
      }
    };

    fetchSeason();
    return () => { isActive = false; };
  }, [id, selectedSeason]);

  const handleWatchEpisode = async (season: number, episodeNumber: number, episodeName?: string) => {
    setSelectedSeason(season);
    setPlayingSeason(season);
    setPlayingEpisode(episodeNumber);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("season", season.toString());
      url.searchParams.set("episode", episodeNumber.toString());
      window.history.replaceState({}, "", url.toString());
    }

    if (status === "authenticated" && show) {
      // Use the specific season's poster if available, otherwise fallback to the show's main poster
      const actualPoster = season === selectedSeason && seasonData?.poster_path 
        ? seasonData.poster_path 
        : show.poster_path;

      await fetch("/api/watch-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: show.id,
          mediaType: "tv",
          title: show.name,
          posterPath: actualPoster ?? null,
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
    if (!isPlaying || !selectedEpRef.current || playingSeason !== selectedSeason) return;
    selectedEpRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [playingEpisode, playingSeason, selectedSeason, isPlaying]);

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
    ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
    : null;

  const seasons = show.seasons?.filter((s) => s.season_number > 0) ?? [];
  const score = show.vote_average ?? 0;
  const scoreColor =
    score >= 7.5 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";
  const isPlayingSeasonLoaded = playingSeason === selectedSeason;
  const currentEpisode = isPlayingSeasonLoaded ? seasonData?.episodes?.find((ep) => ep.episode_number === playingEpisode) : null;
  const nextEpisode = isPlayingSeasonLoaded ? seasonData?.episodes?.find((ep) => ep.episode_number === playingEpisode + 1) : null;

  const seasonTrailerId = seasonData?.videos?.results?.find((v: any) => v.type === "Trailer" && v.site === "YouTube")?.key;
  const mainTrailerId = show.videos?.results?.find((v: any) => v.type === "Trailer" && v.site === "YouTube")?.key;
  const trailerId = seasonTrailerId || mainTrailerId;

  const handleAutoPlayNext = () => {
    if (playingSeason === selectedSeason && seasonData?.episodes) {
      const next = seasonData.episodes.find(ep => ep.episode_number === playingEpisode + 1);
      if (next) {
        handleWatchEpisode(playingSeason, next.episode_number, next.name);
        return;
      }
    } else if (playingSeason !== selectedSeason) {
      // If they navigated to another season tab while watching, we just boldly increment
      handleWatchEpisode(playingSeason, playingEpisode + 1);
      return;
    }
    
    // If we reached the end of the season, try next season
    const currentSeasonIndex = seasons.findIndex(s => s.season_number === playingSeason);
    if (currentSeasonIndex !== -1 && currentSeasonIndex < seasons.length - 1) {
      const nextSeasonNum = seasons[currentSeasonIndex + 1].season_number;
      handleWatchEpisode(nextSeasonNum, 1);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64 bleed-header">
      <CinematicHero
        backdropPath={show.backdrop_path || show.poster_path}
        trailerId={seasonTrailerId || mainTrailerId}
        fallbackTrailerIds={seasonTrailerId && mainTrailerId ? [mainTrailerId] : undefined}
        title={show.name}
        theme="tv"
      >
        <div className="pb-12 px-5 md:px-10 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-8 items-end">
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
              {score > 0 && show.vote_count && show.vote_count > 20 && (
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

            <div className="flex items-center flex-wrap gap-4 w-full">
              <button
                onClick={() => {
                  const ep = playingSeason === selectedSeason 
                    ? (seasonData?.episodes?.find(e => e.episode_number === playingEpisode) || seasonData?.episodes?.[0])
                    : null;
                  handleWatchEpisode(playingSeason, playingEpisode, ep?.name);
                }}
                className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                Watch S{playingSeason} E{playingEpisode}
              </button>
            </div>
          </div>
        </div>
      </CinematicHero>

      <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-10 space-y-14">
      {isPlaying && (
        <div ref={playerRef} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start select-none">
          <div>
            <VideoPlayer
              type="tv"
              id={id}
              season={playingSeason}
              episode={playingEpisode}
              title={`${show.name} - S${playingSeason}E${playingEpisode}`}
              startProgress={typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get("t") || 0) : 0}
              onEpisodeChange={(s, e) => handleWatchEpisode(s, e)}
              onVideoEnd={handleAutoPlayNext}
            />
            <div className="mt-3 text-sm text-white/60">
              <span className="font-bold text-white">Now Playing: </span>
              S{playingSeason}E{playingEpisode}
              {currentEpisode?.name ? ` - ${currentEpisode.name}` : ""}
            </div>
            {nextEpisode && (
              <button
                onClick={() => handleWatchEpisode(playingSeason, nextEpisode.episode_number, nextEpisode.name)}
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
                    ref={playingSeason === selectedSeason && playingEpisode === episode.episode_number ? selectedEpRef : undefined}
                    onClick={() => handleWatchEpisode(selectedSeason, episode.episode_number, episode.name)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                      playingSeason === selectedSeason && playingEpisode === episode.episode_number
                        ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/20"
                        : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <span className={`text-sm font-black w-10 shrink-0 ${playingSeason === selectedSeason && playingEpisode === episode.episode_number ? "text-white" : ""}`}>
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
                          {episode.vote_average && episode.vote_average > 0 && episode.vote_count && episode.vote_count > 5 ? (
                            <div className="flex items-center gap-1 text-amber-400 shrink-0">
                              <Star className="w-3 h-3 fill-current" />
                              <span className="font-bold text-xs">{episode.vote_average.toFixed(1)}</span>
                            </div>
                          ) : null}
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

        {(((show.credits as any)?.cast && (show.credits as any).cast.length > 0) || ((show.credits as any)?.crew && (show.credits as any).crew.length > 0)) && (
          <CastRow cast={(show.credits as any).cast || []} crew={(show.credits as any).crew || []} />
        )}

        {(() => {
          const recs = show.recommendations?.results || [];
          const similar = show.similar?.results || [];
          const seen = new Set<number>();
          const merged: any[] = [];
          for (const item of recs) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            item.reason = getRecommendationReason(show.genres?.map((g: any) => g.id) || [], item.genre_ids || []);
            merged.push(item);
          }
          for (const item of similar) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            item.reason = getRecommendationReason(show.genres?.map((g: any) => g.id) || [], item.genre_ids || []);
            merged.push(item);
            if (merged.length >= 20) break;
          }
          const filtered = merged.filter(item => item.poster_path || item.backdrop_path);
          if (filtered.length >= 6) {
            return (
              <section className="pt-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  <h2 className="text-base font-bold text-white tracking-wide">You May Like</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                  {filtered.slice(0, 18).map((item: any, i: number) => (
                    <GridMediaCard key={item.id} item={item} index={i} />
                  ))}
                </div>
              </section>
            );
          }
          return null;
        })()}
        </div>
      </main>
    </div>
  );
}
