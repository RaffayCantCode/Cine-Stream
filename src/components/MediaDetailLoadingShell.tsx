"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { declarePageReady } from "@/lib/pageLoad";
import {
  getMediaPreview,
  type MediaPreview,
  type PreviewMediaType,
} from "@/lib/media-preview-cache";

function tmdbImage(path: string | null | undefined, size: string): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Instant shell for `/movie/[id]` and `/tv/[id]`.
 *
 * The route stays server-rendered (for metadata + SEO), but this boundary is
 * committed immediately on navigation. It paints the real poster/backdrop from
 * the card the visitor just clicked, so the page opens right away while the
 * full details stream in.
 */
export function MediaDetailLoadingShell({
  mediaType,
}: {
  mediaType: PreviewMediaType;
}) {
  const params = useParams();
  const id = String(params?.id ?? "");
  const [preview, setPreview] = useState<MediaPreview | null>(null);

  useEffect(() => {
    setPreview(getMediaPreview(mediaType, id));
    // The shell is the page as far as the visitor is concerned; dismiss the
    // full-screen navigation loader so they can see it immediately.
    declarePageReady();
  }, [mediaType, id]);

  const backdrop =
    tmdbImage(preview?.backdropPath, "w1280") ||
    tmdbImage(preview?.posterPath, "w780");
  const poster = tmdbImage(preview?.posterPath, "w342");
  const year = preview?.releaseDate ? preview.releaseDate.slice(0, 4) : null;

  return (
    <div className="min-h-screen bg-[#07080d] text-white pb-24 overflow-x-clip">
      <Sidebar />

      <main className="relative z-10 w-full bleed-header">
        <div className="relative w-full min-h-[560px] sm:min-h-[600px] md:h-[75vh] md:min-h-[540px] flex flex-col justify-end overflow-hidden">
          {backdrop ? (
            <img
              src={backdrop}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center md:object-top scale-[1.03] opacity-90"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              aria-hidden
            />
          ) : (
            <div className="absolute inset-0 bg-white/[0.04] animate-pulse" />
          )}

          <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#07080d] via-[#07080d]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07080d]/85 via-[#07080d]/30 to-transparent" />
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

          <div className="relative z-10 w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-[calc(6rem+env(safe-area-inset-top))] md:pt-16 pb-6 md:pb-8">
            <div className="w-full flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
              {poster && (
                <div className="hidden md:block shrink-0">
                  <img
                    src={poster}
                    alt=""
                    className="w-44 sm:w-48 md:w-52 lg:w-60 rounded-2xl shadow-2xl ring-1 ring-white/10 aspect-[2/3] object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>
              )}

              <div className="flex-1 w-full space-y-3 sm:space-y-3.5">
                {preview?.title ? (
                  <h1 className="font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight tracking-tight mb-1">
                    {preview.title}
                  </h1>
                ) : (
                  <div className="h-12 w-3/4 max-w-xl bg-white/10 rounded-lg animate-pulse" />
                )}

                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                  <div className="h-7 w-16 bg-white/10 rounded-xl animate-pulse" />
                  {year ? (
                    <span className="px-2.5 py-1 rounded-xl bg-white/[0.08] border border-white/15 text-white text-xs sm:text-sm font-extrabold">
                      {year}
                    </span>
                  ) : (
                    <div className="h-7 w-14 bg-white/10 rounded-xl animate-pulse" />
                  )}
                  <div className="h-7 w-20 bg-white/10 rounded-xl animate-pulse" />
                </div>

                {preview?.overview ? (
                  <p className="text-white/65 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl line-clamp-3">
                    {preview.overview}
                  </p>
                ) : (
                  <div className="space-y-2 max-w-2xl">
                    <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-11/12 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-2/3 bg-white/10 rounded animate-pulse" />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <div className="h-12 w-32 bg-white/10 rounded-xl animate-pulse" />
                  <div className="h-12 w-24 bg-white/10 rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 xl:px-14 mt-8 space-y-12">
          <div className="space-y-4">
            <div className="h-5 w-28 bg-white/10 rounded animate-pulse" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-20 h-20 rounded-full bg-white/[0.06] animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] w-full rounded-xl bg-white/[0.05] animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
