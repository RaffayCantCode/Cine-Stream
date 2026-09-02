"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MediaRow } from "@/components/MediaRow";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { Play, Star, Calendar, CheckCircle2, Loader2, Users, Film, Layers } from "lucide-react";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer").then(m => m.VideoPlayer), { ssr: false });
import { CinematicHero, useCinematicHero } from "@/components/CinematicHero";
import { useMediaLogo } from "@/components/MediaLogo";

function TvHeroTrailerButton() {
  const { playTrailer, hasTrailer } = useCinematicHero();
  if (!hasTrailer) return null;
  return (
    <button
      onClick={playTrailer}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold px-6 py-4 rounded-xl text-sm transition-all border border-white/15 backdrop-blur-md shadow-lg"
    >
      <Film className="w-4 h-4 text-emerald-400 shrink-0" />
      <span>Trailer</span>
    </button>
  );
}
import { GridMediaCard } from "@/components/GridMediaCard";
import { EpisodeViewSelector, EpisodeListView, EpisodeGridView, EpisodeChunkBar, type EpisodeItem, type EpisodeViewMode } from "@/components/episodes/EpisodeViews";
import { cn, fetchJson, shuffleArray, getRecommendationReason } from "@/lib/utils";
import { isEpisodeUpcoming, isWithinUpcomingDays } from "@/lib/episode-availability";
import { format } from "date-fns";
import { CastRow } from "@/components/CastRow";
import { WatchlistButton } from "@/components/WatchlistButton";
import { usePageContentReady } from "@/lib/pageLoad";

