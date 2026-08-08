export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { clearAnimeCatalogCache } from "@/lib/anime/catalog";
import { clearAnimeFillerListCache } from "@/lib/anime/animefillerlist";

export async function GET() {
  clearAnimeCatalogCache();
  clearAnimeFillerListCache();
  return NextResponse.json({ success: true, message: "Anime server-side caches cleared successfully." });
}

export async function POST() {
  clearAnimeCatalogCache();
  clearAnimeFillerListCache();
  return NextResponse.json({ success: true, message: "Anime server-side caches cleared successfully." });
}
