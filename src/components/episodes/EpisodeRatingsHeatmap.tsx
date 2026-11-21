"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { BarChart3, ChevronDown, ChevronUp, Star } from "lucide-react";
import { cn, fetchJson, peekCachedJson } from "@/lib/utils";

export interface HeatmapEpisodeCell {
  episodeNumber: number;
  title?: string;
  rating?: number | null;
  voteCount?: number | null;
  airDate?: string | null;
}

export interface HeatmapSeasonRow {
  seasonNumber: number;
  seasonName?: string;
  episodes: HeatmapEpisodeCell[];
}

interface EpisodeRatingsHeatmapProps {
  tvId?: number;
  seasonsMeta?: { season_number: number; name?: string }[];
  activeSeasonNumber?: number;
  activeSeasonEpisodes?: HeatmapEpisodeCell[];
  onSelectEpisode: (seasonNumber: number, episodeNumber: number, title?: string) => void;
}

function getRatingTierStyle(rating?: number | null): {
  bg: string;
  label: string;
} {
  const r = Number(rating || 0);
  if (!Number.isFinite(r) || r <= 0) {
    return {
      bg: "bg-white/[0.05] text-white/30 border-white/[0.08]",
      label: "Not rated",
    };
  }
  if (r >= 9.0) {
    return {
      bg: "bg-emerald-400 text-black font-black border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]",
      label: "Awesome",
    };
  }
  if (r >= 8.0) {
    return {
      bg: "bg-emerald-600/85 text-white font-extrabold border-emerald-400/40",
      label: "Great",
    };
  }
  if (r >= 7.0) {
    return {
      bg: "bg-amber-400/90 text-black font-extrabold border-amber-300",
      label: "Good",
    };
  }
  if (r >= 6.0) {
    return {
      bg: "bg-orange-500/85 text-white font-extrabold border-orange-400/40",
      label: "Regular",
    };
  }
  return {
    bg: "bg-rose-600/85 text-white font-extrabold border-rose-400/40",
    label: "Low",
  };
}

