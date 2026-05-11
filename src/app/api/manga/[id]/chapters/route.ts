import { NextRequest } from "next/server";

const ANILIST_API = "https://graphql.anilist.co";
const MANGADEX_API = "https://api.mangadex.org";

async function fetchAniList(query: string, variables: any = {}): Promise<any> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function searchMangaDex(title: string): Promise<any> {
  try {
    const res = await fetch(`${MANGADEX_API}/manga?title=${encodeURIComponent(title)}&limit=5&includes[]=cover_art`, {
      next: { revalidate: 300 },
    });
    const data = await res.json();
    return data.data?.[0] || null;
  } catch (e) {
    console.warn("[MangaDex] Search failed:", e);
    return null;
  }
}

async function getMangaDexChapters(mangaId: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${MANGADEX_API}/manga/${mangaId}/feed?limit=100&translatedLanguage[]=en&order[chapter]=desc`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.warn("[MangaDex] Chapters failed:", e);
    return [];
  }
}

function getMangaReaderUrl(mangaTitle: string, chapter: number): string {
  const clean = mangaTitle.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
  return `https://mangareader.to/read/${clean}/${chapter}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const query = `
      query($id: Int!) {
        Media(id: $id, type: MANGA) {
          id
          title { userPreferred english native }
          coverImage { large medium }
          description
          chapters
          volumes
          status
          genres
          averageScore
          year
          format
        }
      }
    `;

    const data = await fetchAniList(query, { id: parseInt(id) });
    const m = data.Media;
    const mangaTitle = m.title.english || m.title.userPreferred;

    let chapters: any[] = [];
    let mdManga = null;
    
    try {
      mdManga = await searchMangaDex(mangaTitle);
      if (mdManga) {
        chapters = await getMangaDexChapters(mdManga.id);
      }
    } catch (e) {
      console.warn("[MangaChapters] MangaDex failed, using fallback:", e);
    }

    let chapterList: { id: string; number: number; title: string; read: boolean; url: string }[] = [];
    
    if (chapters.length > 0) {
      const uniqueChapters = new Map();
      for (const ch of chapters) {
        const chNum = parseFloat(ch.attributes.chapter);
        if (!uniqueChapters.has(chNum)) {
          uniqueChapters.set(chNum, ch);
        }
      }
      
      chapterList = Array.from(uniqueChapters.values())
        .sort((a, b) => parseFloat(b.attributes.chapter) - parseFloat(a.attributes.chapter))
        .map((ch: any) => ({
          id: ch.id,
          number: parseInt(ch.attributes.chapter) || 1,
          title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
          read: false,
          url: getMangaReaderUrl(mangaTitle, parseInt(ch.attributes.chapter) || 1),
        }));
    } else {
      const chapterCount = m.chapters || 10;
      for (let i = chapterCount; i >= 1; i--) {
        chapterList.push({
          id: `${id}-chapter-${i}`,
          number: i,
          title: `Chapter ${i}`,
          read: false,
          url: getMangaReaderUrl(mangaTitle, i),
        });
      }
    }

    return Response.json({
      success: true,
      data: {
        chapters: chapterList,
        totalChapters: chapterList.length,
        manga: {
          id: String(m.id),
          name: mangaTitle,
          jname: m.title.native,
          poster: m.coverImage?.large || m.coverImage?.medium || "",
          description: m.description?.replace(/<[^>]*>/g, "") || "",
          chapters: m.chapters,
          volumes: m.volumes,
          status: m.status,
          genres: m.genres,
          rating: m.averageScore ? String(m.averageScore) : null,
          year: m.year,
          format: m.format,
        },
      },
    });
  } catch (error) {
    console.error("[Manga Chapters Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch chapters", success: false },
      { status: 500 }
    );
  }
}