export const runtime = 'edge';
import { Metadata } from "next";
import { constructMediaMetadata } from "@/lib/social-preview";
import MangaHomeClient from "./MangaHomeClient";

export const metadata: Metadata = constructMediaMetadata({
  title: "Manga & Manhwa",
  overview: "Read thousands of popular manga, Korean manhwa webtoons, and manhua online in full color with zero ads on CineStream.",
  type: "website",
  urlPath: "/manga",
  fallbackDescription: "Read manga and manhwa online on CineStream.",
});

export default function MangaPage() {
  return <MangaHomeClient />;
}
