export const runtime = 'edge';
"use client";

import { useState, useEffect, use, useMemo } from "react";
import dynamic from "next/dynamic";
const Sidebar = dynamic(() => import("@/components/Sidebar").then((m) => m.Sidebar), { ssr: false });
import { GridMediaCard } from "@/components/GridMediaCard";
import { Loader2, User } from "lucide-react";
import { fetchJson } from "@/lib/utils";
import { useContentMode } from "@/context/ContentModeContext";
import { ScrollableGridRow } from "@/components/ScrollableGridRow";
import { SimilarPeople } from "@/components/SimilarPeople";

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

  const allCredits = useMemo(() => {
    if (!person?.combined_credits) return [];
    const isDirector = person.known_for_department === "Directing";
    const credits = isDirector ? person.combined_credits.crew : person.combined_credits.cast;
    
    // For directors, only show what they directed
    let filtered = credits;
    if (isDirector) {
      filtered = credits.filter((c: any) => c.job === "Director" || c.job === "Series Director");
    }

    const seen = new Set<number>();
    filtered = filtered.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return item.poster_path || item.backdrop_path;
    });

    return filtered;
  }, [person]);

  const sortedByDate = useMemo(() => {
    return [...allCredits].sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || "";
      const dateB = b.release_date || b.first_air_date || "";
      if (dateA && dateB) return new Date(dateB).getTime() - new Date(dateA).getTime();
      if (dateA) return -1;
      if (dateB) return 1;
      return (b.popularity || 0) - (a.popularity || 0);
    });
  }, [allCredits]);

  const latestWorks = useMemo(() => {
    return [...sortedByDate]
      .filter((a) => {
        const date = a.release_date || a.first_air_date;
        if (!date) return false;
        return new Date(date).getTime() <= Date.now();
      })
      .slice(0, 15);
  }, [sortedByDate]);

  const mostPopular = useMemo(() => {
    return [...allCredits]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 15);
  }, [allCredits]);

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
        <div className="w-full bg-gradient-to-b from-[#111844]/40 to-background border-b border-white/[0.05] pt-24 pb-12 px-5 md:px-10">
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
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-lg">
                {person.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-white/50 mb-4">
                {person.known_for_department && <span className="bg-primary/20 text-primary px-3 py-1 rounded-full">{person.known_for_department}</span>}
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
                  <p className="text-white/70 text-sm leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                    {person.biography}
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-5 md:px-10 pt-12 space-y-16">
          
          {/* Most Popular Works */}
          <ScrollableGridRow title="Most Popular Works" items={mostPopular} />

          {/* Latest Works */}
          <ScrollableGridRow title="Latest Works" items={latestWorks} />

          {/* Career Timeline */}
          {sortedByDate.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 bg-primary rounded-full" />
                <h2 className="text-xl font-bold tracking-tight text-white">Career Timeline</h2>
              </div>
              <div className="max-w-4xl border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden">
                {sortedByDate.map((item, index) => {
                  const date = item.release_date || item.first_air_date;
                  const year = date ? new Date(date).getFullYear() : "TBA";
                  const link = item.media_type === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`;
                  return (
                    <div key={`timeline-${item.id}-${index}`} className="flex items-center gap-4 p-4 border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                      <span className="text-white/40 font-mono text-sm w-12 shrink-0">{year}</span>
                      <a href={link} className="flex-1 font-bold text-white hover:text-primary transition-colors line-clamp-1">
                        {item.title || item.name}
                      </a>
                      <span className="text-xs text-white/30 hidden sm:block">
                        {person.known_for_department === "Directing" ? "Director" : (item.character || "Self")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <SimilarPeople id={person.id} department={person.known_for_department || "Acting"} />

        </div>
      </main>
    </div>
  );
}
