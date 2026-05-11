const MANGADEX_API = "https://api.mangadex.org";

function pickTitle(attributes: any): string {
  const en = attributes?.title?.en;
  if (en) return en;
  const values = Object.values(attributes?.title || {}) as string[];
  return values[0] || "Untitled";
}

function mapManga(item: any) {
  const attrs = item.attributes || {};
  const coverRel = (item.relationships || []).find((r: any) => r.type === "cover_art");
  const fileName = coverRel?.attributes?.fileName;
  const cover = fileName
    ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.512.jpg`
    : "";

  return {
    id: item.id,
    name: pickTitle(attrs),
    poster: cover,
    description: attrs.description?.en || "",
    type: "Manga",
    genres: [],
    year: attrs.year || null,
    author: "",
    status: attrs.status || "",
  };
}

async function fetchMangaList(params: URLSearchParams): Promise<any> {
  params.append("includes[]", "cover_art");
  params.append("contentRating[]", "safe");
  params.append("contentRating[]", "suggestive");
  params.append("limit", "24");

  const res = await fetch(`${MANGADEX_API}/manga?${params.toString()}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`MangaDex request failed: ${res.status}`);
  const data = await res.json();

  return {
    success: true,
    data: (data.data || []).map(mapManga),
    hasMore: (data.total || 0) > (data.offset || 0) + (data.limit || 24),
  };
}

export async function getPopularManga(page = 1): Promise<any> {
  const offset = (page - 1) * 24;
  const params = new URLSearchParams();
  params.append("offset", String(offset));
  params.append("order[followedCount]", "desc");
  params.append("availableTranslatedLanguage[]", "en");
  return fetchMangaList(params);
}

export async function getLatestManga(page = 1): Promise<any> {
  const offset = (page - 1) * 24;
  const params = new URLSearchParams();
  params.append("offset", String(offset));
  params.append("order[latestUploadedChapter]", "desc");
  params.append("availableTranslatedLanguage[]", "en");
  return fetchMangaList(params);
}

export async function searchManga(query: string, page = 1): Promise<any> {
  const offset = (page - 1) * 24;
  const params = new URLSearchParams();
  params.append("offset", String(offset));
  params.append("title", query);
  params.append("order[relevance]", "desc");
  params.append("availableTranslatedLanguage[]", "en");
  return fetchMangaList(params);
}

export async function getMangaDetails(mangaId: string): Promise<any> {
  const res = await fetch(
    `${MANGADEX_API}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`MangaDex details failed: ${res.status}`);
  const payload = await res.json();
  const item = payload.data;
  const mapped = mapManga(item);

  return {
    success: true,
    data: mapped,
  };
}
