import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useGetTvShow, useGetTvSeason, getGetTvSeasonQueryKey, useAddWatchHistory, getGetWatchHistoryQueryKey } from "@workspace/api-client-react";
import { Navigation } from "@/components/Navigation";
import { MediaRow } from "@/components/MediaRow";
import { Play, Star, Calendar, ExternalLink, Clock, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";

export function TvDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: show, isLoading: showLoading } = useGetTvShow(id);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [playingEp, setPlayingEp] = useState<{ season: number; episode: number } | null>(null);

  const { data: seasonData, isLoading: seasonLoading } = useGetTvSeason(id, selectedSeason, {
    query: {
      enabled: !!id && !!selectedSeason,
      queryKey: getGetTvSeasonQueryKey(id, selectedSeason),
    },
  });

  const { mutate: addWatch } = useAddWatchHistory();

  useEffect(() => {
    if (show) {
      const first = show.seasons?.find(s => s.season_number > 0)?.season_number ?? 1;
      setSelectedSeason(first);
    }
  }, [show?.id]);

  const handleWatchEpisode = (season: number, episodeNumber: number, episodeName?: string) => {
    setPlayingEp({ season, episode: episodeNumber });

    if (isAuthenticated && show) {
      addWatch(
        {
          data: {
            mediaId: show.id,
            mediaType: "tv",
            title: show.name,
            posterPath: show.poster_path ?? null,
            backdropPath: show.backdrop_path ?? null,
            season,
            episode: episodeNumber,
            episodeName: episodeName ?? null,
          },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetWatchHistoryQueryKey() });
          },
        }
      );
    }

    const url = `${window.location.origin}/watch/tv/${id}/${season}/${episodeNumber}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (showLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="w-full h-[65vh] bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!show) return null;

  const backdropUrl = show.backdrop_path
    ? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
    : null;
  const posterUrl = show.poster_path
    ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
    : null;

  const seasons = show.seasons?.filter(s => s.season_number > 0) ?? [];
  const score = show.vote_average ?? 0;
  const scoreColor =
    score >= 7.5 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Navigation />

      {/* Hero */}
      <div className="relative w-full h-[62vh] md:h-[72vh] overflow-hidden flex items-end">
        <div className="absolute inset-0 z-0">
          {backdropUrl ? (
            <motion.img
              src={backdropUrl}
              alt={show.name}
              className="w-full h-full object-cover object-top scale-[1.03]"
              initial={{ opacity: 0, scale: 1.07 }}
              animate={{ opacity: 1, scale: 1.03 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
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
            <motion.img
              src={posterUrl}
              alt={show.name}
              className="hidden md:block w-48 lg:w-60 shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            />
          )}

          <div className="flex-1 space-y-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
              <h1 className="font-display text-5xl md:text-7xl text-white leading-none tracking-wider mb-2">
                {show.name}
              </h1>
              {show.tagline && (
                <p className="text-primary/90 font-semibold italic text-base md:text-lg">{show.tagline}</p>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.5 }} className="flex flex-wrap items-center gap-3 text-sm">
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
                {show.genres?.map(g => (
                  <span key={g.id} className="px-2.5 py-0.5 bg-white/[0.07] border border-white/[0.08] rounded-full text-xs font-semibold text-white/70">
                    {g.name}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="text-white/65 text-base leading-relaxed max-w-2xl">
              {show.overview}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
              <button
                onClick={() => {
                  const ep = seasonData?.episodes?.[0];
                  handleWatchEpisode(selectedSeason, ep?.episode_number ?? 1, ep?.name);
                }}
                className="group flex items-center gap-2.5 bg-primary hover:bg-primary/85 active:scale-95 text-white font-bold px-8 py-4 rounded-xl text-sm transition-all duration-200 shadow-xl shadow-primary/25"
                data-testid="btn-watch-show"
              >
                <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
                Watch S{selectedSeason} E1
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="max-w-screen-2xl mx-auto px-5 md:px-10 mt-10 space-y-14">
        <section>
          {/* Season tabs */}
          <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-primary rounded-full shrink-0" />
              <h2 className="text-base font-bold text-white tracking-wide">Episodes</h2>
            </div>

            {seasons.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {seasons.map(s => (
                  <button
                    key={s.season_number}
                    onClick={() => setSelectedSeason(s.season_number)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                      selectedSeason === s.season_number
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white border border-white/[0.06]"
                    )}
                    data-testid={`btn-season-${s.season_number}`}
                  >
                    S{s.season_number}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Season overview + episodes */}
          <AnimatePresence mode="wait">
            {!seasonLoading && seasonData && (
              <motion.div
                key={selectedSeason}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {seasonData.overview && (
                  <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-2xl italic">
                    {seasonData.overview}
                  </p>
                )}

                {/* Episodes list */}
                <div className="space-y-3">
                  {seasonData.episodes?.map((episode, i) => {
                    const isPlaying =
                      playingEp?.season === selectedSeason &&
                      playingEp?.episode === episode.episode_number;

                    return (
                      <motion.div
                        key={episode.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025, duration: 0.3 }}
                        onClick={() => handleWatchEpisode(selectedSeason, episode.episode_number, episode.name)}
                        className={cn(
                          "group flex gap-4 p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer",
                          isPlaying
                            ? "episode-playing bg-primary/[0.08] border-primary/40"
                            : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12]"
                        )}
                        data-testid={`episode-${episode.episode_number}`}
                      >
                        {/* Episode number */}
                        <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-white/[0.05] shrink-0 self-start mt-1">
                          <span className={cn("text-sm font-bold", isPlaying ? "text-primary" : "text-white/40")}>
                            {episode.episode_number}
                          </span>
                        </div>

                        {/* Thumbnail */}
                        <div className="w-36 md:w-48 shrink-0 aspect-video rounded-xl overflow-hidden bg-muted relative self-start">
                          {episode.still_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                              alt={episode.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-card">
                              <Play className="w-6 h-6 text-white/20" />
                            </div>
                          )}
                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                            </div>
                          </div>
                          {isPlaying && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="w-5 h-5 text-primary fill-primary/20" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className={cn("font-bold text-sm leading-tight", isPlaying ? "text-primary" : "text-white")}>
                              <span className="sm:hidden text-white/40 mr-1.5">E{episode.episode_number}.</span>
                              {episode.name}
                            </h4>
                            <div className="flex items-center gap-2 shrink-0">
                              {episode.vote_average && episode.vote_average > 0 ? (
                                <span className="flex items-center gap-0.5 text-xs text-amber-400/80 font-semibold">
                                  <Star className="w-3 h-3 fill-current" />
                                  {episode.vote_average.toFixed(1)}
                                </span>
                              ) : null}
                              {episode.runtime ? (
                                <span className="flex items-center gap-0.5 text-xs text-white/30 font-medium">
                                  <Clock className="w-3 h-3" />
                                  {episode.runtime}m
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {episode.air_date && (
                            <p className="text-xs text-white/30 font-medium mb-1.5">
                              {format(new Date(episode.air_date), "MMM d, yyyy")}
                            </p>
                          )}
                          <p className="text-sm text-white/45 line-clamp-2 leading-relaxed">
                            {episode.overview || "No description available."}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading state */}
          {seasonLoading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl bg-muted/30" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          )}
        </section>

        {/* Cast */}
        {show.credits?.cast && show.credits.cast.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-primary rounded-full" />
              <h2 className="text-base font-bold text-white tracking-wide">Cast</h2>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar">
              {show.credits.cast.slice(0, 16).map((person, i) => (
                <motion.div
                  key={person.id}
                  className="w-[100px] shrink-0 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.35 }}
                >
                  <div className="aspect-[2/3] rounded-xl bg-card overflow-hidden mb-2 ring-1 ring-white/[0.06]">
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <span className="text-muted-foreground/40 text-lg font-bold">{person.name?.[0]}</span>
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-xs text-white line-clamp-1 leading-tight">{person.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{person.character}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Similar */}
        {show.similar?.results && show.similar.results.length > 0 && (
          <div className="-mx-5 md:-mx-10">
            <MediaRow title="More Like This" items={show.similar.results} />
          </div>
        )}
      </div>
    </div>
  );
}
