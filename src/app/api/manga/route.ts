import { NextRequest } from "next/server";
import * as MangaDex from "@/lib/mangadex-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") || "popular";

  try {
    let data: any;

    if (category === "popular") {
      data = await MangaDex.getPopularManga(0, 24);
    } else if (category === "latest") {
      data = await MangaDex.getLatestManga(0, 24);
    } else if (category === "search") {
      const query = searchParams.get("q") || "";
      data = await MangaDex.searchManga(query, 0, 24);
    } else {
      data = await MangaDex.getPopularManga(0, 24);
    }

    return Response.json(data);
  } catch (error) {
    console.error("[Manga API Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}