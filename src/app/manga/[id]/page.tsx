export const runtime = 'edge';
import { Metadata } from "next";
import { getMangaDetails, getMangaChapters } from "@/lib/manga-fetch";
import { constructMediaMetadata } from "@/lib/social-preview";
import MangaDetailsClient from "./MangaDetailsClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params?.id || "";

  try {
    const manga = await getMangaDetails(id);
    if (manga) {
      const typeLabel = manga.type === "manhwa" ? "Manhwa" : manga.type === "manhua" ? "Manhua" : "Manga";
      return constructMediaMetadata({
        title: manga.title || "Manga",
        overview: typeof manga.description === "string" ? manga.description : "",
        posterPath: typeof manga.coverImage === "string" ? manga.coverImage : null,
        backdropPath: typeof manga.coverImage === "string" ? manga.coverImage : null,
        mediaTypeLabel: typeLabel,
        type: "website",
        urlPath: `/manga/${id}`,
        fallbackDescription: `Read ${manga.title || "manga"} online in full color on CineStream with all chapters.`,
      });
    }
  } catch (err) {
    console.warn(`[generateMetadata] Error for manga ${id}:`, err);
  }

  return constructMediaMetadata({
    title: "Manga & Manhwa",
    mediaTypeLabel: "Manga",
    type: "website",
    urlPath: `/manga/${id}`,
    fallbackDescription: "Read full manga and manhwa webtoons online on CineStream.",
  });
}

export const revalidate = 1800;

export default async function MangaDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params?.id || "";

  const [detailsRes, chaptersRes] = await Promise.allSettled([
    getMangaDetails(id),
    getMangaChapters(id, { order: "asc", limit: 500 }),
  ]);

  const initialManga = detailsRes.status === "fulfilled" ? detailsRes.value : null;
  const initialChapters = chaptersRes.status === "fulfilled" ? chaptersRes.value?.chapters || [] : [];

  return (
    <MangaDetailsClient
      id={id}
      initialManga={initialManga}
      initialChapters={initialChapters}
    />
  );
}
