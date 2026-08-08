// Canonical ID resolution — maps any accepted URL id form to the canonical
// AniList numeric ID. Accepted forms:
//   {anilistId}         (numeric, verified against AniList)
//   mal-{malId}         (MAL prefix)
//   tmdb-{tmdbId}       (TMDB prefix, resolved via AniZip)
//   {title slug}        (AniList search fallback)

import { getAniListIdFromTmdb } from "./ani-zip";
import { getAnimeCore, getAnimeIdByMal, getAnimeIdBySearch } from "./anilist";

export async function resolveAnimeId(raw: string): Promise<number | null> {
  const input = (raw || "").trim();
  if (!input) return null;

  if (input.startsWith("mal-")) {
    const malId = parseInt(input.replace("mal-", ""), 10);
    if (Number.isNaN(malId)) return null;
    return getAnimeIdByMal(malId);
  }

  if (input.startsWith("tmdb-")) {
    const tmdbId = parseInt(input.replace("tmdb-", ""), 10);
    if (Number.isNaN(tmdbId)) return null;
    return getAniListIdFromTmdb(tmdbId);
  }

  if (/^\d+$/.test(input)) {
    const numId = parseInt(input, 10);
    const core = await getAnimeCore(numId);
    if (core) return numId;

    const malResolved = await getAnimeIdByMal(numId);
    if (malResolved) return malResolved;

    const tmdbResolved = await getAniListIdFromTmdb(numId);
    return tmdbResolved;
  }

  // Title slug — normalise to a search string.
  const title = input.replace(/[-_]/g, " ").trim();
  if (!title) return null;
  return getAnimeIdBySearch(title);
}
