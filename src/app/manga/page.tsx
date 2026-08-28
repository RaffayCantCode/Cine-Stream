export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import type { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import MangaHomeClient from "./MangaHomeClient";

export const metadata: Metadata = constructMediaMetadata({
  title: "Manga & Manhwa",
  overview: "Read thousands of popular manga, Korean manhwa webtoons, and manhua online in full color with zero ads on CineStream.",
  mediaTypeLabel: "Manga",
  type: "website",
  urlPath: "/manga",
  fallbackDescription: "Read manga and manhwa online on CineStream with zero ads.",
});

export default function MangaPage() {
  return <MangaHomeClient />;
}

