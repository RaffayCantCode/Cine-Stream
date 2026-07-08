"use client";

import Link from "next/link";
import { User } from "lucide-react";

interface MediaItem {
  id: number;
  name?: string;
  profile_path?: string;
  known_for_department?: string;
}

interface PersonCardProps {
  item: MediaItem;
}

export function PersonCard({ item }: PersonCardProps) {
  const profileUrl = item.profile_path
    ? `https://image.tmdb.org/t/p/w342${item.profile_path}`
    : null;

  return (
    <div className="row-item" style={{ animation: "fade-in-up 0.35s ease-out both" }}>
      <Link
        href={`/person/${item.id}`}
        className="group relative block shrink-0 transition-all duration-300 hover:scale-[1.05] hover:z-10 focus:outline-none w-[150px] sm:w-[180px] md:w-[200px]"
        style={{ transformOrigin: "center bottom" }}
      >
        <div 
          className="relative z-10 w-full overflow-hidden rounded-2xl bg-muted/50 hover:shadow-2xl hover:shadow-primary/40 hover:ring-2 hover:ring-primary/50"
          style={{ aspectRatio: "2/3" }}
        >
          {profileUrl ? (
            <img
              src={profileUrl}
              alt={item.name || "Person"}
              className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-card">
              <User className="w-12 h-12 text-white/20 mb-2" />
            </div>
          )}
        </div>
        
        <div className="mt-3 text-center">
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {item.name}
          </h3>
          <p className="text-white/50 text-xs mt-0.5">
            {item.known_for_department || "Person"}
          </p>
        </div>
      </Link>
    </div>
  );
}