const TV_CHUNK_SIZE = 10;

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string;
  air_date?: string;
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
  status?: string;
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
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { data: session, status } = useSession();
  const [show, setShow] = useState<TvShow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [playingSeason, setPlayingSeason] = useState<number>(1);
  const [playingEpisode, setPlayingEpisode] = useState<number>(1);
  const [episodeChunk, setEpisodeChunk] = useState<number>(0);
  const [hasActiveProgress, setHasActiveProgress] = useState(false);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [episodeNotice, setEpisodeNotice] = useState<string | null>(null);
  const [tvViewMode, setTvViewMode] = useState<EpisodeViewMode>("list");
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("cinestream_tv_theater_mode") === "true";
      } catch {}
    }
    return false;
  });
  const { logoUrl } = useMediaLogo(id, "tv", show?.name);
  const fallbackLogo = useMemo(() => {
    const logos = (show as any)?.images?.logos;
    if (!logos || !Array.isArray(logos) || logos.length === 0) return null;
    const englishLogo = logos.find((l: any) => l.iso_639_1 === "en" && l.file_path);
    const nullLangLogo = logos.find((l: any) => (!l.iso_639_1 || l.iso_639_1 === "null") && l.file_path);
    const jaLogo = logos.find((l: any) => l.iso_639_1 === "ja" && l.file_path);
    const chosen = englishLogo || nullLangLogo || jaLogo || logos[0];
    return chosen?.file_path ? `https://image.tmdb.org/t/p/w500${chosen.file_path}` : null;
  }, [show]);
  const activeLogo = logoUrl || fallbackLogo;
  usePageContentReady(!isLoading);

  const handleToggleTheater = () => {
    setIsTheaterMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem("cinestream_tv_theater_mode", String(next));
      } catch {}
      return next;
    });
  };

  const handleTvViewChange = (view: EpisodeViewMode) => {
    setTvViewMode(view);
  };

  useEffect(() => {
    setEpisodeChunk(0);
  }, [selectedSeason]);

  useEffect(() => {
    if (playingSeason === selectedSeason && playingEpisode) {
      const targetChunk = Math.floor((playingEpisode - 1) / TV_CHUNK_SIZE);
      setEpisodeChunk(targetChunk);
    }
  }, [playingSeason, selectedSeason, playingEpisode]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [id]);

  useEffect(() => {
    if (status === "loading" || isStateLoaded) return;
    let initSeason = 1;
    let initEp = 1;
    let hasActiveShow = false;
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const urlSeason = searchParams.get("season");
      const urlEp = searchParams.get("episode");
      const isAutoPlay = searchParams.get("autoplay") === "1";
      
      if (isAutoPlay || (urlSeason && urlEp)) {
        if (urlSeason && Number(urlSeason) > 0) initSeason = Number(urlSeason);
        if (urlEp && Number(urlEp) > 0) initEp = Number(urlEp);
        hasActiveShow = true;
      } else {
        try {
          const activeShowRaw = localStorage.getItem("cinestream_active_tv_show");
          if (activeShowRaw) {
            const activeShow = JSON.parse(activeShowRaw);
            if (String(activeShow?.id) === String(id)) {
              if (activeShow?.season) initSeason = activeShow.season;
              if (activeShow?.episode) initEp = activeShow.episode;
              hasActiveShow = true;
            }
          }
        } catch {}
      }
    }
    setSelectedSeason(initSeason);
    setPlayingSeason(initSeason);
    setPlayingEpisode(initEp);
    setHasActiveProgress(hasActiveShow);
    setIsStateLoaded(true);
  }, [id, status, session, isStateLoaded]);

  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const selectedEpRef = useRef<HTMLButtonElement>(null);

  const isOngoingShow = (statusValue?: string | null) => {
    const normalized = (statusValue || "").toLowerCase();
    return Boolean(normalized) && !["ended", "canceled", "cancelled"].includes(normalized);
  };

  const isUpcomingEpisode = (episode?: Episode | null) => {
    if (!episode || !isOngoingShow(show?.status)) return false;
    if (isEpisodeUpcoming(episode.air_date)) return true;
    if (!seasonData?.episodes) return false;

    const eps = seasonData.episodes;
    const epIdx = eps.findIndex(e => e.id === episode.id || e.episode_number === episode.episode_number);
    if (epIdx <= 0) return false;

    for (let i = 0; i < epIdx; i++) {
      if (isEpisodeUpcoming(eps[i].air_date)) return true;
    }
    return false;
  };

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
      setHasActiveProgress(true);
      try {
        localStorage.setItem("cinestream_active_tv_show", JSON.stringify({
          id: String(show.id),
          season: targetSeason,
          episode: targetEpisode,
        }));
      } catch {}

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
  }, [show]);

  // Persist state
  useEffect(() => {
    if (typeof window !== "undefined" && status !== "loading" && isStateLoaded && hasActiveProgress && show) {
      try {
        localStorage.setItem("cinestream_active_tv_show", JSON.stringify({
          id: String(show.id),
          season: playingSeason,
          episode: playingEpisode,
        }));
      } catch {}
    }
  }, [id, show, playingSeason, playingEpisode, status, isStateLoaded, hasActiveProgress]);

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
    const targetEpisode = season === selectedSeason
      ? seasonData?.episodes?.find((episode) => episode.episode_number === episodeNumber)
      : null;

    if (isUpcomingEpisode(targetEpisode)) {
      setSelectedSeason(season);
      setEpisodeNotice(`Episode ${episodeNumber} hasn't been released yet.`);
      return;
    }

    setEpisodeNotice(null);
    setSelectedSeason(season);
    setPlayingSeason(season);
    setPlayingEpisode(episodeNumber);
    setHasActiveProgress(true);

    if (status === "authenticated" && show) {
      const actualPoster = season === selectedSeason && seasonData?.poster_path 
        ? seasonData.poster_path 
        : show.poster_path;

      fetch("/api/watch-history", {
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
      }).catch(() => {});
    }

    router.push(`/watch/tv/${id}/${season}/${episodeNumber}`);
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
    if (!isPlaying || seasonLoading || !selectedEpRef.current || playingSeason !== selectedSeason) return;
    const timer = setTimeout(() => {
      selectedEpRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(timer);
  }, [playingEpisode, playingSeason, selectedSeason, isPlaying, seasonLoading, seasonData?.episodes?.length]);

  useEffect(() => {
    if (!isPlaying || seasonLoading || playingSeason !== selectedSeason) return;
    const activeEpisode = seasonData?.episodes?.find((episode) => episode.episode_number === playingEpisode);
    if (!isUpcomingEpisode(activeEpisode)) return;

    setIsPlaying(false);
    setEpisodeNotice(`Episode ${playingEpisode} hasn't been released yet.`);
  }, [isPlaying, seasonLoading, playingSeason, playingEpisode, selectedSeason, seasonData?.episodes, show?.status]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="w-full h-[65vh] bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!show || (show as any).isHidden) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <Sidebar />
        <main className="w-full">
          <div className="pt-24 px-6 md:px-12 w-full">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-white/80 max-w-lg mx-auto text-center space-y-3">
              <div className="text-xl font-bold text-white">Title Unavailable</div>
              <p className="text-sm text-zinc-400">
                This TV show is currently not available to view. Please check back later or browse other titles.
              </p>
              <div className="pt-2">
                <Link href="/" className="inline-flex px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow">
                  Browse Catalog
                </Link>
              </div>
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
  const upcomingThisWeek = seasonData?.episodes
    ?.filter((episode) => isUpcomingEpisode(episode) && isWithinUpcomingDays(episode.air_date, 7))
    ?.sort((a, b) => new Date(a.air_date || "").getTime() - new Date(b.air_date || "").getTime())?.[0] || null;

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

  // ── Normalize TV episodes into the shared EpisodeItem shape ──────────────
  const episodeToItem = (episode: Episode): EpisodeItem => {
    const isWatching = (hasActiveProgress || isPlaying) && playingSeason === selectedSeason && playingEpisode === episode.episode_number;
    const isUpcoming = isUpcomingEpisode(episode);
    return {
      key: String(episode.id),
      number: episode.episode_number,
      title: episode.name,
      description: episode.overview || null,
      thumbnail: episode.still_path ? `https://image.tmdb.org/t/p/w780${episode.still_path}` : null,
      airDate: episode.air_date || null,
      runtime: episode.runtime || null,
      rating: episode.vote_average || null,
      hasRating: Boolean(episode.vote_average && episode.vote_average > 0 && episode.vote_count && episode.vote_count > 5),
      isFiller: false,
      isReleased: !isUpcoming,
      isSelected: isWatching,
      isPlaying: isPlaying && isWatching,
      portrait: false,
      onClick: () => handleWatchEpisode(selectedSeason, episode.episode_number, episode.name),
    };
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="w-full bleed-header select-none">
      <CinematicHero
        backdropPath={show.backdrop_path || show.poster_path}
        trailerId={seasonTrailerId || mainTrailerId}
        fallbackTrailerIds={seasonTrailerId && mainTrailerId ? [mainTrailerId] : undefined}
        title={show.name}
        theme="tv"
      >
        <div className="pb-4 md:pb-8 px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 w-full flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
          {posterUrl && (
            <img
              src={posterUrl}
              alt={show.name}
              className="hidden md:block w-44 sm:w-48 md:w-52 lg:w-60 shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/10 aspect-[2/3] object-cover"
              fetchPriority="high"
              decoding="async"
              width={320}
              height={480}
            />
          )}

          <div className="flex-1 space-y-3 sm:space-y-3.5 w-full">
            <div>
              {activeLogo ? (
                <div className="mb-4 sm:mb-5 max-w-[280px] sm:max-w-[340px] md:max-w-[420px] lg:max-w-[480px]">
                  <img
                    src={activeLogo}
                    alt={show.name}
                    className="max-h-20 sm:max-h-24 md:max-h-28 lg:max-h-32 w-auto object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]"
                  />
                </div>
              ) : (
                <h1 className="font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight mb-1 select-text">
                  {show.name}
                </h1>
              )}
              {show.tagline && (
                <p className="text-emerald-400/90 font-semibold italic text-xs sm:text-sm md:text-base select-text">
                  {show.tagline}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 text-sm sm:text-base font-extrabold">
              {score > 0 && show.vote_count && show.vote_count > 20 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 font-black shadow-sm text-sm sm:text-base">
                  <Star className="w-4 h-4 sm:w-4.5 sm:h-4.5 fill-current text-emerald-400" />
                  <span className="tracking-tight">{score.toFixed(1)}</span>
                  <span className="text-white/40 font-bold text-xs">/10</span>
                </div>
              )}
              {show.first_air_date && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.08] border border-white/15 text-white font-extrabold text-xs sm:text-sm shadow-sm">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
                  <span>{format(new Date(show.first_air_date), "yyyy")}</span>
                </div>
              )}
              {show.number_of_seasons && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.08] border border-white/15 text-white font-extrabold text-xs sm:text-sm shadow-sm">
                  <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
                  <span>{show.number_of_seasons} {show.number_of_seasons > 1 ? "Seasons" : "Season"}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 ml-0.5">
                {show.genres?.map((g) => (
                  <span
                    key={g.id}
                    className="px-3.5 py-1 bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 rounded-full text-xs sm:text-sm font-extrabold text-white shadow-sm transition-colors"
                  >
                    {g.name}
                  </span>
                ))}
                {Array.isArray((show as any).customTags) && (show as any).customTags.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-xs sm:text-sm font-extrabold text-purple-300 shadow-sm"
                  >
                    🏷️ {tag}
                  </span>
                ))}
              </div>
            </div>

            <p
              className="text-white/65 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl select-text line-clamp-2 sm:line-clamp-3"
            >
              {show.overview}
            </p>

            <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 w-full pt-1">
              {(show as any).isUpcoming || (show as any).status === "upcoming" ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs sm:text-sm font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span>This entry is upcoming. Please check back later.</span>
                </div>
              ) : (show as any).isUnavailable || (show as any).status === "unavailable" ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-zinc-300 text-xs sm:text-sm font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 shrink-0" />
                  <span>This title is currently unavailable on this site. Please check back later.</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const ep = playingSeason === selectedSeason 
                      ? (seasonData?.episodes?.find(e => e.episode_number === playingEpisode) || seasonData?.episodes?.[0])
                      : null;
                    handleWatchEpisode(playingSeason, playingEpisode, ep?.name);
                  }}
                  className="group flex items-center gap-2 bg-primary hover:bg-primary/85 active:scale-95 text-primary-foreground font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-xl shadow-black/30"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current group-hover:scale-110 transition-transform" />
                  Watch S{playingSeason} E{playingEpisode}
                </button>
              )}

              <WatchlistButton
                mediaId={show.id}
                mediaType="tv"
                title={show.name}
                posterPath={show.poster_path ?? null}
                backdropPath={show.backdrop_path ?? null}
              />

              <TvHeroTrailerButton />
            </div>
          </div>
        </div>
      </CinematicHero>

      <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 mt-10 space-y-14">
      {episodeNotice && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
          {episodeNotice}
        </div>
      )}
      {upcomingThisWeek && (
        <div className="rounded-2xl border border-sky-300/20 bg-gradient-to-r from-sky-400/10 to-[#7288AE]/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-sm font-black text-white">New episode this week</div>
            <div className="text-xs text-white/55 mt-0.5">
              Episode {upcomingThisWeek.episode_number}
              {upcomingThisWeek.name ? ` - ${upcomingThisWeek.name}` : ""} airs {format(new Date(`${upcomingThisWeek.air_date}T12:00:00`), "EEE, MMM d")}.
            </div>
          </div>
          <span className="w-fit rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-sky-200">
            Weekly release
          </span>
        </div>
      )}
      {isPlaying && (
        <div ref={playerRef} className={`select-none ${isTheaterMode ? "space-y-6" : "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start"}`}>
          <div className="w-full">
            <VideoPlayer
              type="tv"
              id={id}
              season={playingSeason}
              episode={playingEpisode}
              title={`${show.name} - S${playingSeason}E${playingEpisode}`}
              startProgress={typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get("t") || 0) : 0}
              onEpisodeChange={(s, e) => handleWatchEpisode(s, e)}
              onVideoEnd={handleAutoPlayNext}
              isTheaterMode={isTheaterMode}
              onToggleTheater={handleToggleTheater}
            />
            <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-white/60">
                <span className="font-bold text-white">Now Playing: </span>
                S{playingSeason}E{playingEpisode}
                {currentEpisode?.name ? ` - ${currentEpisode.name}` : ""}
              </div>
              {nextEpisode && (
                <button
                  onClick={() => handleWatchEpisode(playingSeason, nextEpisode.episode_number, nextEpisode.name)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/85 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Play Next: E{nextEpisode.episode_number}
                </button>
              )}
            </div>
          </div>

          <aside className={`w-full shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col ${
            isTheaterMode ? "max-h-[380px]" : "xl:w-80 max-h-[60vh] xl:max-h-[70vh]"
          }`}>
            <div className="p-4 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Episode Queue</span>
                {isTheaterMode && <span className="text-xs font-normal text-white/30">(Theater View)</span>}
              </div>
              <span className="text-xs font-normal text-white/40">Season {selectedSeason}</span>
            </div>
            <div ref={queueRef} className={`flex-1 overflow-y-auto p-2 scrollbar-hide ${
              isTheaterMode ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2" : "space-y-1"
            }`}>
              {seasonLoading ? (
                <div className="col-span-full flex items-center justify-center py-8 text-white/30 text-xs">Loading episodes...</div>
              ) : !seasonData?.episodes?.length ? (
                <div className="col-span-full flex items-center justify-center py-8 text-white/30 text-xs">No episodes found</div>
              ) : (
                seasonData.episodes.map((episode) => {
                  const isWatching = playingSeason === selectedSeason && playingEpisode === episode.episode_number;
                  const isUpcoming = isUpcomingEpisode(episode);
                  return (
                    <button
                      key={`queue-${episode.id}`}
                      ref={isWatching ? selectedEpRef : undefined}
                      onClick={() => handleWatchEpisode(selectedSeason, episode.episode_number, episode.name)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                        isWatching
                          ? "bg-gradient-to-r from-[#111844] to-[#7288AE] text-white shadow-lg shadow-[#4B5694]/20"
                          : isUpcoming
                          ? "bg-white/[0.025] text-white/30 hover:bg-amber-400/10 hover:text-amber-200 border border-amber-400/10"
                          : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                      }
                    `}
                    >
                      <span className={`text-sm font-black w-10 shrink-0 ${isWatching ? "text-white" : ""}`}>
                        E{episode.episode_number}
                      </span>
                      <span className="text-xs truncate flex-1 line-clamp-1">{episode.name}</span>
                      {isUpcoming && (
                        <span className="text-[9px] text-sky-300 font-extrabold uppercase bg-sky-300/10 border border-sky-300/20 px-1.5 py-0.5 rounded shrink-0">Upcoming</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
        <section>
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-5 bg-primary rounded-full shrink-0" />
              <h2 className="text-lg md:text-xl font-bold text-white tracking-wide">Episodes</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {seasonData?.episodes && seasonData.episodes.length > 0 && (
                <EpisodeViewSelector mode={tvViewMode} onChange={handleTvViewChange} views={["list", "grid"]} />
              )}

              {seasons.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {seasons.map((s) => (
                    <button
                      key={s.season_number}
                      onClick={() => setSelectedSeason(s.season_number)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 flex items-center gap-2 shadow-sm",
                        selectedSeason === s.season_number
                          ? "bg-primary text-primary-foreground shadow-md shadow-black/30 ring-1 ring-primary/40"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white border border-white/[0.08]"
                      )}
                    >
                      S{s.season_number}
                      {selectedSeason === s.season_number && seasonLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

            {!seasonLoading && seasonData && (() => {
              const allEpisodes = seasonData.episodes || [];
              const totalEpisodes = allEpisodes.length;
              const startIdx = episodeChunk * TV_CHUNK_SIZE;
              const chunkEpisodes = totalEpisodes > TV_CHUNK_SIZE
                ? allEpisodes.slice(startIdx, startIdx + TV_CHUNK_SIZE)
                : allEpisodes;

              return (
                <div key={`${tvViewMode}-${selectedSeason}-${episodeChunk}`}>
                  {totalEpisodes > TV_CHUNK_SIZE && (
                    <div className="flex justify-end mt-2 mb-6">
                      <EpisodeChunkBar
                        totalEpisodes={totalEpisodes}
                        chunkSize={TV_CHUNK_SIZE}
                        activeChunkIndex={episodeChunk}
                        onChunkChange={setEpisodeChunk}
                        activeEpisodeNumber={playingSeason === selectedSeason ? playingEpisode : undefined}
                      />
                    </div>
                  )}

                  {chunkEpisodes.length > 0 ? (
                    tvViewMode === "grid" ? (
                      <EpisodeGridView items={chunkEpisodes.map(episodeToItem)} />
                    ) : (
                      <EpisodeListView items={chunkEpisodes.map(episodeToItem)} />
                    )
                  ) : (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-white/40">
                      No episodes available for this season.
                    </div>
                  )}

                  {totalEpisodes > TV_CHUNK_SIZE && (
                    <div className="flex justify-end mt-8 pt-4 border-t border-white/[0.06]">
                      <EpisodeChunkBar
                        totalEpisodes={totalEpisodes}
                        chunkSize={TV_CHUNK_SIZE}
                        activeChunkIndex={episodeChunk}
                        onChunkChange={setEpisodeChunk}
                        activeEpisodeNumber={playingSeason === selectedSeason ? playingEpisode : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
        </section>

        {(((show.credits as any)?.cast && (show.credits as any).cast.length > 0) || ((show.credits as any)?.crew && (show.credits as any).crew.length > 0)) && (
          <CastRow cast={(show.credits as any).cast || []} crew={(show.credits as any).crew || []} />
        )}

        {(() => {
          const recs = show.recommendations?.results || [];
          const similar = show.similar?.results || [];
          const seen = new Set<number>();
          const merged: any[] = [];
          const sourceGenres = show.genres?.map((g: any) => g.id) || [];
          const scoreItem = (item: any, source: "recommendation" | "similar") => {
            const targetGenres = item.genre_ids || [];
            const genreMatches = sourceGenres.filter((g: number) => targetGenres.includes(g)).length;
            const rating = Number(item.vote_average || 0);
            const votes = Math.min(Number(item.vote_count || 0), 2500) / 2500;
            return genreMatches * 120 + rating * 10 + votes * 40 + (source === "recommendation" ? 35 : 0);
          };
          for (const item of recs) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            item.reason = getRecommendationReason(sourceGenres, item.genre_ids || []);
            item.relevanceScore = scoreItem(item, "recommendation");
            merged.push({ ...item, media_type: item.media_type || "tv" });
          }
          for (const item of similar) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            item.reason = getRecommendationReason(sourceGenres, item.genre_ids || []);
            item.relevanceScore = scoreItem(item, "similar");
            merged.push({ ...item, media_type: item.media_type || "tv" });
            if (merged.length >= 20) break;
          }
          const filtered = merged
            .filter(item => item.poster_path || item.backdrop_path)
            .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
          if (filtered.length >= 6) {
            return (
              <section className="pt-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-5 bg-primary rounded-full" />
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">More Like This</h2>
                    <p className="text-xs text-white/35 mt-0.5">Ranked by matching genres, audience signal, and TMDB recommendations.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 gap-x-4 gap-y-6">
                  {filtered.slice(0, 20).map((item: any, i: number) => {
                    const visibilityClass =
                      i < 4
                        ? "block"
                        : i < 6
                        ? "hidden sm:block"
                        : i < 8
                        ? "hidden md:block"
                        : i < 10
                        ? "hidden lg:block"
                        : i < 12
                        ? "hidden xl:block"
                        : i < 14
                        ? "hidden 2xl:block"
                        : i < 16
                        ? "hidden 3xl:block"
                        : "hidden 4xl:block";
                    return (
                      <div key={item.id} className={visibilityClass}>
                        <GridMediaCard item={item} index={i} />
                      </div>
                    );
                  })}
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
