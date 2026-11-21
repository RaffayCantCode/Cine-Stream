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
  if (
    item.original_language === "ja" &&
    Array.isArray(item.genre_ids) &&
    item.genre_ids.includes(16)
  ) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const now = new Date();
  const yearParam = parseInt(
    searchParams.get("year") || String(now.getUTCFullYear()),
    10
  );
  const monthParam = parseInt(
    searchParams.get("month") || String(now.getUTCMonth() + 1),
    10
  ); // 1-12

  const year =
    Number.isFinite(yearParam) && yearParam >= 2020 && yearParam <= 2030
      ? yearParam
      : now.getUTCFullYear();
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : now.getUTCMonth() + 1;

  const cacheKey = `v2-${year}-${String(month).padStart(2, "0")}`;
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

  const tvCollected: CalendarApiItem[] = [];
  const movieCollected: CalendarApiItem[] = [];
  const animeCollected: CalendarApiItem[] = [];

  // ── 1. TV SHOWS: Exact Season Episodes in [firstIso..lastIso] + Ongoing Weekly Projection ──
  const tvTask = (async () => {
    try {
      const [
        discAir1,
        discAir2,
        discAir3,
        discAir4,
        discPremiere1,
        discPremiere2,
        trendingTv,
        onTheAir1,
      ] = await Promise.allSettled([
        tmdbFetch(
          "/discover/tv",
          {
            "air_date.gte": firstIso,
            "air_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            without_genres: "10763,10767,10764",
            page: "1",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/tv",
          {
            "air_date.gte": firstIso,
            "air_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            without_genres: "10763,10767,10764",
            page: "2",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/tv",
          {
            "air_date.gte": firstIso,
            "air_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            without_genres: "10763,10767,10764",
            page: "3",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/tv",
          {
            "air_date.gte": firstIso,
            "air_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            without_genres: "10763,10767,10764",
            page: "4",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/tv",
          {
            "first_air_date.gte": firstIso,
            "first_air_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            without_genres: "10763,10767,10764",
            page: "1",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/tv",
          {
            "first_air_date.gte": firstIso,
            "first_air_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            without_genres: "10763,10767,10764",
            page: "2",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch("/trending/tv/week", undefined, { allowFuture: true }) as Promise<any>,
        tmdbFetch("/tv/on_the_air", { page: "1" }, { allowFuture: true }) as Promise<any>,
      ]);

      // Shows explicitly returned by TMDB as airing in [firstIso..lastIso]
      const monthlyAiringMap = new Map<number, any>();
      const addMonthly = (res: PromiseSettledResult<any>) => {
        if (res.status !== "fulfilled" || !Array.isArray(res.value?.results)) return;
        for (const show of res.value.results) {
          if (!show?.id || isAnimeTmdb(show)) continue;
          if (!show.poster_path && !show.backdrop_path) continue;
          if (
            Array.isArray(show.genre_ids) &&
            (show.genre_ids.includes(10763) ||
              show.genre_ids.includes(10767) ||
              show.genre_ids.includes(10764))
          ) {
            continue;
          }
          if (!monthlyAiringMap.has(Number(show.id))) {
            monthlyAiringMap.set(Number(show.id), show);
          }
        }
      };

      addMonthly(discAir1);
      addMonthly(discAir2);
      addMonthly(discAir3);
      addMonthly(discAir4);
      addMonthly(discPremiere1);
      addMonthly(discPremiere2);

      // Also include top trending/on-the-air shows so ongoing weekly shows are checked
      const trendingBonusMap = new Map<number, any>();
      for (const res of [trendingTv, onTheAir1]) {
        if (res.status !== "fulfilled" || !Array.isArray(res.value?.results)) continue;
        for (const show of res.value.results) {
          if (!show?.id || isAnimeTmdb(show)) continue;
          if (!show.poster_path && !show.backdrop_path) continue;
          if (
            Array.isArray(show.genre_ids) &&
            (show.genre_ids.includes(10763) ||
              show.genre_ids.includes(10767) ||
              show.genre_ids.includes(10764))
          ) {
            continue;
          }
          if (!monthlyAiringMap.has(Number(show.id))) {
            trendingBonusMap.set(Number(show.id), show);
          }
        }
      }

      const monthlySorted = Array.from(monthlyAiringMap.values()).sort(
        (a, b) => Number(b.popularity || 0) - Number(a.popularity || 0)
      );
      const trendingSorted = Array.from(trendingBonusMap.values())
        .sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0))
        .slice(0, 14);

      const candidatesToEnrich = [...monthlySorted.slice(0, 34), ...trendingSorted].slice(0, 42);
      const remainingMonthly = monthlySorted.slice(34, 80);

      // Step A: Fetch `/tv/{id}` details in parallel for the top 42 candidates
      const detailResults = await Promise.allSettled(
        candidatesToEnrich.map(
          (show) => tmdbFetch(`/tv/${show.id}`, undefined, { allowFuture: true }) as Promise<any>
        )
      );

      // Step B: Determine which season of each show is airing in [firstIso..lastIso] and fetch `/tv/{id}/season/{sNum}`
      interface ShowEnrichPlan {
        base: any;
        detail: any;
        targetSeasonNum: number;
      }
      const seasonPlans: ShowEnrichPlan[] = [];

      for (let i = 0; i < candidatesToEnrich.length; i++) {
        const base = candidatesToEnrich[i];
        const dRes = detailResults[i];
        const detail = dRes?.status === "fulfilled" ? dRes.value : null;
        if (!detail) continue;

        const statusStr = String(detail.status || "").toLowerCase();
        const isEnded =
          statusStr === "ended" ||
          statusStr === "canceled" ||
          statusStr === "cancelled";

        const nextEp = detail.next_episode_to_air;
        const lastEp = detail.last_episode_to_air;

        // If the series is Ended/Canceled and its last episode aired before this month, NEVER include it!
        if (isEnded && (!lastEp?.air_date || lastEp.air_date < firstIso) && !nextEp) {
          continue;
        }
        // Even for a "Returning Series", if it has NO next_episode_to_air AND its last episode aired before this month,
        // its previous season already finished before this month — do NOT invent episodes!
        if (!nextEp && lastEp?.air_date && lastEp.air_date < firstIso) {
          continue;
        }

        // Pick the season that overlaps [firstIso..lastIso]
        let targetSeasonNum = Number(
          nextEp?.season_number ||
            lastEp?.season_number ||
            detail.number_of_seasons ||
            1
        );
        if (Array.isArray(detail.seasons)) {
          const validSeasons = detail.seasons.filter((s: any) => s.season_number > 0);
          const matchingMonthSeason = validSeasons.find(
            (s: any) => s.air_date && s.air_date >= firstIso && s.air_date <= lastIso
          );
          if (matchingMonthSeason) {
            targetSeasonNum = matchingMonthSeason.season_number;
          }
        }

        seasonPlans.push({ base, detail, targetSeasonNum });
      }

      const seasonResults = await Promise.allSettled(
        seasonPlans.map(
          (p) =>
            tmdbFetch(`/tv/${p.base.id}/season/${p.targetSeasonNum}`, undefined, {
              allowFuture: true,
            }) as Promise<any>
        )
      );

      const seenSlotKeys = new Set<string>();

      for (let i = 0; i < seasonPlans.length; i++) {
        const { base, detail, targetSeasonNum } = seasonPlans[i];
        const sRes = seasonResults[i];
        const seasonData = sRes?.status === "fulfilled" ? sRes.value : null;
        const episodes: any[] = Array.isArray(seasonData?.episodes)
          ? seasonData.episodes
          : [];

        let addedFromRealSeason = 0;
        let lastKnownEpInSeason: { epNum: number; airDate: string } | null = null;

        // 1. Add all real TMDB episodes from seasonData whose air_date is in [firstIso..lastIso]
        for (const ep of episodes) {
          if (!ep?.air_date) continue;
          lastKnownEpInSeason = {
            epNum: Number(ep.episode_number || 1),
            airDate: ep.air_date,
          };
          if (ep.air_date < firstIso || ep.air_date > lastIso) continue;

          const slotKey = `tv-${base.id}-${ep.air_date}`;
          if (seenSlotKeys.has(slotKey)) continue;
          seenSlotKeys.add(slotKey);
          addedFromRealSeason++;

          const dObj = parseIsoDateUtc(ep.air_date);
          const weekdayName = dObj ? WEEKDAY_NAMES[dObj.getUTCDay()] : "Weekly";
          const epNum = Number(ep.episode_number || 1);

          tvCollected.push({
            id: `${slotKey}-s${targetSeasonNum}e${epNum}`,
            mediaId: base.id,
            mediaType: "tv",
            title: base.name || base.title || detail.name || "TV Series",
            poster: base.poster_path
              ? `https://image.tmdb.org/t/p/w342${base.poster_path}`
              : null,
            backdrop: base.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${base.backdrop_path}`
              : null,
            dateIso: ep.air_date,
            weekdayLabel: `Every ${weekdayName}`,
            episodeLabel: `S${targetSeasonNum} • E${epNum}`,
            seasonNumber: targetSeasonNum,
            episodeNumber: epNum,
            rating: base.vote_average || null,
            popularity: Number(base.popularity || 0),
            isTop: false, // computed after ranking all active shows of the month
            detailHref: `/tv/${base.id}`,
            watchHref: `/watch/tv/${base.id}/${targetSeasonNum}/${epNum}`,
          });
        }

        // 2. ONLY project future weekly episodes if the show has an explicit `next_episode_to_air`
        // (i.e. it is actively airing new episodes) AND TMDB's season episode list didn't already cover them,
        // and NEVER exceed `matchedSeason.episode_count`!
        const nextEp = detail.next_episode_to_air;
        const matchedSeasonMeta = Array.isArray(detail.seasons)
          ? detail.seasons.find((s: any) => Number(s.season_number) === targetSeasonNum)
          : null;
        const declaredEpisodeCount = Number(matchedSeasonMeta?.episode_count || 0);

        if (nextEp?.air_date && declaredEpisodeCount > 0) {
          const anchorIso = lastKnownEpInSeason?.airDate || nextEp.air_date;
          const anchorEpNum =
            lastKnownEpInSeason?.epNum || Number(nextEp.episode_number || 1);
          const dObj = parseIsoDateUtc(anchorIso);
          const weekdayName = dObj ? WEEKDAY_NAMES[dObj.getUTCDay()] : "Weekly";

          for (let weekDelta = 0; weekDelta <= 8; weekDelta++) {
            const epNum = anchorEpNum + weekDelta;
            if (epNum > declaredEpisodeCount) break;
            const targetIso = addDaysIso(anchorIso, weekDelta * 7);
            if (!targetIso || targetIso < firstIso || targetIso > lastIso) continue;
            // Never project before next_episode_to_air
            if (targetIso < nextEp.air_date) continue;

            const slotKey = `tv-${base.id}-${targetIso}`;
            if (seenSlotKeys.has(slotKey)) continue;
            seenSlotKeys.add(slotKey);

            tvCollected.push({
              id: `${slotKey}-s${targetSeasonNum}e${epNum}`,
              mediaId: base.id,
              mediaType: "tv",
              title: base.name || base.title || detail.name || "TV Series",
              poster: base.poster_path
                ? `https://image.tmdb.org/t/p/w342${base.poster_path}`
                : null,
              backdrop: base.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${base.backdrop_path}`
                : null,
              dateIso: targetIso,
              weekdayLabel: `Every ${weekdayName}`,
              episodeLabel: `S${targetSeasonNum} • E${epNum}`,
              seasonNumber: targetSeasonNum,
              episodeNumber: epNum,
              rating: base.vote_average || null,
              popularity: Number(base.popularity || 0),
              isTop: false,
              detailHref: `/tv/${base.id}`,
              watchHref: `/watch/tv/${base.id}/${targetSeasonNum}/${epNum}`,
            });
          }
        } else if (
          addedFromRealSeason === 0 &&
          base.first_air_date &&
          base.first_air_date >= firstIso &&
          base.first_air_date <= lastIso
        ) {
          // Brand-new upcoming series premiere in a future month
          const slotKey = `tv-${base.id}-${base.first_air_date}`;
          if (!seenSlotKeys.has(slotKey)) {
            seenSlotKeys.add(slotKey);
            tvCollected.push({
              id: `${slotKey}-premiere`,
              mediaId: base.id,
              mediaType: "tv",
              title: base.name || base.title || "TV Series",
              poster: base.poster_path
                ? `https://image.tmdb.org/t/p/w342${base.poster_path}`
                : null,
              backdrop: base.backdrop_path
                ? `https://image.tmdb.org/t/p/w780${base.backdrop_path}`
                : null,
              dateIso: base.first_air_date,
              episodeLabel: "Series Premiere",
              seasonNumber: 1,
              episodeNumber: 1,
              rating: base.vote_average || null,
              popularity: Number(base.popularity || 0),
              isTop: false,
              detailHref: `/tv/${base.id}`,
              watchHref: `/watch/tv/${base.id}/1/1`,
            });
          }
        }
      }

      // Add remaining monthly premieres for "All Shows" mode
      for (const show of remainingMonthly) {
        if (
          show.first_air_date &&
          show.first_air_date >= firstIso &&
          show.first_air_date <= lastIso
        ) {
          const slotKey = `tv-${show.id}-${show.first_air_date}`;
          if (seenSlotKeys.has(slotKey)) continue;
          seenSlotKeys.add(slotKey);

          tvCollected.push({
            id: `${slotKey}-s1e1`,
            mediaId: show.id,
            mediaType: "tv",
            title: show.name || show.title || "TV Series",
            poster: show.poster_path
              ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
              : null,
            backdrop: show.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}`
              : null,
            dateIso: show.first_air_date,
            episodeLabel: "Series Premiere",
            seasonNumber: 1,
            episodeNumber: 1,
            rating: show.vote_average || null,
            popularity: Number(show.popularity || 0),
            isTop: false,
            detailHref: `/tv/${show.id}`,
            watchHref: `/watch/tv/${show.id}/1/1`,
          });
        }
      }

      // Rank unique TV shows that actually have episodes in this month by popularity,
      // and mark the Top 26 unique series of the month as `isTop = true`!
      const popByTvId = new Map<string, number>();
      for (const item of tvCollected) {
        const key = String(item.mediaId);
        popByTvId.set(key, Math.max(popByTvId.get(key) || 0, item.popularity));
      }
      const topTvIds = new Set(
        Array.from(popByTvId.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 26)
          .map((e) => e[0])
      );
      for (const item of tvCollected) {
        item.isTop = topTvIds.has(String(item.mediaId));
      }
    } catch {}
  })();

  // ── 2. MOVIES: Current & Future Month Theatrical / Digital Releases ──
  const moviesTask = (async () => {
    try {
      const [m1, m2, m3, m4] = await Promise.allSettled([
        tmdbFetch(
          "/discover/movie",
          {
            "primary_release_date.gte": firstIso,
            "primary_release_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            include_adult: "false",
            page: "1",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/movie",
          {
            "primary_release_date.gte": firstIso,
            "primary_release_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            include_adult: "false",
            page: "2",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/movie",
          {
            "primary_release_date.gte": firstIso,
            "primary_release_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            include_adult: "false",
            page: "3",
          },
          { allowFuture: true }
        ) as Promise<any>,
        tmdbFetch(
          "/discover/movie",
          {
            "release_date.gte": firstIso,
            "release_date.lte": lastIso,
            sort_by: "popularity.desc",
            without_keywords: "210024",
            without_original_language: "ja",
            include_adult: "false",
            page: "1",
          },
          { allowFuture: true }
        ) as Promise<any>,
      ]);

      const rawMovies: any[] = [];
      for (const r of [m1, m2, m3, m4]) {
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
        const isTopMovie = idx < 25;
        movieCollected.push({
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
          episodeLabel: dateIso > todayIso ? "Upcoming Movie" : "Movie Release",
          rating: mov.vote_average || null,
          popularity: Number(mov.popularity || 0),
          isTop: isTopMovie,
          detailHref: `/movie/${mov.id}`,
          watchHref: `/watch/movie/${mov.id}`,
        });
      });
    } catch {}
  })();

  // ── 3. ANIME: Exact Monthly AiringSchedule + Future Month Anime Premieres ──
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
                episodes
                status
                title { english romaji }
                coverImage { large extraLarge }
                bannerImage
                averageScore
              }
            }
          }
        }
      `;
      const startDateInt = year * 10000 + month * 100;
      const endDateInt = year * 10000 + month * 100 + 32;
      const monthPremiereQuery = `
        query ($startDate: FuzzyDateInt, $endDate: FuzzyDateInt) {
          Page(page: 1, perPage: 40) {
            media(type: ANIME, startDate_greater: $startDate, startDate_lesser: $endDate, sort: POPULARITY_DESC, isAdult: false) {
              id
              isAdult
              popularity
              episodes
              status
              startDate { year month day }
              title { english romaji }
              coverImage { large extraLarge }
              bannerImage
              averageScore
              nextAiringEpisode { airingAt episode }
            }
          }
        }
      `;

      const [sched1, sched2, sched3, sched4, monthPremieresRes] =
        await Promise.allSettled([
          fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: scheduleQuery,
              variables: { start: startUnix, end: endUnix, page: 1 },
            }),
            signal: AbortSignal.timeout(5500),
          }).then((r) => (r.ok ? r.json() : null)),
          fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: scheduleQuery,
              variables: { start: startUnix, end: endUnix, page: 2 },
            }),
            signal: AbortSignal.timeout(5500),
          }).then((r) => (r.ok ? r.json() : null)),
          fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: scheduleQuery,
              variables: { start: startUnix, end: endUnix, page: 3 },
            }),
            signal: AbortSignal.timeout(5500),
          }).then((r) => (r.ok ? r.json() : null)),
          fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: scheduleQuery,
              variables: { start: startUnix, end: endUnix, page: 4 },
            }),
            signal: AbortSignal.timeout(5500),
          }).then((r) => (r.ok ? r.json() : null)),
          fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: monthPremiereQuery,
              variables: { startDate: startDateInt, endDate: endDateInt },
            }),
            signal: AbortSignal.timeout(5500),
          }).then((r) => (r.ok ? r.json() : null)),
        ]);

      const seenAnimeSlots = new Set<string>();

      for (const res of [sched1, sched2, sched3, sched4]) {
        if (
          res.status !== "fulfilled" ||
          !Array.isArray(res.value?.data?.Page?.airingSchedules)
        ) {
          continue;
        }
        for (const sched of res.value.data.Page.airingSchedules) {
          const media = sched?.media;
          if (!media?.id || media.isAdult) continue;
          const airDate = new Date(sched.airingAt * 1000);
          const dateIso = toIsoDateUtc(airDate);
          if (dateIso < firstIso || dateIso > lastIso) continue;
          const slotKey = `anime-${media.id}-${dateIso}`;
          if (seenAnimeSlots.has(slotKey)) continue;
          seenAnimeSlots.add(slotKey);

          const pop = Number(media.popularity || 0);
          const weekdayName = WEEKDAY_NAMES[airDate.getUTCDay()];
          animeCollected.push({
            id: `${slotKey}-ep${sched.episode}`,
            mediaId: media.id,
            mediaType: "anime",
            title: media.title?.english || media.title?.romaji || "Anime",
            poster:
              media.coverImage?.extraLarge || media.coverImage?.large || null,
            backdrop:
              media.bannerImage || media.coverImage?.extraLarge || null,
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
            isTop: false,
            detailHref: `/anime/${media.id}`,
            watchHref: `/watch/anime/${media.id}/${sched.episode || 1}`,
          });
        }
      }

      // Also add future-month anime premieres that have a startDate in [firstIso..lastIso]
      if (
        monthPremieresRes.status === "fulfilled" &&
        Array.isArray(monthPremieresRes.value?.data?.Page?.media)
      ) {
        for (const media of monthPremieresRes.value.data.Page.media) {
          if (!media?.id || media.isAdult) continue;
          const sd = media.startDate;
          if (!sd?.year || !sd?.month || !sd?.day) continue;
          const premiereIso = `${sd.year}-${String(sd.month).padStart(2, "0")}-${String(
            sd.day
          ).padStart(2, "0")}`;
          if (premiereIso < firstIso || premiereIso > lastIso) continue;

          const maxEps = Number(media.episodes || 12);
          const dObj = parseIsoDateUtc(premiereIso);
          const weekdayName = dObj ? WEEKDAY_NAMES[dObj.getUTCDay()] : "Weekly";

          for (let weekDelta = 0; weekDelta < Math.min(maxEps, 5); weekDelta++) {
            const targetIso = addDaysIso(premiereIso, weekDelta * 7);
            if (!targetIso || targetIso < firstIso || targetIso > lastIso) continue;
            const slotKey = `anime-${media.id}-${targetIso}`;
            if (seenAnimeSlots.has(slotKey)) continue;
            seenAnimeSlots.add(slotKey);

            const epNum = weekDelta + 1;
            animeCollected.push({
              id: `${slotKey}-ep${epNum}`,
              mediaId: media.id,
              mediaType: "anime",
              title: media.title?.english || media.title?.romaji || "Anime",
              poster:
                media.coverImage?.extraLarge || media.coverImage?.large || null,
              backdrop:
                media.bannerImage || media.coverImage?.extraLarge || null,
              dateIso: targetIso,
              weekdayLabel: maxEps > 1 ? `Every ${weekdayName}` : undefined,
              episodeLabel: maxEps === 1 ? "Movie / Special" : `Episode ${epNum}`,
              episodeNumber: epNum,
              rating: media.averageScore ? media.averageScore / 10 : null,
              popularity: Number(media.popularity || 0),
              isTop: false,
              detailHref: `/anime/${media.id}`,
              watchHref: `/watch/anime/${media.id}/${epNum}`,
            });
          }
        }
      }

      // Mark the top 25 unique Anime of the month by popularity as `isTop = true`
      const popByAnimeId = new Map<string, number>();
      for (const item of animeCollected) {
        const key = String(item.mediaId);
        popByAnimeId.set(key, Math.max(popByAnimeId.get(key) || 0, item.popularity));
      }
      const topAnimeIds = new Set(
        Array.from(popByAnimeId.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)
          .map((e) => e[0])
      );
      for (const item of animeCollected) {
        item.isTop = topAnimeIds.has(String(item.mediaId));
      }
    } catch {}
  })();

  await Promise.allSettled([tvTask, moviesTask, animeTask]);

  const collected = [...tvCollected, ...movieCollected, ...animeCollected];
  collected.sort((a, b) => {
    if (a.dateIso !== b.dateIso) return a.dateIso.localeCompare(b.dateIso);
    return b.popularity - a.popularity;
  });

  if (collected.length > 0) {
    CALENDAR_CACHE.set(cacheKey, { items: collected, ts: Date.now() });
  }

  return Response.json({ items: collected }, { headers: cacheHeaders(1800) });
}
