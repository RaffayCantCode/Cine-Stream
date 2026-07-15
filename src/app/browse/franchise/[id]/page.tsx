"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { CinematicHero } from "@/components/CinematicHero";
import { GridMediaCard } from "@/components/GridMediaCard";
import { Loader2, ArrowLeft } from "lucide-react";
import { fetchJson } from "@/lib/utils";

interface Collection {
  id: string | number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: any[];
  groups?: { name: string; parts: any[] }[];
}

export default function FranchisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const load = async () => {
      try {
        const data = await fetchJson<Collection>(`/api/tmdb/collection/${id}?v=franchise-complete-v2`, { skipCache: true });
        setCollection(data);
      } catch (err) {
        setError("Failed to load franchise");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Sidebar />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Sidebar />
        <p className="text-white/50">{error || "Collection not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 bleed-header">
        <CinematicHero
          backdropPath={collection.backdrop_path}
          title={collection.name}
          theme="movie"
        >
          <div className="pb-12 px-5 md:px-10 w-full max-w-screen-2xl mx-auto">
            <Link 
              href="/browse/franchises"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white rounded-full text-sm font-medium transition-all mb-6 border border-white/10 hover:border-white/20 w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Franchises
            </Link>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4">
              {collection.name}
            </h1>
            {collection.overview && (
              <p className="text-white/70 max-w-2xl text-sm md:text-base leading-relaxed">
                {collection.overview}
              </p>
            )}
          </div>
        </CinematicHero>

        <div className="max-w-screen-2xl mx-auto px-5 md:px-10 pb-10 pt-8">
          {collection.groups && collection.groups.length > 0 ? (
            <div className="flex flex-col gap-12">
              {collection.groups.map((group, gIdx) => (
                <div key={gIdx}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-5 bg-primary rounded-full" />
                    <h2 className="text-xl font-bold tracking-tight text-white">{group.name}</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                    {group.parts.map((item, index) => (
                      <GridMediaCard key={item.id} item={item} index={index} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 bg-primary rounded-full" />
                <h2 className="text-xl font-bold tracking-tight text-white">Chronological Order</h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                {collection.parts.map((item, index) => (
                  <GridMediaCard key={item.id} item={item} index={index} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
