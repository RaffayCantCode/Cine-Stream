import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const tmdbId = request.nextUrl.searchParams.get("tmdbId");
  const type = request.nextUrl.searchParams.get("type") || "tv";
  const title = request.nextUrl.searchParams.get("title") || "";
  const autoplay = request.nextUrl.searchParams.get("autoplay");

  if (!tmdbId) return NextResponse.redirect(new URL("/", request.url));

  try {
    // Try to get AniList ID from AniZip
    const aniZipRes = await fetch(`https://api.ani.zip/mappings?themoviedb_id=${tmdbId}`);
    if (aniZipRes.ok) {
      const data = await aniZipRes.json();
      const anilistId = data?.mappings?.anilist_id;
      if (anilistId) {
        return NextResponse.redirect(new URL(`/anime/${anilistId}${autoplay ? '?autoplay=1' : ''}`, request.url));
      }
    }

    // Fallback: search by title
    if (title) {
       const searchRes = await fetch(`https://api.tatakai.me/meta/anilist/advanced-search?query=${encodeURIComponent(title)}`);
       if (searchRes.ok) {
         const data = await searchRes.json();
         const first = data?.results?.[0];
         if (first && first.id) {
           return NextResponse.redirect(new URL(`/anime/${first.id}${autoplay ? '?autoplay=1' : ''}`, request.url));
         }
       }
    }
  } catch (e) {
    console.error("Redirect error", e);
  }

  // Ultimate fallback, just go to the TMDB page
  return NextResponse.redirect(new URL(`/${type}/${tmdbId}${autoplay ? '?autoplay=1' : ''}`, request.url));
}
