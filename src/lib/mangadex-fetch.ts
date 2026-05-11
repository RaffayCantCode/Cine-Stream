// Manga API - Using AniList which has manga with proper covers
const ANILIST_API = "https://graphql.anilist.co";

function isAdultManga(name?: string, genres?: string[], description?: string): boolean {
  const ADULT_GENRES = ["hentai", "ecchi", "erotica", "pornographic", "smut", "adult", "boys love", "girls love"];
  const ADULT_KEYWORDS = ["hentai", "ecchi", "nude", "naked", "porn", "sex", "erotic", "18+", "adult", "xxx", "nsfw", "explicit", "yaoi", "yuri", "bl", "gl"];
  
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

export async function getPopularManga(page: number = 1): Promise<any> {
  const query = `
    query($page: Int) {
      Page(perPage: 24, page: $page) {
        media(type: MANGA, sort: POPULARITY_DESC) {
          id
          title { userPreferred english native }
          coverImage { large medium }
          description
          type
          status
          chapters
          genres
          averageScore
          startDate { year }
          format
        }
        pageInfo { hasNextPage }
      }
    }
  `;
  
  const data = await fetchAniList(query, { page });
  const items = data.Page.media
    .filter((m: any) => !isAdultManga(m.title?.english || m.title?.userPreferred, m.genres, m.description))
    .map((m: any) => ({
      id: String(m.id),
      name: m.title.english || m.title.userPreferred,
      jname: m.title.native,
      poster: m.coverImage?.large || m.coverImage?.medium || "",
      description: m.description?.replace(/<[^>]*>/g, "") || "",
      type: m.format,
      genres: m.genres || [],
      rating: m.averageScore ? String(m.averageScore) : null,
      year: m.startDate?.year || null,
      chapters: m.chapters,
    }));
  
  return { success: true, data: items, hasMore: data.Page.pageInfo?.hasNextPage || false };
}

export async function getLatestManga(page: number = 1): Promise<any> {
  const query = `
    query($page: Int) {
      Page(perPage: 24, page: $page) {
        media(type: MANGA, sort: UPDATED_AT_DESC) {
          id
          title { userPreferred english native }
          coverImage { large medium }
          description
          type
          status
          chapters
          genres
          averageScore
          startDate { year }
          format
        }
        pageInfo { hasNextPage }
      }
    }
  `;
  
  const data = await fetchAniList(query, { page });
  const items = data.Page.media.map((m: any) => ({
    id: String(m.id),
    name: m.title.english || m.title.userPreferred,
    jname: m.title.native,
    poster: m.coverImage?.large || m.coverImage?.medium || "",
    description: m.description?.replace(/<[^>]*>/g, "") || "",
    type: m.format,
    genres: m.genres || [],
    rating: m.averageScore ? String(m.averageScore) : null,
    year: m.startDate?.year || null,
    chapters: m.chapters,
  }));
  
  return { success: true, data: items, hasMore: data.Page.pageInfo?.hasNextPage || false };
}

export async function searchManga(query: string): Promise<any> {
  const searchQuery = `
    query($search: String!) {
      Page(perPage: 24, search: $search) {
        media(type: MANGA) {
          id
          title { userPreferred english native }
          coverImage { large medium }
          description
          type
          status
          chapters
          genres
          averageScore
          startDate { year }
          format
        }
      }
    }
  `;
  
  const data = await fetchAniList(searchQuery, { search: query });
  const items = data.Page.media.map((m: any) => ({
    id: String(m.id),
    name: m.title.english || m.title.userPreferred,
    jname: m.title.native,
    poster: m.coverImage?.large || m.coverImage?.medium || "",
    description: m.description?.replace(/<[^>]*>/g, "") || "",
    type: m.format,
    genres: m.genres || [],
    rating: m.averageScore ? String(m.averageScore) : null,
    year: m.startDate?.year || null,
    chapters: m.chapters,
  }));
  
  return { success: true, data: items };
}

export async function getMangaDetails(mangaId: string): Promise<any> {
  const query = `
    query($id: Int!) {
      Media(id: $id, type: MANGA) {
        id
        title { userPreferred english native }
        coverImage { large medium }
        description
        type
        status
        chapters
        genres
        averageScore
        startDate { year }
        format
      }
    }
  `;
  
  const data = await fetchAniList(query, { id: parseInt(mangaId) });
  const m = data.Media;
  
  return {
    success: true,
    data: {
      id: String(m.id),
      name: m.title.english || m.title.userPreferred,
      jname: m.title.native,
      poster: (m.coverImage?.large || m.coverImage?.medium || ""),
      description: m.description?.replace(/<[^>]*>/g, "") || "",
      type: m.format,
      genres: m.genres || [],
      rating: m.averageScore ? String(m.averageScore) : null,
      year: m.startDate?.year || null,
      chapters: m.chapters,
    },
  };
}