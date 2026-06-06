// Jikan API - Free anime metadata API (Unofficial MyAnimeList)
const JIKAN_BASE = "https://api.jikan.moe/v4";
const ANIPUB_BASE = "https://anipub.xyz/api";

// Helper to get AniPub image URL
async function getAniPubImage(animeName: string): Promise<string | null> {
  try {
    const searchRes = await fetch(`${ANIPUB_BASE}/search/${encodeURIComponent(animeName)}`, {
      next: { revalidate: 3600 }
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    if (searchData && searchData.length > 0) {
      const first = searchData[0];
      if (first.Image && !first.Image.startsWith('http')) {
        return `https://anipub.xyz/${first.Image}`;
      }
      return first.Image;
    }
  } catch (e) {
    console.warn("[AniPub] Failed to get image:", e);
  }
  return null;
}

// Transform with AniPub fallback
async function transformJikanToAnime(data: JikanResponse): Promise<any> {
  const items = await Promise.all(data.data.map(async (anime) => {
    // Try multiple image sources
    let poster = 
      anime.images.jpg?.large_image_url || 
      anime.images.jpg?.image_url ||
      anime.images.webp?.large_image_url ||
      anime.images.webp?.image_url ||
      anime.images.jpg?.small_image_url ||
      "";
    
    // If no image, try AniPub fallback
    if (!poster) {
      const anipubImage = await getAniPubImage(anime.title);
      if (anipubImage) poster = anipubImage;
    }
    
    return {
      id: String(anime.mal_id),
      name: anime.title_english || anime.title,
      jname: anime.title_japanese || null,
      poster,
      type: anime.type || "TV",
      episodes: {
        sub: anime.episodes || null,
        dub: null,
      },
      rating: anime.score ? String(anime.score) : null,
      description: anime.synopsis || "",
      genres: [...anime.genres.map((g) => g.name), ...anime.themes.map((t) => t.name)],
      year: anime.year,
      status: anime.status,
    };
  }));
  return { success: true, data: items, pagination: data.pagination };
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
      small_image_url: string;
    };
    webp: {
      image_url: string;
      large_image_url: string;
      small_image_url: string;
    };
  };
  synopsis: string | null;
  type: string | null;
  episodes: number | null;
  status: string;
  rating: string | null;
  score: number | null;
  genres: { name: string }[];
  themes: { name: string }[];
  year: number | null;
  duration: string | null;
}

export interface JikanResponse {
  data: JikanAnime[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
  };
}

// Get top anime (for home page)
export async function getTopAnime(page: number = 1, limit: number = 25): Promise<any> {
  try {
    const res = await fetch(`${JIKAN_BASE}/top/anime?page=${page}&limit=${limit}`, {
      headers: { "User-Agent": "CineStream/1.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Jikan returned ${res.status}`);
    const data: JikanResponse = await res.json();
    return await transformJikanToAnime(data);
  } catch (error) {
    console.error("[Jikan] Failed to get top anime:", error);
    throw error;
  }
}

// Get currently airing anime
export async function getCurrentlyAiring(page: number = 1, limit: number = 25): Promise<any> {
  try {
    const res = await fetch(`${JIKAN_BASE}/seasons/now?page=${page}&limit=${limit}`, {
      headers: { "User-Agent": "CineStream/1.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Jikan returned ${res.status}`);
    const data: JikanResponse = await res.json();
    return await transformJikanToAnime(data);
  } catch (error) {
    console.error("[Jikan] Failed to get airing anime:", error);
    throw error;
  }
}

// Search anime
export async function searchAnime(query: string, page: number = 1, limit: number = 25): Promise<any> {
  try {
    const res = await fetch(
      `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&sfw`,
      {
        headers: { "User-Agent": "CineStream/1.0" },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) throw new Error(`Jikan returned ${res.status}`);
    const data: JikanResponse = await res.json();
    return await transformJikanToAnime(data);
  } catch (error) {
    console.error("[Jikan] Failed to search anime:", error);
    throw error;
  }
}

// Get anime details
export async function getAnimeDetails(malId: number): Promise<any> {
  try {
    const res = await fetch(`${JIKAN_BASE}/anime/${malId}`, {
      headers: { "User-Agent": "CineStream/1.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Jikan returned ${res.status}`);
    const data = await res.json();
    const anime = data.data;
    
    // Get AniPub image as fallback if Jikan image is missing
    let poster = anime.images.jpg?.large_image_url || anime.images.jpg?.image_url || "";
    if (!poster) {
      const anipubImage = await getAniPubImage(anime.title);
      if (anipubImage) poster = anipubImage;
    }
    
    return {
      success: true,
      data: {
        id: String(anime.mal_id),
        name: anime.title_english || anime.title,
        jname: anime.title_japanese || null,
        poster,
        type: anime.type || "TV",
        episodes: {
          sub: anime.episodes || null,
          dub: null,
        },
        rating: anime.score ? String(anime.score) : null,
        description: anime.synopsis || "",
        genres: anime.genres.map((g: any) => g.name),
        year: anime.year,
        status: anime.status,
        duration: anime.duration,
        rating_: anime.rating,
        studios: anime.studio?.map((s: any) => s.name) || [],
      },
    };
  } catch (error) {
    console.error("[Jikan] Failed to get anime details:", error);
    throw error;
  }
}

// Get recent anime (for variety)
export async function getRecentAnime(page: number = 1, limit: number = 25): Promise<any> {
  try {
    const seasons = ["spring", "summer", "fall", "winter"];
    const currentYear = new Date().getFullYear();
    const currentSeason = seasons[Math.floor(new Date().getMonth() / 3)];
    
    // Try current season first, then recent
    const res = await fetch(
      `${JIKAN_BASE}/seasons/${currentYear}/${currentSeason}?page=${page}&limit=${limit}`,
      {
        headers: { "User-Agent": "CineStream/1.0" },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) throw new Error(`Jikan returned ${res.status}`);
    const data: JikanResponse = await res.json();
    return await transformJikanToAnime(data);
  } catch (error) {
    console.error("[Jikan] Failed to get recent anime:", error);
    throw error;
  }
}