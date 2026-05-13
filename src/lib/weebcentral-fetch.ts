const WC_BASE = "https://weebcentral.com";

function parseGenres(tagStr: string): string[] {
  if (!tagStr) return [];
  return tagStr.split(",").map(t => t.trim()).filter(Boolean);
}

export async function searchWCManga(query: string, page = 1): Promise<{ success: boolean; data: any[]; hasMore: boolean }> {
  try {
    const offset = (page - 1) * 24;
    const encoded = encodeURIComponent(query.replace(/\s+/g, " ").trim());
    const url = `${WC_BASE}/search/data?limit=24&offset=${offset}&text=${encoded}&sort=Best+Match&order=Ascending&official=Any&display_mode=Minimal%20Display`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
      next: { revalidate: 300 }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const results: any[] = [];

    const titleMatches = html.match(/href="(\/series\/[^"]+)"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"[\s\S]*?<span[^>]*>\s*(Manhwa|Manhua|Manga|OEL)/gi) || [];

    for (const match of titleMatches) {
      const hrefMatch = match.match(/href="(\/series\/([^"/]+)[^"]*)"/);
      const srcMatch = match.match(/src="([^"]+)"/);
      const altMatch = match.match(/alt="([^"]+)"/);
      const typeMatch = match.match(/(Manhwa|Manhua|Manga|OEL)/);

      if (hrefMatch && srcMatch && altMatch) {
        const urlPath = hrefMatch[1];
        const id = hrefMatch[2];
        const poster = srcMatch[1];
        const name = altMatch[1];

        results.push({
          id,
          name: name.replace(/&amp;/g, "&").replace(/&quot;/g, '"'),
          poster: poster.replace(/&amp;/g, "&"),
          type: typeMatch ? typeMatch[1] : "Manga",
          genres: [],
          year: null,
          author: "",
          status: "",
        });
      }
    }

    return { success: true, data: results, hasMore: results.length >= 24 };
  } catch (error) {
    console.error("[WC Search Error]:", error);
    return { success: false, data: [], hasMore: false };
  }
}

export async function getPopularWCManga(page = 1): Promise<{ success: boolean; data: any[]; hasMore: boolean }> {
  return searchWCManga("popular manga", page);
}

export async function getLatestWCManga(page = 1): Promise<{ success: boolean; data: any[]; hasMore: boolean }> {
  return searchWCManga("latest", page);
}

export async function getWCMangaDetails(mangaId: string): Promise<{ success: boolean; data: any; error?: string }> {
  try {
    const res = await fetch(`${WC_BASE}/series/${mangaId}`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
      next: { revalidate: 300 }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const coverMatch = html.match(/class="[^"]*cover[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
    const titleMatch = html.match(/<h1[^>]*>\s*([^<]+)/i);
    const descMatch = html.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const typeMatch = html.match(/Type[:\s]+<[^>]*>\s*([^<]+)/i);
    const statusMatch = html.match(/Status[:\s]+<[^>]*>\s*([^<]+)/i);
    const authorMatch = html.match(/Author[:\s]+<[^>]*>\s*<a[^>]*>\s*([^<]+)/i);

    const poster = coverMatch ? coverMatch[1].replace(/&amp;/g, "&") : "";

    return {
      success: true,
      data: {
        id: mangaId,
        name: titleMatch ? titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "Unknown",
        poster,
        description: descMatch ? descMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() : "",
        type: typeMatch ? typeMatch[1] : "Manga",
        genres: [],
        year: null,
        author: authorMatch ? authorMatch[1].replace(/&amp;/g, "&") : "",
        status: statusMatch ? statusMatch[1] : "",
      }
    };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : "Failed" };
  }
}

export async function getWCChapters(mangaId: string): Promise<{ success: boolean; data: { chapters: any[]; totalChapters: number }; error?: string }> {
  try {
    const res = await fetch(`${WC_BASE}/series/${mangaId}/full-chapter-list`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
      next: { revalidate: 300 }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const chapters: any[] = [];
    const regex = /href="(\/chapters\/([^"]+))"[^>]*>\s*<[^>]*>\s*(?:Chapter|Ch\.|Ep\.|Episode)\s*([\d.]+)\s*<\/[^>]*>[\s\S]*?<[^>]*>\s*([^<]+)\s*<\/[^>]*>/gi;

    const seen = new Map<string, any>();
    let match;

    while ((match = regex.exec(html)) !== null) {
      const [, url, id, numStr, title] = match;
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          number: parseFloat(numStr) || 0,
          title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim() || "",
          read: false,
        });
      }
    }

    const chapterList = Array.from(seen.values()).sort((a, b) => b.number - a.number);

    return { success: true, data: { chapters: chapterList, totalChapters: chapterList.length } };
  } catch (error) {
    return { success: false, data: { chapters: [], totalChapters: 0 }, error: error instanceof Error ? error.message : "Failed" };
  }
}

export async function getWCChapterPages(chapterId: string): Promise<{ success: boolean; data: { chapterId: string; pages: string[] }; error?: string }> {
  try {
    const res = await fetch(`${WC_BASE}/chapters/${chapterId}`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
      next: { revalidate: 60 }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const pages: string[] = [];
    const imgRegex = /data-src="([^"]+\.(?:jpg|jpeg|png|webp))"/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      pages.push(match[1].replace(/&amp;/g, "&"));
    }

    if (pages.length === 0) {
      const srcRegex = /src="([^"]+\.(?:jpg|jpeg|png|webp))"[^>]*class="[^"]*(?:page|image)[^"]*"/gi;
      while ((match = srcRegex.exec(html)) !== null) {
        const src = match[1].replace(/&amp;/g, "&");
        if (!src.includes("logo") && !src.includes("icon") && !src.includes("avatar")) {
          pages.push(src);
        }
      }
    }

    if (pages.length === 0) {
      const allImg = /<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"[^>]*>/gi;
      while ((match = allImg.exec(html)) !== null) {
        const src = match[1].replace(/&amp;/g, "&");
        if (!src.includes("logo") && !src.includes("icon") && !src.includes("avatar") && !src.includes("banner")) {
          pages.push(src);
        }
      }
    }

    return pages.length > 0
      ? { success: true, data: { chapterId, pages } }
      : { success: false, data: { chapterId, pages: [] }, error: "No images found" };
  } catch (error) {
    return { success: false, data: { chapterId, pages: [] }, error: error instanceof Error ? error.message : "Failed" };
  }
}