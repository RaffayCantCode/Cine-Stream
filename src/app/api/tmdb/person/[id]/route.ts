export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch, cacheHeaders } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await tmdbFetch(`/person/${id}?language=en-US&append_to_response=combined_credits`);
    return NextResponse.json(data, { headers: cacheHeaders(86400) });
  } catch (error) {
    console.error(`Person error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch person" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
