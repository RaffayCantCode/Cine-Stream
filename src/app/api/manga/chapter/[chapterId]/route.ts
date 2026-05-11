import { NextRequest } from "next/server";

const MANGADEX_API = "https://api.mangadex.org";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const { chapterId } = await params;

  try {
    const res = await fetch(`${MANGADEX_API}/at-home/server/${chapterId}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`MangaDex at-home failed: ${res.status}`);
    }

    const data = await res.json();
    const baseUrl = data.baseUrl;
    const hash = data.chapter?.hash;
    const files: string[] = data.chapter?.data || [];

    if (!baseUrl || !hash || files.length === 0) {
      throw new Error("No readable pages found for this chapter");
    }

    const pages = files.map((file) => `${baseUrl}/data/${hash}/${file}`);

    return Response.json({
      success: true,
      data: {
        chapterId,
        pages,
        baseUrl,
        hash,
      },
    });
  } catch (error) {
    console.error("[Manga Reader Error]:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load chapter pages", success: false },
      { status: 500 }
    );
  }
}

