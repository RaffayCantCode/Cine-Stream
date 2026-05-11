// Manga API - Using AniList which has manga with proper covers
const ANILIST_API = "https://graphql.anilist.co";

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

export async function getPopularManga(): Promise<any> {
  const query = `
    query {
      Page(perPage: 24) {
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
          startDate
          format
        }
      }
    }
  `;
  
  const data = await fetchAniList(query);
  const items = data.Page.media.map((m: any) => ({
    id: String(m.id),
    name: m.title.english || m.title.userPreferred,
    jname: m.title.native,
    poster: m.coverImage?.large || m.coverImage?.medium || "",
    description: m.description?.replace(/<[^>]*>/g, "") || "",
    type: m.format,
    genres: m.genres || [],
    rating: m.averageScore ? String(m.averageScore) : null,
    year: m.startDate ? parseInt(m.startDate) : null,
    chapters: m.chapters,
  }));
  
  return { success: true, data: items };
}

export async function getLatestManga(): Promise<any> {
  const query = `
    query {
      Page(perPage: 24) {
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
          startDate
          format
        }
      }
    }
  `;
  
  const data = await fetchAniList(query);
  const items = data.Page.media.map((m: any) => ({
    id: String(m.id),
    name: m.title.english || m.title.userPreferred,
    jname: m.title.native,
    poster: m.coverImage?.large || m.coverImage?.medium || "",
    description: m.description?.replace(/<[^>]*>/g, "") || "",
    type: m.format,
    genres: m.genres || [],
    rating: m.averageScore ? String(m.averageScore) : null,
    year: m.startDate ? parseInt(m.startDate) : null,
    chapters: m.chapters,
  }));
  
  return { success: true, data: items };
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
          startDate
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
    year: m.startDate ? parseInt(m.startDate) : null,
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
        startDate
        format
        authors { nodes { name } }
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
      year: m.startDate ? parseInt(m.startDate) : null,
      chapters: m.chapters,
      author: m.authors?.nodes?.[0]?.name || "Unknown",
    },
  };
}