export const EpisodeRatingsHeatmap = memo(function EpisodeRatingsHeatmap({
  tvId,
  seasonsMeta = [],
  activeSeasonNumber = 1,
  activeSeasonEpisodes = [],
  onSelectEpisode,
}: EpisodeRatingsHeatmapProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [seasonMap, setSeasonMap] = useState<Record<number, HeatmapEpisodeCell[]>>({});

  // Keep active season episodes synced immediately
  useEffect(() => {
    if (activeSeasonEpisodes && activeSeasonEpisodes.length > 0) {
      setSeasonMap((prev) => ({
        ...prev,
        [activeSeasonNumber]: activeSeasonEpisodes,
      }));
    }
  }, [activeSeasonNumber, activeSeasonEpisodes]);

  // Background-load remaining seasons for multi-season TV shows (up to 12 seasons)
  useEffect(() => {
    if (!tvId || seasonsMeta.length === 0) return;
    let cancelled = false;
    const validSeasons = seasonsMeta
      .filter((s) => s.season_number > 0)
      .slice(0, 12);

    const loadAll = async () => {
      for (const s of validSeasons) {
        const sNum = s.season_number;
        const url = `/api/tmdb/tv/${tvId}/season/${sNum}`;
        const cached = peekCachedJson<any>(url);
        if (cached?.episodes) {
          if (!cancelled) {
            setSeasonMap((prev) =>
              prev[sNum]
                ? prev
                : {
                    ...prev,
                    [sNum]: cached.episodes.map((ep: any) => ({
                      episodeNumber: ep.episode_number,
                      title: ep.name,
                      rating: ep.vote_average,
                      voteCount: ep.vote_count,
                      airDate: ep.air_date,
                    })),
                  }
            );
          }
          continue;
        }

        try {
          const data = await fetchJson<any>(url);
          if (cancelled) return;
          if (data?.episodes) {
            setSeasonMap((prev) => ({
              ...prev,
              [sNum]: data.episodes.map((ep: any) => ({
                episodeNumber: ep.episode_number,
                title: ep.name,
                rating: ep.vote_average,
                voteCount: ep.vote_count,
                airDate: ep.air_date,
              })),
            }));
          }
        } catch {}
      }
    };

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [tvId, seasonsMeta]);

  const rows: HeatmapSeasonRow[] = useMemo(() => {
    if (seasonsMeta.length > 0) {
      return seasonsMeta
        .filter((s) => s.season_number > 0)
        .slice(0, 12)
        .map((s) => ({
          seasonNumber: s.season_number,
          seasonName: s.name || `Season ${s.season_number}`,
          episodes: seasonMap[s.season_number] || [],
        }))
        .filter((r) => r.episodes.length > 0);
    }
    if (activeSeasonEpisodes.length > 0) {
      return [
        {
          seasonNumber: activeSeasonNumber,
          seasonName: `Season ${activeSeasonNumber}`,
          episodes: activeSeasonEpisodes,
        },
      ];
    }
    return [];
  }, [seasonsMeta, seasonMap, activeSeasonNumber, activeSeasonEpisodes]);

  const hasAnyRatedEpisode = useMemo(
    () =>
      rows.some((r) =>
        r.episodes.some((ep) => ep.rating && Number(ep.rating) > 0)
      ),
    [rows]
  );

  if (!hasAnyRatedEpisode) return null;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-[0_14px_38px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
              Episode Ratings Heatmap
            </h3>
            <p className="text-xs text-white/45">
              Click any episode cell to start watching immediately
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-400 text-black font-black">
              9.0+ Awesome
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/85 text-white">
              8.0–8.9 Great
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/90 text-black">
              7.0–7.9 Good
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/85 text-white">
              6.0–6.9 Regular
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600/85 text-white">
              &lt;6.0 Low
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-white/80 hover:text-white transition-all cursor-pointer"
          >
            <span>{isOpen ? "Hide Grid" : "Show Grid"}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="overflow-x-auto pb-2 pt-1 hide-scrollbar">
          <div className="space-y-2 min-w-max">
            {rows.map((row) => {
              const ratedEps = row.episodes.filter(
                (e) => e.rating && Number(e.rating) > 0
              );
              const avg =
                ratedEps.length > 0
                  ? ratedEps.reduce((acc, e) => acc + Number(e.rating || 0), 0) /
                    ratedEps.length
                  : 0;
              const avgTier = getRatingTierStyle(avg);

              return (
                <div key={row.seasonNumber} className="flex items-center gap-2">
                  {/* Season label */}
                  <div className="w-14 shrink-0 text-xs font-black text-white/70 uppercase tracking-wider">
                    S{String(row.seasonNumber).padStart(2, "0")}
                  </div>

                  {/* Season Average Pill */}
                  <div
                    className={cn(
                      "w-14 h-9 shrink-0 rounded-xl border flex flex-col items-center justify-center text-[11px] leading-none",
                      avgTier.bg
                    )}
                    title={`Season ${row.seasonNumber} Average: ${avg > 0 ? avg.toFixed(2) : "N/A"}`}
                  >
                    <span className="text-[8px] uppercase opacity-75 font-bold">AVG</span>
                    <span>{avg > 0 ? avg.toFixed(1) : "—"}</span>
                  </div>

                  <div className="w-px h-6 bg-white/10 mx-0.5 shrink-0" />

                  {/* Episode Rating Cells */}
                  <div className="flex items-center gap-1.5">
                    {row.episodes.slice(0, 60).map((ep) => {
                      const hasScore = Boolean(ep.rating && Number(ep.rating) > 0);
                      const tier = getRatingTierStyle(hasScore ? ep.rating : null);
                      return (
                        <button
                          key={`s${row.seasonNumber}-e${ep.episodeNumber}`}
                          type="button"
                          onClick={() =>
                            onSelectEpisode(row.seasonNumber, ep.episodeNumber, ep.title)
                          }
                          title={`S${row.seasonNumber} E${ep.episodeNumber}: ${ep.title || `Episode ${ep.episodeNumber}`}${hasScore ? ` (★ ${Number(ep.rating).toFixed(1)})` : ""}`}
                          className={cn(
                            "w-11 h-9 rounded-xl border flex flex-col items-center justify-center text-[11px] leading-tight transition-all duration-150 hover:scale-110 hover:z-10 active:scale-95 cursor-pointer",
                            tier.bg
                          )}
                        >
                          <span className="text-[8px] opacity-70 font-bold">
                            E{ep.episodeNumber}
                          </span>
                          <span>
                            {hasScore ? Number(ep.rating).toFixed(1) : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
});
