export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import {
  getMangaTrending,
  getPopularManhwa,
  getLatestMangaUpdates,
  searchManga,
  getMangaDetails,
  getMangaChapters,
  getChapterPages,
} from "@/lib/manga-fetch";

function jsonWithCache(data: any, sMaxAge = 1800, staleWhileRevalidate = 86400, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    },
  });
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ route: string[] }> }
) {
  const { route } = await props.params;
  const action = route[0];
  const searchParams = request.nextUrl.searchParams;

  if (action === "trending") {
    try {
      const limit = parseInt(searchParams.get("limit") || "24", 10);
      const items = await getMangaTrending(limit);
      return jsonWithCache({ success: true, items }, 1800);
    } catch (err: any) {
      console.error("[API/Manga] trending error:", err);
      return jsonWithCache({ success: true, items: [] }, 60);
    }
  }

  if (action === "manhwa") {
    try {
      const limit = parseInt(searchParams.get("limit") || "24", 10);
      const items = await getPopularManhwa(limit);
      return jsonWithCache({ success: true, items }, 1800);
    } catch (err: any) {
      console.error("[API/Manga] manhwa error:", err);
      return jsonWithCache({ success: true, items: [] }, 60);
    }
  }

  if (action === "latest") {
    try {
      const limit = parseInt(searchParams.get("limit") || "24", 10);
      const items = await getLatestMangaUpdates(limit);
      return jsonWithCache({ success: true, items }, 1800);
    } catch (err: any) {
      console.error("[API/Manga] latest error:", err);
      return jsonWithCache({ success: true, items: [] }, 60);
    }
  }

  if (action === "search") {
    try {
      const query = searchParams.get("q") || "";
      const type = (searchParams.get("type") || "all") as any;
      const limit = parseInt(searchParams.get("limit") || "24", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      const sortBy = (searchParams.get("sortBy") || "followedCount") as any;
      const genreId = searchParams.get("genreId") || undefined;
      const genreName = searchParams.get("genreName") || undefined;

      const data = await searchManga(query, { type, limit, offset, sortBy, genreId, genreName });
      return jsonWithCache({ success: true, ...data }, 1200);
    } catch (err: any) {
      console.error("[API/Manga] search error:", err);
      return jsonWithCache({ success: true, items: [], total: 0 }, 60);
    }
  }

  if (action === "details" && route[1]) {
    try {
      const id = route[1];
      const item = await getMangaDetails(id);
      if (!item) {
        return NextResponse.json({ success: false, error: "Manga not found" }, { status: 404 });
      }
      return jsonWithCache({ success: true, item }, 1800);
    } catch (err: any) {
      console.error("[API/Manga] details error:", err);
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
  }

  if (action === "chapters" && route[1]) {
    try {
      const id = route[1];
      const order = (searchParams.get("order") || "asc") as "asc" | "desc";
      const limit = parseInt(searchParams.get("limit") || "500", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);

      const data = await getMangaChapters(id, { order, limit, offset });
      return jsonWithCache({ success: true, ...data }, 900);
    } catch (err: any) {
      console.error("[API/Manga] chapters error:", err);
      return jsonWithCache({ success: true, chapters: [], total: 0 }, 60);
    }
  }

  if (action === "chapter" && route[1]) {
    try {
      const chapterId = route[1];
      const mangaTitle = searchParams.get("title") || undefined;
      const chapterNumber = searchParams.get("ch") || undefined;
      const data = await getChapterPages(chapterId, mangaTitle, chapterNumber);
      if (!data) {
        return NextResponse.json({ success: false, error: "Chapter pages not found" }, { status: 404 });
      }
      return jsonWithCache({ success: true, ...data }, 1800);
    } catch (err: any) {
      console.error("[API/Manga] chapter error:", err);
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
