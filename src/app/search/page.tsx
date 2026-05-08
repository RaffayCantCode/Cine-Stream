"use client";

import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { MediaCard } from "@/components/MediaCard";
import { useDebounce } from "@/hooks/useDebounce";
import { Search as SearchIcon, MonitorPlay } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type: "movie" | "tv";
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(debouncedQuery)}`);
        const data = await res.json();
        const filtered = data.results?.filter(
          (r: MediaItem) => r.media_type === "movie" || r.media_type === "tv"
        ) || [];
        setResults(filtered);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Navigation />

      <div className="pt-32 px-6 md:px-12 max-w-screen-2xl mx-auto">
        <div className="relative max-w-3xl mx-auto mb-16">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <Input
            ref={inputRef}
            type="text"
            className="w-full h-16 pl-12 pr-4 bg-secondary/50 border-secondary/50 text-xl rounded-2xl focus-visible:ring-primary focus-visible:ring-offset-0 text-white placeholder:text-muted-foreground/70"
            placeholder="Search for movies, TV shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {debouncedQuery.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <MonitorPlay className="w-16 h-16 mb-4 opacity-20" />
            <h3 className="text-xl font-medium text-white mb-2">Find something to watch</h3>
            <p>Start typing to search across thousands of movies and TV shows.</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {results.map((item) => (
              <div key={`${item.media_type}-${item.id}`} className="w-full h-full flex justify-center">
                <MediaCard item={item} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <h3 className="text-xl font-medium text-white mb-2">No results found</h3>
            <p>We couldn&apos;t find anything matching &quot;{debouncedQuery}&quot;. Try another search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}
