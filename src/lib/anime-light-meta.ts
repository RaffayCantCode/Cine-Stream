export type LightweightAnimeMeta = {
  title: string;
  overview: string;
  bannerUrl: string | null;
  posterUrl: string | null;
};

// Metadata resolution happens on every navigation. Cache the lightweight lookup
// in the edge isolate so back/forward navigation and repeat visits don't block
// on another AniList/Kitsu round-trip.
const LIGHT_META_TTL = 15 * 60 * 1000;
const LIGHT_META_FAIL_TTL = 60 * 1000;
const lightMetaCache = new Map<string, { value: LightweightAnimeMeta | null; expires: number }>();

async function fetchLightweightAnimeMeta(id: string): Promise<LightweightAnimeMeta | null> {
  const clean = String(id || "").trim();
  if (clean.startsWith("kitsu-")) {
    const kid = clean.replace("kitsu-", "");
    const res = await fetch(`https://kitsu.io/api/edge/anime/${encodeURIComponent(kid)}`, {
      signal: AbortSignal.timeout(1200),
      headers: { Accept: "application/vnd.api+json" },
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const attr = res?.data?.attributes;
    if (attr) {
      return {
        title: attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || "Anime",
        overview: (attr.synopsis || attr.description || "").slice(0, 300),
        bannerUrl: attr.coverImage?.large || attr.coverImage?.original || null,
        posterUrl: attr.posterImage?.large || attr.posterImage?.medium || null,
      };
    }
    return null;
  }

  const numId = parseInt(clean.replace(/^mal-/, ""), 10);
  if (!isNaN(numId) && numId > 0) {
    const isMal = clean.startsWith("mal-");
    const query = isMal
      ? `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { title { english romaji native } bannerImage coverImage { extraLarge large } description } }`
      : `query ($id: Int) { Media(id: $id, type: ANIME) { title { english romaji native } bannerImage coverImage { extraLarge large } description } }`;
    const variables = isMal ? { idMal: numId } : { id: numId };
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(1200),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const m = res?.data?.Media;
    if (m) {
      return {
        title: m.title?.english || m.title?.romaji || m.title?.native || "Anime",
        overview: (m.description || "").replace(/<[^>]*>/g, "").slice(0, 300),
        bannerUrl: m.bannerImage || m.coverImage?.extraLarge || null,
        posterUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
      };
    }
  }

  return null;
}

export async function fetchLightweightAnimeMetaCached(id: string): Promise<LightweightAnimeMeta | null> {
  const key = String(id || "").trim().toLowerCase();
  if (!key) return null;

  const cached = lightMetaCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const value = await fetchLightweightAnimeMeta(key).catch(() => null);
  if (lightMetaCache.size > 300) {
    const first = lightMetaCache.keys().next().value;
    if (first !== undefined) lightMetaCache.delete(first);
  }
  lightMetaCache.set(key, {
    value,
    expires: Date.now() + (value ? LIGHT_META_TTL : LIGHT_META_FAIL_TTL),
  });
  return value;
}
