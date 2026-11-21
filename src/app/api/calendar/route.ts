export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export interface CalendarApiItem {
  id: string;
  mediaId: number | string;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  poster: string | null;
  backdrop: string | null;
  dateIso: string; // YYYY-MM-DD
  weekdayLabel?: string;
  timeLabel?: string | null;
  episodeLabel?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  rating?: number | null;
  popularity: number;
  isTop: boolean;
  detailHref: string;
  watchHref: string;
}

const CALENDAR_CACHE = new Map<string, { items: CalendarApiItem[]; ts: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000;

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function toIsoDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDateUtc(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDaysIso(iso: string, days: number): string | null {
  const d = parseIsoDateUtc(iso);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDateUtc(d);
}

function isAnimeTmdb(item: any): boolean {
  if (!item) return false;
  if (item.original_language === "ja" && Array.isArray(item.genre_ids) && item.genre_ids.includes(16)) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const now = new Date();
  const yearParam = parseInt(searchParams.get("year") || String(now.getUTCFullYear()), 10);
  const monthParam = parseInt(searchParams.get("month") || String(now.getUTCMonth() + 1), 10); // 1-12

  const year = Number.isFinite(yearParam) && yearParam >= 2020 && yearParam <= 2030 ? yearParam : now.getUTCFullYear();
  const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getUTCMonth() + 1;

  const cacheKey = `${year}-${String(month).padStart(2, "0")}`;
  const cached = CALENDAR_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return Response.json({ items: cached.items }, { headers: cacheHeaders(1800) });
  }

  const firstDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const lastDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const firstIso = toIsoDateUtc(firstDate);
  const lastIso = toIsoDateUtc(lastDate);
  const todayIso = toIsoDateUtc(now);
  const startUnix = Math.floor(firstDate.getTime() / 1000);
  const endUnix = Math.floor(lastDate.getTime() / 1000);

  const collected: CalendarApiItem[] = [];

  // ── 1. TV SHOWS: Ongoing Trending + Monthly Airing + Weekly Recurring Projection ──
  const tvTask = (async () => {
    try {
      const [trendingTv, onTheAir1, onTheAir2, disc1, disc2, disc3] = await Promise.allSettled([
        tmdbFetch("/trending/tv/week") as Promise<any>,
        tmdbFetch("/tv/on_the_air", { page: "1" }) as Promise<any>,
        tmdbFetch("/tv/on_the_air", { page: "2" }) as Promise<any>,
        tmdbFetch("/discover/tv", {
          "air_date.gte": firstIso,
          "air_date.lte": lastIso,
          sort_by: "popularity.desc",
          without_keywords: "210024",
          without_original_language: "ja",
          without_genres: "10763,10767,10764",
          "vote_count.gte": "10",
          page: "1",
        }) as Promise<any>,
        tmdbFetch("/discover/tv", {
          "air_date.gte": firstIso,
          "air_date.lte": lastIso,
          sort_by: "popularity.desc",
          without_keywords: "210024",
          without_original_language: "ja",
          without_genres: "10763,10767,10764",
          "vote_count.gte": "5",
          page: "2",
        }) as Promise<any>,
        tmdbFetch("/discover/tv", {
          "air_date.gte": firstIso,
          "air_date.lte": lastIso,
          sort_by: "popularity.desc",
          without_keywords: "210024",
          without_original_language: "ja",
          without_genres: "10763,10767,10764",
          page: "3",
        }) as Promise<any>,
      ]);

      const trendingIds = new Set<number>();
      const onTheAirIds = new Set<number>();
      const candidateMap = new Map<number, any>();

      const addCandidates = (res: PromiseSettledResult<any>, markSet?: Set<number>) => {
        if (res.status !== "fulfilled" || !Array.isArray(res.value?.results)) return;
        for (const show of res.value.results) {
          if (!show?.id || isAnimeTmdb(show)) continue;
          if (!show.poster_path && !show.backdrop_path) continue;
          if ( Array.isArray(show.genre_ids) && (show.genre_ids.includes(10763) || show.genre_ids.includes(10767)) ) continue;
          if (markSet) markSet.add(Number(show.id));
          if (!candidateMap.has(Number(show.id))) {
            candidateMap.set(Number(show.id), show);
          }
        }
      };

      addCandidates(trendingTv, trendingIds);
      addCandidates(onTheAir1, onTheAirIds);
      addCandidates(onTheAir2, onTheAirIds);
      addCandidates(disc1);
      addCandidates(disc2);
      addCandidates(disc3);

      const allCandidates = Array.from(candidateMap.values()).sort(
        (a, b) => Number(b.popularity || 0) - Number(a.popularity || 0)
      );

      // Top 26 shows get full `/tv/{id}` detail enrichment to project exact season/episode weekly schedule
      const topToEnrich = allCandidates.slice(0, 26);
      const restCandidates = allCandidates.slice(26, 75);

      const enrichedDetails = await Promise.allSettled(
        topToEnrich.map((show) => tmdbFetch(`/tv/${show.id}`) as Promise<any>)
      );

      const seenSlotKeys = new Set<string>();

      for (let i = 0; i < topToEnrich.length; i++) {
        const base = topToEnrich[i];
        const detailRes = enrichedDetails[i];
        const detail = detailRes?.status === "fulfilled" ? detailRes.value : null;

        const statusStr = String(detail?.status || "").toLowerCase();
        const isEnded = statusStr === "ended" || statusStr === "canceled" || statusStr === "cancelled";

        const nextEp = detail?.next_episode_to_air;
        const lastEp = detail?.last_episode_to_air;
        const anchorEp = nextEp || lastEp;

        // If show ended long before this month, skip it
        if (isEnded && lastEp?.air_date && lastEp.air_date < firstIso) {
          continue;
        }

        const anchorDateIso: string | null =
          anchorEp?.air_date || base.first_air_date || null;
        if (!anchorDateIso) continue;

        const seasonNum = Number(anchorEp?.season_number || detail?.number_of_seasons || 1);
        const anchorEpNum = Number(anchorEp?.episode_number || 1);

        // Find max episodes in this season (default 10 for streaming / 16 for broadcast if unknown)
        const matchedSeason = Array.isArray(detail?.seasons)
          ? detail.seasons.find((s: any) => Number(s.season_number) === seasonNum)
          : null;
        const maxSeasonEps =
          matchedSeason?.episode_count && matchedSeason.episode_count > 0
            ? Number(matchedSeason.episode_count)
            : 12;

        const isTopShow =
          i < 20 ||
          trendingIds.has(Number(base.id)) ||
          Number(base.popularity || 0) >= 55;

        const anchorDateObj = parseIsoDateUtc(anchorDateIso);
        if (!anchorDateObj) continue;
        const weekdayName = WEEKDAY_NAMES[anchorDateObj.getUTCDay()];

        // Project weekly recurring episodes across [-6 .. +6] weeks from the anchor episode
        for (let weekDelta = -6; weekDelta <= 6; weekDelta++) {
          const epNum = anchorEpNum + weekDelta;
          if (epNum < 1 || epNum > maxSeasonEps) continue;
          const targetIso = addDaysIso(anchorDateIso, weekDelta * 7);
          if (!targetIso || targetIso < firstIso || targetIso > lastIso) continue;

          const slotKey = `tv-${base.id}-${targetIso}`;
          if (seenSlotKeys.has(slotKey)) continue;
          seenSlotKeys.add(slotKey);

          collected.push({
            id: `${slotKey}-s${seasonNum}e${epNum}`,
            mediaId: base.id,
            mediaType: "tv",
            title: base.name || base.title || "TV Series",
            poster: base.poster_path
              ? `https://image.tmdb.org/t/p/w342${base.poster_path}`
              : null,
            backdrop: base.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${base.backdrop_path}`
              : null,
            dateIso: targetIso,
            weekdayLabel: `Every ${weekdayName}`,
            episodeLabel: `S${seasonNum} • E${epNum}`,
            seasonNumber: seasonNum,
            episodeNumber: epNum,
            rating: base.vote_average || null,
            popularity: Number(base.popularity || 0),
            isTop: isTopShow,
            detailHref: `/tv/${base.id}`,
            watchHref: `/watch/tv/${base.id}/${seasonNum}/${epNum}`,
          });
        }
      }

      // Also populate normal/remaining shows from discover so "Normal / All Shows" is comprehensive
      for (const show of restCandidates) {
        const baseIso: string | null = show.first_air_date || null;
        let anchorIso = baseIso;
        if (!anchorIso || anchorIso < firstIso || anchorIso > lastIso) {
          // Align show's weekday into the current month
          const d = baseIso ? parseIsoDateUtc(baseIso) : null;
          const dow = d ? d.getUTCDay() : (Number(show.id) % 7);
          const firstDow = firstDate.getUTCDay();
          const offset = (dow - firstDow + 7) % 7;
          anchorIso = addDaysIso(firstIso, offset);
        }
        if (!anchorIso) continue;

        const dObj = parseIsoDateUtc(anchorIso);
        const weekdayName = dObj ? WEEKDAY_NAMES[dObj.getUTCDay()] : "Weekly";

        for (let weekDelta = 0; weekDelta < 4; weekDelta++) {
          const targetIso = addDaysIso(anchorIso, weekDelta * 7);
          if (!targetIso || targetIso < firstIso || targetIso > lastIso) continue;
          const slotKey = `tv-${show.id}-${targetIso}`;
          if (seenSlotKeys.has(slotKey)) continue;
          seenSlotKeys.add(slotKey);

          const epNum = weekDelta + 1;
          collected.push({
            id: `${slotKey}-e${epNum}`,
            mediaId: show.id,
            mediaType: "tv",
            title: show.name || show.title || "TV Series",
            poster: show.poster_path
              ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
              : null,
            backdrop: show.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}`
              : null,
            dateIso: targetIso,
            weekdayLabel: `Every ${weekdayName}`,
            episodeLabel: `New Episode`,
            seasonNumber: 1,
            episodeNumber: epNum,
            rating: show.vote_average || null,
            popularity: Number(show.popularity || 0),
            isTop: false,
            detailHref: `/tv/${show.id}`,
            watchHref: `/watch/tv/${show.id}/1/${epNum}`,
          });
        }
      }
    } catch {}
  })();

  // ── 2. MOVIES: Blockbusters & Theatrical/Digital Releases in this Month ──
  const moviesTask = (async () => {
    try {
      const [m1, m2, m3, upcoming] = await Promise.allSettled([
        tmdbFetch("/discover/movie", {
          "primary_release_date.gte": firstIso,
          "primary_release_date.lte": lastIso,
          sort_by: "popularity.desc",
          without_keywords: "210024",
          without_original_language: "ja",
          include_adult: "false",
          page: "1",
        }) as Promise<any>,
        tmdbFetch("/discover/movie", {
          "primary_release_date.gte": firstIso,
          "primary_release_date.lte": lastIso,
          sort_by: "popularity.desc",
          without_keywords: "210024",
          without_original_language: "ja",
          include_adult: "false",
          page: "2",
        }) as Promise<any>,
        tmdbFetch("/discover/movie", {
          "primary_release_date.gte": firstIso,
          "primary_release_date.lte": lastIso,
          sort_by: "popularity.desc",
          without_keywords: "210024",
          without_original_language: "ja",
          include_adult: "false",
          page: "3",
        }) as Promise<any>,
        tmdbFetch("/movie/upcoming", { page: "1" }) as Promise<any>,
      ]);

      const rawMovies: any[] = [];
      for (const r of [m1, m2, m3, upcoming]) {
        if (r.status === "fulfilled" && Array.isArray(r.value?.results)) {
          rawMovies.push(...r.value.results);
        }
      }

      const seenMovies = new Set<number>();
      const validMovies: any[] = [];
      for (const mov of rawMovies) {
        if (!mov?.id || isAnimeTmdb(mov)) continue;
        if (!mov.poster_path && !mov.backdrop_path) continue;
        const dateIso = mov.release_date;
        if (!dateIso || dateIso < firstIso || dateIso > lastIso) continue;
        if (seenMovies.has(Number(mov.id))) continue;
        seenMovies.add(Number(mov.id));
        validMovies.push(mov);
      }

      validMovies.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));

      validMovies.forEach((mov, idx) => {
        const dateIso = mov.release_date;
        const isTopMovie = idx < 22 || Number(mov.popularity || 0) >= 30;
        collected.push({
          id: `movie-${mov.id}-${dateIso}`,
          mediaId: mov.id,
          mediaType: "movie",
          title: mov.title || mov.name || "Movie",
          poster: mov.poster_path
            ? `https://image.tmdb.org/t/p/w342${mov.poster_path}`
            : null,
          backdrop: mov.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${mov.backdrop_path}`
            : null,
          dateIso,
          episodeLabel: dateIso > todayIso ? "Movie Premiere" : "Now Playing",
          rating: mov.vote_average || null,
          popularity: Number(mov.popularity || 0),
          isTop: isTopMovie,
          detailHref: `/movie/${mov.id}`,
          watchHref: `/watch/movie/${mov.id}`,
        });
      });
    } catch {}
  })();

  // ── 3. ANIME: Exact Monthly AiringSchedule + Recurring Top Seasonal Anime ──
  const animeTask = (async () => {
    try {
      const scheduleQuery = `
        query ($start: Int, $end: Int, $page: Int) {
          Page(page: $page, perPage: 50) {
            airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
              id
              episode
              airingAt
              media {
                id
                isAdult
                popularity
                title { english romaji }
                coverImage { large extraLarge }
                bannerImage
                averageScore
              }
            }
          }
        }
      `;
      const topReleasingQuery = `
        query {
          Page(page: 1, perPage: 30) {
            media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) {
              id
              isAdult
              popularity
              episodes
              title { english romaji }
              coverImage { large extraLarge }
              bannerImage
              averageScore
              nextAiringEpisode {
                airingAt
                episode
              }
            }
          }
        }
      `;

      const [sched1, sched2, sched3, topReleasingRes] = await Promise.allSettled([
        fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: scheduleQuery, variables: { start: startUnix, end: endUnix, page: 1 } }),
          signal: AbortSignal.timeout(5500),
        }).then((r) => (r.ok ? r.json() : null)),
        fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: scheduleQuery, variables: { start: startUnix, end: endUnix, page: 2 } }),
          signal: AbortSignal.timeout(5500),
        }).then((r) => (r.ok ? r.json() : null)),
        fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: scheduleQuery, variables: { start: startUnix, end: endUnix, page: 3 } }),
          signal: AbortSignal.timeout(5500),
        }).then((r) => (r.ok ? r.json() : null)),
        fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: topReleasingQuery }),
          signal: AbortSignal.timeout(5500),
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      const seenAnimeSlots = new Set<string>();

      // Project weekly episodes for the top 30 currently releasing anime across the entire month
      if (topReleasingRes.status === "fulfilled" && Array.isArray(topReleasingRes.value?.data?.Page?.media)) {
        const list = topReleasingRes.value.data.Page.media;
        list.forEach((media: any, idx: number) => {
          if (!media?.id || media.isAdult || !media.nextAiringEpisode?.airingAt) return;
          const anchorUnix = Number(media.nextAiringEpisode.airingAt);
          const anchorEp = Number(media.nextAiringEpisode.episode || 1);
          const maxEps = media.episodes && media.episodes > 0 ? Number(media.episodes) : 2000;
          const pop = Number(media.popularity || 0);
          const isTopAnime = idx < 22 || pop >= 18000;

          const anchorDate = new Date(anchorUnix * 1000);
          const weekdayName = WEEKDAY_NAMES[anchorDate.getUTCDay()];
          const timeLabel = anchorDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });

          for (let weekDelta = -6; weekDelta <= 6; weekDelta++) {
            const epNum = anchorEp + weekDelta;
            if (epNum < 1 || epNum > maxEps) continue;
            const slotUnix = anchorUnix + weekDelta * 7 * 86400;
            if (slotUnix < startUnix || slotUnix > endUnix) continue;
            const dateIso = toIsoDateUtc(new Date(slotUnix * 1000));
            const slotKey = `anime-${media.id}-${dateIso}`;
            if (seenAnimeSlots.has(slotKey)) continue;
            seenAnimeSlots.add(slotKey);

            collected.push({
              id: `${slotKey}-ep${epNum}`,
              mediaId: media.id,
              mediaType: "anime",
              title: media.title?.english || media.title?.romaji || "Anime",
              poster: media.coverImage?.extraLarge || media.coverImage?.large || null,
              backdrop: media.bannerImage || media.coverImage?.extraLarge || null,
              dateIso,
              weekdayLabel: `Every ${weekdayName}`,
              timeLabel,
              episodeLabel: `Episode ${epNum}`,
              episodeNumber: epNum,
              rating: media.averageScore ? media.averageScore / 10 : null,
              popularity: pop,
              isTop: isTopAnime,
              detailHref: `/anime/${media.id}`,
              watchHref: `/watch/anime/${media.id}/${epNum}`,
            });
          }
        });
      }

      // Add exact schedule entries from pages 1-3
      for (const res of [sched1, sched2, sched3]) {
        if (res.status !== "fulfilled" || !Array.isArray(res.value?.data?.Page?.airingSchedules)) continue;
        for (const sched of res.value.data.Page.airingSchedules) {
          const media = sched?.media;
          if (!media?.id || media.isAdult) continue;
          const airDate = new Date(sched.airingAt * 1000);
          const dateIso = toIsoDateUtc(airDate);
          const slotKey = `anime-${media.id}-${dateIso}`;
          if (seenAnimeSlots.has(slotKey)) continue;
          seenAnimeSlots.add(slotKey);

          const pop = Number(media.popularity || 0);
          const weekdayName = WEEKDAY_NAMES[airDate.getUTCDay()];
          collected.push({
            id: `${slotKey}-ep${sched.episode}`,
            mediaId: media.id,
            mediaType: "anime",
            title: media.title?.english || media.title?.romaji || "Anime",
            poster: media.coverImage?.extraLarge || media.coverImage?.large || null,
            backdrop: media.bannerImage || media.coverImage?.extraLarge || null,
            dateIso,
            weekdayLabel: `Every ${weekdayName}`,
            timeLabel: airDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
            episodeLabel: `Episode ${sched.episode}`,
            episodeNumber: sched.episode,
            rating: media.averageScore ? media.averageScore / 10 : null,
            popularity: pop,
            isTop: pop >= 18000,
            detailHref: `/anime/${media.id}`,
            watchHref: `/watch/anime/${media.id}/${sched.episode || 1}`,
          });
        }
      }
    } catch {}
  })();

  await Promise.allSettled([tvTask, moviesTask, animeTask]);

  collected.sort((a, b) => {
    if (a.dateIso !== b.dateIso) return a.dateIso.localeCompare(b.dateIso);
    return b.popularity - a.popularity;
  });

  if (collected.length > 0) {
    CALENDAR_CACHE.set(cacheKey, { items: collected, ts: Date.now() });
  }

  return Response.json({ items: collected }, { headers: cacheHeaders(1800) });
}
