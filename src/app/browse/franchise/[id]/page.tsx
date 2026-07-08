"use client";
export const runtime = 'edge';

import { useState, useEffect, use } from "react";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { GridMediaCard } from "@/components/GridMediaCard";
import { Loader2 } from "lucide-react";
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
        const data = await fetchJson<Collection>(`/api/tmdb/collection/${id}`);
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
        {collection.backdrop_path && (
          <div className="relative w-full h-[40vh] md:h-[50vh] min-h-[300px]">
            <img
              src={`https://image.tmdb.org/t/p/w1280${collection.backdrop_path}`}
              alt={collection.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 md:p-10 max-w-screen-2xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4">
                {collection.name}
              </h1>
              {collection.overview && (
                <p className="text-white/70 max-w-2xl text-sm md:text-base leading-relaxed">
                  {collection.overview}
                </p>
              )}
            </div>
          </div>
        )}

        <div className={`max-w-screen-2xl mx-auto px-5 md:px-10 pb-10 ${collection.backdrop_path ? "pt-8" : "pt-24"}`}>
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
