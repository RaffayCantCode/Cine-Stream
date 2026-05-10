import { NextRequest } from "next/server";
import * as MangaDex from "@/lib/mangadex-fetch";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") || "popular";
  const page = parseInt(searchParams.get("page") || "1", 10);

  try {
    let data: any;

    if (category === "popular") {
      data = await MangaDex.getPopularManga();
    } else if (category === "latest") {
      data = await MangaDex.getLatestManga();
    } else if (category === "search") {
      const query = searchParams.get("q") || "";
      data = await MangaDex.searchManga(query);
    } else {
      data = await MangaDex.getPopularManga();
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