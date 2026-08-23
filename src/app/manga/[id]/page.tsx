export const runtime = 'edge';
import { Metadata } from "next";
import { getMangaDetails } from "@/lib/manga-fetch";
import { constructMediaMetadata } from "@/lib/social-preview";
import MangaDetailsClient from "./MangaDetailsClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const id = params.id;

  try {
    const manga = await getMangaDetails(id);
    if (manga) {
      const typeLabel = manga.type === "manhwa" ? "Manhwa" : manga.type === "manhua" ? "Manhua" : "Manga";
      return constructMediaMetadata({
        title: `${manga.title} (${typeLabel})`,
        overview: manga.description,
        posterPath: manga.coverImage,
        backdropPath: manga.coverImage,
        type: "website",
        urlPath: `/manga/${id}`,
        fallbackDescription: `Read ${manga.title} online in full color on CineStream with all chapters.`,
      });
    }
  } catch (err) {
    console.warn(`[generateMetadata] Error for manga ${id}:`, err);
  }

  return constructMediaMetadata({
    title: "Manga & Manhwa",
    type: "website",
    urlPath: `/manga/${id}`,
    fallbackDescription: "Read full manga and manhwa webtoons online on CineStream.",
  });
}

export default async function MangaDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <MangaDetailsClient id={params.id} />;
}
