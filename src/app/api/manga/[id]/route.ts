import { NextRequest } from "next/server";
import * as MangaDex from "@/lib/mangadex-fetch";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await MangaDex.getMangaDetails(id);
    return Response.json(data);
  } catch (error) {
    console.error("[Manga Details Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch manga details", success: false },
      { status: 500 }
    );
  }
}
