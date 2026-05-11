// AniPub API - Correct endpoints
const ANIPUB_BASE = "https://anipub.xyz/api";

function fixImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://anipub.xyz/${url}`;
}

function isAdultContent(name?: string, genres?: string[], description?: string): boolean {
  const ADULT_GENRES = ["hentai", "ecchi", "erotica", "pornographic", "smut", "adult"];
  const ADULT_KEYWORDS = ["hentai", "ecchi", "nude", "naked", "porn", "sex", "erotic", "18+", "adult", "xxx", "nsfw", "explicit"];
  
  const lowerName = (name || "").toLowerCase();
  const lowerGenres = (genres || []).map((g) => g.toLowerCase());
  const lowerDesc = (description || "").toLowerCase();

  for (const genre of lowerGenres) {
    if (ADULT_GENRES.some((ag) => genre.includes(ag))) return true;
  }
  for (const keyword of ADULT_KEYWORDS) {
    if (lowerName.includes(keyword)) return true;
  }
  let matches = 0;
  for (const keyword of ADULT_KEYWORDS) {
    if (lowerDesc.includes(keyword)) matches++;
  }
  if (matches >= 2) return true;
  return false;
}

// Get anime by genre - use action as default for browsing
export async function getAnimeByGenre(genre: string = "action", page: number = 1): Promise<any> {
  try {
    const res = await fetch(`${ANIPUB_BASE}/findbyGenre/${genre}?Page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    
    const animes = data.wholePage || data || [];
    const items = animes
      .filter((anime: any) => !isAdultContent(anime.Name, anime.Genres, anime.DescripTion))
      .map((anime: any) => ({
        id: String(anime._id || anime.Id),
        name: anime.Name,
        poster: fixImageUrl(anime.ImagePath || anime.Image),
        type: "TV",
        episodes: { sub: anime.epCount || anime.ep || null, dub: null },
        rating: anime.MALScore || null,
        description: anime.DescripTion || "",
        genres: anime.Genres || [],
        year: null,
        status: anime.Status || "Finished",
      }));
    
    return { success: true, data: items };
  } catch (error) {
    console.error("[AniPub] Failed to get anime by genre:", error);
    throw error;
  }
}

// Get top rated anime
export async function getTopAnime(page: number = 1): Promise<any> {
  try {
    const res = await fetch(`${ANIPUB_BASE}/findbyrating?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    
    const animes = data.wholePage || data.AniData || data || [];
    const items = animes
      .filter((anime: any) => !isAdultContent(anime.Name, anime.Genres, anime.DescripTion))
      .map((anime: any) => ({
        id: String(anime._id || anime.Id),
        name: anime.Name,
        poster: fixImageUrl(anime.ImagePath || anime.Image),
        type: "TV",
        episodes: { sub: anime.epCount || anime.ep || null, dub: null },
        rating: anime.MALScore || null,
        description: anime.DescripTion || "",
        genres: anime.Genres || [],
        year: null,
        status: anime.Status || "Finished",
      }));
    
    return { success: true, data: items };
  } catch (error) {
    console.error("[AniPub] Failed to get top anime:", error);
    throw error;
  }
}

// Search anime
export async function searchAnime(query: string, page: number = 1): Promise<any> {
  try {
    const res = await fetch(`${ANIPUB_BASE}/searchall/${encodeURIComponent(query)}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    
    const animes = data.AniData || data.wholePage || data || [];
    const items = animes
      .filter((anime: any) => !isAdultContent(anime.Name, anime.Genres, anime.DescripTion))
      .map((anime: any) => ({
        id: String(anime._id || anime.Id),
        name: anime.Name,
        poster: fixImageUrl(anime.ImagePath || anime.Image),
        type: "TV",
        episodes: { sub: anime.epCount || anime.ep || null, dub: null },
        rating: anime.MALScore || null,
        description: anime.DescripTion || "",
        genres: anime.Genres || [],
        year: null,
        status: anime.Status || "Finished",
      }));
    
    return { success: true, data: items };
  } catch (error) {
    console.error("[AniPub] Failed to search anime:", error);
    throw error;
  }
}

// Get anime details
export async function getAnimeDetails(animeId: string): Promise<any> {
  try {
    const res = await fetch(`${ANIPUB_BASE}/info/${animeId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    
    return {
      success: true,
      data: {
        id: String(data._id),
        name: data.Name,
        poster: fixImageUrl(data.ImagePath) || fixImageUrl(data.Cover),
        type: data.type || "TV",
        episodes: { sub: data.epCount || null, dub: null },
        rating: data.MALScore || null,
        description: data.DescripTion || "",
        genres: data.Genres || [],
        year: null,
        status: data.Status || "Finished",
      },
    };
  } catch (error) {
    console.error("[AniPub] Failed to get anime details:", error);
    throw error;
  }
}

// Get streaming links - returns iframe URLs directly
export async function getStreamingLinks(animeId: string): Promise<any> {
  try {
    const res = await fetch(`${ANIPUB_BASE}/v1/api/details/${animeId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    
    const cleanSrc = (link: string) =>
      (link || "").replace(/^src=/, "").replace(/^"/, "").replace(/"$/, "");

    const episodes: { episodeId: string; episodeNum: number; title: string; src: string }[] = [];

    // Official shape: local.link = ep1 and local.ep[] = ep2+
    if (data.local?.link) {
      episodes.push({
        episodeId: `${animeId}-1`,
        episodeNum: 1,
        title: "Episode 1",
        src: cleanSrc(data.local.link),
      });
    }

    if (Array.isArray(data.local?.ep)) {
      data.local.ep.forEach((ep: any, index: number) => {
        const epNum = index + 2;
        episodes.push({
          episodeId: `${animeId}-${epNum}`,
          episodeNum: epNum,
          title: ep?.title || `Episode ${epNum}`,
          src: cleanSrc(ep?.link || ep?.src || ""),
        });
      });
    }

    // Fallback shape
    if (episodes.length === 0 && Array.isArray(data.episodes)) {
      data.episodes.forEach((ep: any, index: number) => {
        const epNum = Number(ep.episodeNum || index + 1);
        episodes.push({
          episodeId: String(ep.episodeId || `${animeId}-${epNum}`),
          episodeNum: epNum,
          title: ep.title || `Episode ${epNum}`,
          src: cleanSrc(ep.link || ep.src || ""),
        });
      });
    }
    
    return { success: true, data: { episodes, totalEpisodes: episodes.length } };
  } catch (error) {
    console.error("[AniPub] Failed to get streaming links:", error);
    throw error;
  }
}
