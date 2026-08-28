export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import type { Metadata } from "next";
import { getMangaDetails, getMangaChapters, getChapterPages } from "@/lib/manga-fetch";
import { constructMediaMetadata } from "@/lib/social-preview";
import { Suspense } from "react";
import MangaReaderClient from "./MangaReaderClient";

export async function generateMetadata(
  props: { params: Promise<{ id: string; chapterId: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const { id, chapterId } = params;

  try {
    const manga = await getMangaDetails(id);
    if (manga) {
      const typeLabel = manga.type === "manhwa" ? "Manhwa" : manga.type === "manhua" ? "Manhua" : "Manga";
      return constructMediaMetadata({
        title: `Read ${manga.title || "Manga"}`,
        overview: typeof manga.description === "string" ? manga.description : `Read ${manga.title} online in high definition on CineStream with all chapters.`,
        posterPath: typeof manga.coverImage === "string" ? manga.coverImage : null,
        backdropPath: typeof manga.coverImage === "string" ? manga.coverImage : null,
        mediaTypeLabel: typeLabel,
        type: "website",
        urlPath: `/manga/${id}/read/${chapterId}`,
        fallbackDescription: `Read ${manga.title || "manga"} online on CineStream with zero ads.`,
      });
    }
  } catch (err) {
    console.warn(`[generateMetadata] Error for chapter ${chapterId}:`, err);
  }

  return constructMediaMetadata({
    title: "Manga Reader",
    mediaTypeLabel: "Manga",
    type: "website",
    urlPath: `/manga/${id}/read/${chapterId}`,
    fallbackDescription: "Read full manga and manhwa online on CineStream.",
  });
}

export default async function MangaReaderPage(
  props: { params: Promise<{ id: string; chapterId: string }> }
) {
  const params = await props.params;
  const { id, chapterId } = params;

  const [detailsRes, chaptersRes, pagesRes] = await Promise.allSettled([
    getMangaDetails(id),
    getMangaChapters(id, { order: "asc", limit: 500 }),
    getChapterPages(chapterId),
  ]);

  const initialManga = detailsRes.status === "fulfilled" ? detailsRes.value : null;
  const initialChapters = chaptersRes.status === "fulfilled" ? chaptersRes.value?.chapters || [] : [];
  const initialPages = pagesRes.status === "fulfilled" ? pagesRes.value : null;

  return (
    <Suspense fallback={null}>
      <MangaReaderClient
        mangaId={id}
        chapterId={chapterId}
        initialManga={initialManga}
        initialChapters={initialChapters}
        initialPages={initialPages}
      />
    </Suspense>
  );
}
