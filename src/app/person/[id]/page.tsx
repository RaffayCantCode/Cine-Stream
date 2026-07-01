"use client";

import { useState, useEffect, use, useMemo } from "react";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { GridMediaCard } from "@/components/GridMediaCard";
import { Loader2, User } from "lucide-react";
import { fetchJson } from "@/lib/utils";
import { useContentMode } from "@/context/ContentModeContext";

interface Person {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  known_for_department: string;
  birthday: string | null;
  place_of_birth: string | null;
  combined_credits: {
    cast: any[];
    crew: any[];
  };
}

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useContentMode();
  const [person, setPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchJson<Person>(`/api/tmdb/person/${id}`);
        setPerson(data);
      } catch (err) {
        setError("Failed to load person");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const sortedCredits = useMemo(() => {
    if (!person?.combined_credits?.cast) return [];
    
    // Filter duplicates (sometimes an actor is listed twice for the same movie)
    const seen = new Set<number>();
    let filtered = person.combined_credits.cast.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return item.poster_path || item.backdrop_path;
    });

    // Sort by year (newest first)
    filtered.sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || "";
      const dateB = b.release_date || b.first_air_date || "";
      
      if (dateA && dateB) {
        const timeA = new Date(dateA).getTime();
        const timeB = new Date(dateB).getTime();
        if (timeA !== timeB) return timeB - timeA;
      }
      if (dateA && !dateB) return -1; // Items with dates come first
      if (!dateA && dateB) return 1;
      
      // Fallback to popularity if no dates or dates match
      return (b.popularity || 0) - (a.popularity || 0);
    });
    
    return filtered;
  }, [person, mode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Sidebar />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Sidebar />
        <p className="text-white/50">{error || "Person not found"}</p>
      </div>
    );
  }

  const profileUrl = person.profile_path
    ? `https://image.tmdb.org/t/p/w300${person.profile_path}`
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Sidebar />
      <main className="md:pl-56 lg:pl-64 bleed-header">
        
        {/* Profile Header */}
        <div className="w-full bg-[#111844]/20 border-b border-white/[0.05] pt-24 pb-12 px-5 md:px-10">
          <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row gap-8 items-start md:items-center">
            
            <div className="shrink-0 w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-[#4B5694]/30 shadow-2xl bg-muted flex items-center justify-center relative">
              {profileUrl ? (
                <img
                  src={profileUrl}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-white/30" />
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
                {person.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-white/50 mb-4">
                {person.known_for_department && <span>{person.known_for_department}</span>}
                {person.birthday && (
                  <span className="flex items-center before:content-['•'] before:mr-4 before:text-white/20">
                    {new Date(person.birthday).toLocaleDateString()}
                  </span>
                )}
                {person.place_of_birth && (
                  <span className="flex items-center before:content-['•'] before:mr-4 before:text-white/20">
                    {person.place_of_birth}
                  </span>
                )}
              </div>
              
              {person.biography && (
                <div className="max-w-3xl">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Biography</h3>
                  <p className="text-white/70 text-sm leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                    {person.biography}
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Filmography Grid */}
        <div className="max-w-screen-2xl mx-auto px-5 md:px-10 pt-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-white">Filmography</h2>
          </div>
          
          {sortedCredits.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
              {sortedCredits.map((item, index) => (
                <GridMediaCard key={`${item.id}-${item.media_type}`} item={item} index={index} />
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-sm">No titles found for the current mode.</p>
          )}
        </div>

      </main>
    </div>
  );
}
