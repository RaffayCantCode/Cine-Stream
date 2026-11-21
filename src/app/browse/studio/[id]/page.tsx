"use client";
export const runtime = "edge";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, Film, Tv, ArrowLeft } from "lucide-react";
import { BrowseGridPage } from "@/components/BrowseGridPage";

function StudioHubContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studioId = String(params.id || "");
  const studioName = searchParams.get("name") || `Studio #${studioId}`;
  const initialType = searchParams.get("type") === "tv" ? "tv" : "movie";
  const [mediaType, setMediaType] = useState<"movie" | "tv">(initialType);

  const endpoint =
    mediaType === "movie"
      ? `/api/tmdb/discover/movies?withCompanies=${encodeURIComponent(studioId)}`
      : `/api/tmdb/discover/tv?withCompanies=${encodeURIComponent(studioId)}`;

  return (
    <div className="relative">
      <div className="pt-20 md:pt-28 lg:pt-32 px-5 md:px-10 lg:px-12 max-w-[1460px] mx-auto flex items-center justify-between flex-wrap gap-3 -mb-16 relative z-20">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 backdrop-blur-xl text-xs font-bold text-white/80 hover:text-white transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-black uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>Production Studio Hub</span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setMediaType("movie")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              mediaType === "movie"
                ? "bg-white text-black shadow-md"
                : "text-white/65 hover:text-white"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Movies</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaType("tv")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              mediaType === "tv"
                ? "bg-white text-black shadow-md"
                : "text-white/65 hover:text-white"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>TV Series</span>
          </button>
        </div>
      </div>

      <BrowseGridPage
        key={`${studioId}-${mediaType}`}
        title={studioName}
        description={`Browse all ${mediaType === "movie" ? "movies" : "TV series"} produced by ${studioName}`}
        endpoint={endpoint}
        mediaType={mediaType}
      />
    </div>
  );
}

export default function StudioHubPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <StudioHubContent />
    </Suspense>
  );
}
