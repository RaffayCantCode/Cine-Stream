import { NextRequest } from "next/server";

// Manga chapters using AniList for metadata
// For reading, we'll use MangaDex embed

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get manga details from AniList
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

    // Generate mock chapters based on chapter count
    const chapterCount = m.chapters || 10;
    const chapters = [];
    for (let i = chapterCount; i >= 1; i--) {
      chapters.push({
        id: `${id}-chapter-${i}`,
        number: i,
        title: `Chapter ${i}`,
        read: false,
      });
    }

    return Response.json({
      success: true,
      data: {
        chapters,
        totalChapters: chapterCount,
        manga: {
          id: String(m.id),
          name: m.title.english || m.title.userPreferred,
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
