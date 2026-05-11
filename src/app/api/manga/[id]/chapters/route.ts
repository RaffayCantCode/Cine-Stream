import { NextRequest } from "next/server";
import * as MangaDex from "@/lib/mangadex-fetch";

const MANGADEX_API = "https://api.mangadex.org";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [mangaDetails, chaptersRes] = await Promise.all([
      MangaDex.getMangaDetails(id),
      fetch(
        `${MANGADEX_API}/manga/${id}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=200`,
        { next: { revalidate: 300 } }
      ),
    ]);

    if (!chaptersRes.ok) {
      throw new Error(`MangaDex chapter feed failed: ${chaptersRes.status}`);
    }

    const chapterPayload = await chaptersRes.json();
    const unique = new Map<string, any>();

    for (const chapter of chapterPayload.data || []) {
      const number = chapter?.attributes?.chapter;
      if (!number) continue;
      if (!unique.has(number)) unique.set(number, chapter);
    }

    const chapters = Array.from(unique.values())
      .sort((a, b) => parseFloat(b.attributes.chapter) - parseFloat(a.attributes.chapter))
      .map((ch: any) => ({
        id: ch.id,
        number: Number(ch.attributes.chapter),
        title: ch.attributes.title || `Chapter ${ch.attributes.chapter}`,
        read: false,
      }));

    return Response.json({
      success: true,
      data: {
        chapters,
        totalChapters: chapters.length,
        manga: mangaDetails.data,
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

