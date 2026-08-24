export const runtime = 'edge';
export const revalidate = 1800;

import { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import { getMangaTrending, getPopularManhwa, getLatestMangaUpdates } from "@/lib/manga-fetch";
import MangaHomeClient from "./MangaHomeClient";

export const metadata: Metadata = constructMediaMetadata({
  title: "Manga & Manhwa",
  overview: "Read thousands of popular manga, Korean manhwa webtoons, and manhua online in full color with zero ads on CineStream.",
  type: "website",
  urlPath: "/manga",
  fallbackDescription: "Read manga and manhwa online on CineStream.",
});

export default async function MangaPage() {
  const [trendingRes, manhwasRes, mangasRes] = await Promise.allSettled([
    getMangaTrending(32),
    getPopularManhwa(32),
    getLatestMangaUpdates(32),
  ]);

  const initialTrending = trendingRes.status === "fulfilled" ? trendingRes.value : [];
  const initialManhwas = manhwasRes.status === "fulfilled" ? manhwasRes.value : [];
  const initialMangas = mangasRes.status === "fulfilled" ? mangasRes.value : [];

  return (
    <MangaHomeClient
      initialTrending={initialTrending}
      initialManhwas={initialManhwas}
      initialMangas={initialMangas}
    />
  );
}
