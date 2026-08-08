// Jikan (MyAnimeList) — strictly secondary fallback.
// Only fills genuinely-missing titles/air-dates/filler flags. Never used to
// override primary metadata, and never produces episode thumbnails (Jikan
// reuses poster/cover images per episode, which causes duplicated thumbnails).

import type { AnimeCore, AnimeItem, EpisodeDetail } from "./types";

const JIKAN_BASE = "https://api.jikan.moe/v4";
const JIKAN_USER_AGENT = "CineStream/1.0";
const JIKAN_REVALIDATE = 86400; // 24h

async function jikanFetch(url: string, timeoutMs = 8000): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": JIKAN_USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
        // Never use Next's data cache for Jikan: transient upstream failures
        // (429s, and 200-with-error-envelope) would otherwise be cached for
        // 24h and poison every later request. The in-memory episodesCache
        // already dedups repeated builds.
        cache: "no-store",
      });
      if (res.status === 429) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        return null;
      }
      if (!res.ok) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        return null;
      }

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      // Jikan returns HTTP 200 with an error envelope when its upstream
      // (MyAnimeList) fails or it is rate-limiting burst traffic. Treat these
      // as retryable failures instead of silently returning unusable data.
      if (parsed && (parsed.status === 500 || parsed.type === "UpstreamException" || parsed.type === "RateLimitedException")) {
        if (url.includes("/episodes?")) console.log(`[DEBUG jikan-err] ${url} -> ${text.slice(0, 160)}`);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return null;
      }

      if (url.includes("/episodes?")) console.log(`[DEBUG jikan-ok] ${url} -> dataLen=${(parsed?.data || []).length}`);

      return parsed;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function searchJikan(query: string): Promise<AnimeItem[]> {
  if (!query.trim()) return [];
  try {
    const data = await jikanFetch(
      `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=25&sfw`,
      6000
    );
    return ((data?.data || []) as any[])
      .filter((a) => a.rating !== "Rx - Hentai")
      .map((a) => ({
        id: "mal-" + String(a.mal_id),
        idMal: String(a.mal_id),
        name: a.title_english || a.title,
        jname: a.title_japanese || null,
        poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
        type: a.type || "TV",
        episodes: { sub: a.episodes || null, dub: null },
        rating: a.score ? String(a.score) : null,
        description: a.synopsis || "",
        genres: (a.genres || []).map((g: any) => g.name),
        status: a.status || null,
      }));
  } catch {
    return [];
  }
}

/** Secondary metadata fallback (used only when AniList is unreachable). */
export async function getJikanAnime(malId: number): Promise<AnimeCore | null> {
  try {
    const data = await jikanFetch(`${JIKAN_BASE}/anime/${malId}`);
    const a = data?.data;
    if (!a || a.rating === "Rx - Hentai") return null;
    const isUnreleased =
      (a.status || "").toLowerCase().includes("not yet aired") ||
      (a.status || "").toLowerCase().includes("not yet released");
    return {
      id: `mal-${a.mal_id}`,
      idMal: String(a.mal_id),
      name: a.title_english || a.title || "Unknown",
      jname: a.title_japanese || null,
      poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
      bannerImage: null,
      description: a.synopsis || "",
      type: a.type || "TV",
      rating: a.score ? String(a.score) : null,
      status: isUnreleased ? "NOT_YET_RELEASED" : a.status || null,
      genres: (a.genres || []).map((g: any) => g.name),
      totalEpisodes: a.episodes && a.episodes > 0 ? a.episodes : null,
      season: a.season || null,
      seasonYear: a.year || null,
      format: a.type || null,
      duration: a.duration ? parseInt(String(a.duration), 10) : null,
      trailerId: a.trailer?.youtube_id || null,
      nextAiringEpisode: null,
    };
  } catch {
    return null;
  }
}

/** Secondary episode list. Titles/synopses/air-dates/filler only — no thumbnails. */
export async function getJikanEpisodes(malId: number, maxEpisodes: number): Promise<EpisodeDetail[] | null> {
  try {
    const allEps: EpisodeDetail[] = [];
    const effectiveCap = maxEpisodes && maxEpisodes > 0 ? maxEpisodes : 1500;
    const firstRes = await jikanFetch(`${JIKAN_BASE}/anime/${malId}/episodes?page=1`);
    if (!firstRes) return null;

    const totalPages = firstRes.pagination?.last_visible_page || 1;
    console.log(`[DEBUG jikan-pages] malId=${malId} totalPages=${totalPages} dataLen=${(firstRes.data || []).length}`);
    const parsePage = (page: any, anilistId: string): EpisodeDetail[] => {
      return ((page?.data || []) as any[]).map((ep) => {
        const epNum = typeof ep.episode === "number" ? ep.episode : ep.mal_id;
        return {
          episodeId: `${anilistId}-${epNum}`,
          episodeNum: epNum,
          title: ep.title || `Episode ${epNum}`,
          description: ep.synopsis || null,
          releasedDate: ep.aired || null,
          isFiller: ep.filler || false,
          isRecap: ep.recap || false,
          malUrl: ep.url || null,
          thumbnail: null,
        };
      });
    };

    // First page parsed with a generic anime id placeholder; episodeId is
    // reassigned by the caller anyway. Use a stable key for sorting/dedup.
    for (const ep of (firstRes.data || []) as any[]) {
      const epNum = typeof ep.episode === "number" ? ep.episode : ep.mal_id;
      if (!epNum || epNum > effectiveCap) continue;
      allEps.push({
        episodeId: `jikan-${malId}-${epNum}`,
        episodeNum: epNum,
        title: ep.title || `Episode ${epNum}`,
        description: ep.synopsis || null,
        releasedDate: ep.aired || null,
        isFiller: ep.filler || false,
        isRecap: ep.recap || false,
        malUrl: ep.url || null,
        thumbnail: null,
      });
    }

    const pagesToFetch = Math.min(totalPages, Math.ceil(effectiveCap / 100), 15);
    const restPages = await Promise.all(
      Array.from({ length: pagesToFetch - 1 }, (_, i) =>
        jikanFetch(`${JIKAN_BASE}/anime/${malId}/episodes?page=${i + 2}`)
      )
    );
    for (const pageRes of restPages) {
      if (!pageRes) continue;
      for (const ep of (pageRes.data || []) as any[]) {
        const epNum = typeof ep.episode === "number" ? ep.episode : ep.mal_id;
        if (!epNum || epNum > effectiveCap) continue;
        if (allEps.some((e) => e.episodeNum === epNum)) continue;
        allEps.push({
          episodeId: `jikan-${malId}-${epNum}`,
          episodeNum: epNum,
          title: ep.title || `Episode ${epNum}`,
          description: ep.synopsis || null,
          releasedDate: ep.aired || null,
          isFiller: ep.filler || false,
          isRecap: ep.recap || false,
          malUrl: ep.url || null,
          thumbnail: null,
        });
      }
    }

    allEps.sort((a, b) => a.episodeNum - b.episodeNum);
    return allEps.length > 0 ? allEps : null;
  } catch {
    return null;
  }
}
