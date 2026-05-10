// MangaDex API - Free manga metadata API
const MANGADEX_BASE = "https://api.mangadex.org";

export interface MangaDexManga {
  id: string;
  title: { [key: string]: string };
  description: { [key: string]: string } | null;
  status: string;
  year: number | null;
  tags: { id: string; attributes: { name: { [key: string]: string } } }[];
  coverUrl?: string;
  author?: string;
  chapterCount?: number;
  latestChapter?: string;
}

interface MangaDexResponse {
  result: string;
  response: string;
  data: {
    id: string;
    attributes: {
      title: { [key: string]: string };
      description: { [key: string]: string } | null;
      status: string;
      year: number | null;
      tags: { id: string; attributes: { name: { [key: string]: string } } }[];
    };
    relationships: { id: string; type: string; attributes: { name: string } }[];
  };
  limit: number;
  total: number;
  offset: number;
}

interface CoverResponse {
  result: string;
  response: string;
  data: {
    attributes: { fileName: string };
  };
}

function getEnglishTitle(data: MangaDexResponse["data"]): string {
  const title = data.attributes.title;
  return title.en || title["en-us"] || Object.values(title)[0] || "Unknown";
}

function getEnglishDesc(data: MangaDexResponse["data"]): string {
  const desc = data.attributes.description;
  if (!desc) return "";
  return desc.en || desc["en-us"] || Object.values(desc)[0] || "";
}

function getCoverUrl(mangaId: string, fileName: string): string {
  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg`;
}

export async function getPopularManga(offset: number = 0, limit: number = 20): Promise<any> {
  try {
    const res = await fetch(
      `${MANGADEX_BASE}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&order[followedCount]=desc`,
      { next: { revalidate: 300 } }
    );
    const json: MangaDexResponse & { data: MangaDexResponse["data"][] } = await res.json();
    
    const items = json.data.map((item) => {
      const coverRel = item.relationships.find((r) => r.type === "cover_art");
      const authorRel = item.relationships.find((r) => r.type === "author");
      
      return {
        id: item.id,
        name: getEnglishTitle(item),
        description: getEnglishDesc(item),
        poster: coverRel ? getCoverUrl(item.id, coverRel.attributes.name) : "",
        type: item.attributes.status,
        genres: item.attributes.tags.slice(0, 5).map((t) => t.attributes.name.en || "Manga"),
        year: item.attributes.year,
        author: authorRel?.attributes.name || "Unknown",
      };
    });
    
    return { success: true, data: items, total: json.total, offset: json.offset };
  } catch (error) {
    console.error("[MangaDex] Failed to get popular manga:", error);
    throw error;
  }
}

export async function getLatestManga(offset: number = 0, limit: number = 20): Promise<any> {
  try {
    const res = await fetch(
      `${MANGADEX_BASE}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&order[latestUploadedChapter]=desc`,
      { next: { revalidate: 300 } }
    );
    const json: MangaDexResponse & { data: MangaDexResponse["data"][] } = await res.json();
    
    const items = json.data.map((item) => {
      const coverRel = item.relationships.find((r) => r.type === "cover_art");
      const authorRel = item.relationships.find((r) => r.type === "author");
      
      return {
        id: item.id,
        name: getEnglishTitle(item),
        description: getEnglishDesc(item),
        poster: coverRel ? getCoverUrl(item.id, coverRel.attributes.name) : "",
        type: item.attributes.status,
        genres: item.attributes.tags.slice(0, 5).map((t) => t.attributes.name.en || "Manga"),
        year: item.attributes.year,
        author: authorRel?.attributes.name || "Unknown",
      };
    });
    
    return { success: true, data: items, total: json.total, offset: json.offset };
  } catch (error) {
    console.error("[MangaDex] Failed to get latest manga:", error);
    throw error;
  }
}

export async function searchManga(query: string, offset: number = 0, limit: number = 20): Promise<any> {
  try {
    const res = await fetch(
      `${MANGADEX_BASE}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&title=${encodeURIComponent(query)}`,
      { next: { revalidate: 300 } }
    );
    const json: MangaDexResponse & { data: MangaDexResponse["data"][] } = await res.json();
    
    const items = json.data.map((item) => {
      const coverRel = item.relationships.find((r) => r.type === "cover_art");
      const authorRel = item.relationships.find((r) => r.type === "author");
      
      return {
        id: item.id,
        name: getEnglishTitle(item),
        description: getEnglishDesc(item),
        poster: coverRel ? getCoverUrl(item.id, coverRel.attributes.name) : "",
        type: item.attributes.status,
        genres: item.attributes.tags.slice(0, 5).map((t) => t.attributes.name.en || "Manga"),
        year: item.attributes.year,
        author: authorRel?.attributes.name || "Unknown",
      };
    });
    
    return { success: true, data: items, total: json.total, offset: json.offset };
  } catch (error) {
    console.error("[MangaDex] Failed to search manga:", error);
    throw error;
  }
}

export async function getMangaDetails(mangaId: string): Promise<any> {
  try {
    const res = await fetch(
      `${MANGADEX_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
      { next: { revalidate: 300 } }
    );
    const json: MangaDexResponse = await res.json();
    
    const item = json.data;
    const coverRel = item.relationships.find((r) => r.type === "cover_art");
    const authorRel = item.relationships.find((r) => r.type === "author");
    
    return {
      success: true,
      data: {
        id: item.id,
        name: getEnglishTitle(item),
        description: getEnglishDesc(item),
        poster: coverRel ? getCoverUrl(item.id, coverRel.attributes.name) : "",
        type: item.attributes.status,
        genres: item.attributes.tags.map((t) => t.attributes.name.en || "Manga"),
        year: item.attributes.year,
        author: authorRel?.attributes.name || "Unknown",
      },
    };
  } catch (error) {
    console.error("[MangaDex] Failed to get manga details:", error);
    throw error;
  }
}

export async function getMangaChapters(mangaId: string, offset: number = 0, limit: number = 100): Promise<any> {
  try {
    const res = await fetch(
      `${MANGADEX_BASE}/manga/${mangaId}/feed?limit=${limit}&offset=${offset}&includes[]=scanlation_group`,
      { next: { revalidate: 300 } }
    );
    const json = await res.json();
    
    if (json.result !== "ok") throw new Error("Failed to get chapters");
    
    const chapters = json.data
      .filter((ch: any) => ch.type === "chapter")
      .map((ch: any) => ({
        id: ch.id,
        chapter: ch.attributes.chapter,
        title: ch.attributes.title,
        pages: ch.attributes.pages,
        released: ch.attributes.publishAt,
      }))
      .reverse();
    
    return { success: true, data: chapters };
  } catch (error) {
    console.error("[MangaDex] Failed to get chapters:", error);
    throw error;
  }
}