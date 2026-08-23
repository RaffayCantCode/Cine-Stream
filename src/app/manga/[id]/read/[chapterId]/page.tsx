export const runtime = 'edge';
import { Metadata } from "next";
import { getMangaDetails } from "@/lib/manga-fetch";
import { constructMediaMetadata } from "@/lib/social-preview";
import MangaReaderClient from "./MangaReaderClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string; chapterId: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const { id, chapterId } = params;

  try {
    const manga = await getMangaDetails(id);
    if (manga) {
      return constructMediaMetadata({
        title: `Read ${manga.title}`,
        overview: `Read ${manga.title} online in high definition on CineStream.`,
        posterPath: manga.coverImage,
        type: "website",
        urlPath: `/manga/${id}/read/${chapterId}`,
        fallbackDescription: `Read ${manga.title} online on CineStream.`,
      });
    }
  } catch (err) {
    console.warn(`[generateMetadata] Error for chapter ${chapterId}:`, err);
  }

  return constructMediaMetadata({
    title: "Manga Reader",
    type: "website",
    urlPath: `/manga/${id}/read/${chapterId}`,
    fallbackDescription: "Read full manga and manhwa online on CineStream.",
  });
}

export default async function MangaReaderPage(
  props: { params: Promise<{ id: string; chapterId: string }> }
) {
  const params = await props.params;
  return <MangaReaderClient mangaId={params.id} chapterId={params.chapterId} />;
}
