import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const provider = searchParams.get("provider") || "";
  
  // Clean IDs by removing tmdb- prefix and any non-numeric characters for safety
  const cleanId = (id: string | null) => {
    if (!id || id.startsWith("tmdb-")) return null;
    return id.replace(/\D/g, "");
  };

  const currentAnilistId = cleanId(searchParams.get("currentAnilistId"));
  const currentMalId = cleanId(searchParams.get("currentMalId"));
  const mainAnilistId = cleanId(searchParams.get("mainAnilistId"));
  const mainMalId = cleanId(searchParams.get("mainMalId"));

  const episode = parseInt(searchParams.get("episode") || "1", 10);
  const episodeOffset = parseInt(searchParams.get("episodeOffset") || "0", 10);
  const absoluteEpisode = episodeOffset + episode;

  // Resolve IDs (with robust fallback to cross-reference AniList -> MAL via AniZip)
  let malIdResolved = currentMalId || mainMalId;
  let anilistIdResolved = currentAnilistId || mainAnilistId;

  if (!malIdResolved && anilistIdResolved) {
    try {
      const azRes = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistIdResolved}`, {
        signal: AbortSignal.timeout(2000)
      });
      if (azRes.ok) {
        const azJson = await azRes.json();
        if (azJson.mappings?.mal_id) {
          malIdResolved = String(azJson.mappings.mal_id);
        }
      }
    } catch { /* ignore */ }
  }

  // Determine which ID/episode strategy to use:
  // - For sequels (currentAnilistId !== mainAnilistId): each season has its own AniList ID
  //   with 1-based episode numbering (e.g. S2 E1 = ID 20958, episode 1).
  //   Use the season-specific ID with the relative episode number.
  // - For non-sequels (same ID): all episodes are under one root AniList ID with
  //   continuous episode numbering, so use absoluteEpisode (offset + episode).
  const isSequel = currentAnilistId && mainAnilistId && currentAnilistId !== mainAnilistId;
  const idToUse = anilistIdResolved || mainAnilistId;
  const malToUse = malIdResolved || mainMalId;
  const epToUse = isSequel ? episode : (episodeOffset > 0 ? absoluteEpisode : episode);

  // If the current season doesn't have its own MAL ID, the frontend falls back
  // to the root MAL ID (currentMalId === mainMalId). When that happens and the
  // season has its own AniList ID, prefer the AniList ID over the misleading MAL ID.
  const hasOwnMalId = currentMalId && currentMalId !== mainMalId;
  const providerAniId = idToUse;
  const providerMalId = hasOwnMalId ? malToUse : null;

  let defaultUrl = "";
  switch (provider) {
    case "vidnest":
      defaultUrl = providerAniId
        ? `https://vidnest.fun/anime/${providerAniId}/${epToUse}/sub`
        : `https://vidnest.fun/anime/${providerMalId || ""}/${epToUse}/sub`;
      break;
    case "animepahe":
      defaultUrl = `https://vidnest.fun/animepahe/${providerMalId || providerAniId || ""}/${epToUse}/sub`;
      break;
    case "animeplay":
      defaultUrl = providerMalId
        ? `https://animeplay.cfd/stream/mal/${providerMalId}/${epToUse}/sub`
        : `https://animeplay.cfd/stream/ani/${providerAniId || ""}/${epToUse}/sub`;
      break;
    case "vidlink":
      defaultUrl = `https://vidlink.pro/anime/${providerMalId || providerAniId || ""}/${epToUse}/sub?fallback=true`;
      break;
  }
  return NextResponse.json({ success: true, url: defaultUrl, checked: false });
}
