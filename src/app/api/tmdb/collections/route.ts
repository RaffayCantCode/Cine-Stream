export const runtime = 'edge';
import { NextResponse } from "next/server";
import { FRANCHISES } from "@/lib/franchises";

export async function GET() {
  try {
    // Return our custom defined franchises
    // Formatting them slightly to match what the frontend expects
    const collections = FRANCHISES.map(f => ({
      id: f.id,
      name: f.name,
      overview: f.overview,
      poster_path: f.poster_path,
      backdrop_path: f.backdrop_path,
    }));

    return NextResponse.json({ collections });
  } catch (error) {
    console.error("Collections error:", error);
    return NextResponse.json({ collections: [] }, { status: 500 });
  }
}
