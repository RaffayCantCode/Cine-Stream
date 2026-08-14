"use client";

import { BookmarkPlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/context/WatchlistContext";
import { useSession, signIn } from "next-auth/react";
import type { MediaType } from "@/lib/watchlist";

interface WatchlistButtonProps {
  mediaId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  className?: string;
}

export function WatchlistButton({
  mediaId,
  mediaType,
  title,
  posterPath,
  backdropPath,
  className,
}: WatchlistButtonProps) {
  const { status } = useSession();
  const { isSaved, toggle } = useWatchlist();
  const saved = status === "authenticated" && isSaved(mediaId, mediaType);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status !== "authenticated") {
      signIn();
      return;
    }
    toggle({ mediaId, mediaType, title, posterPath, backdropPath });
  };

  return (
    <button
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
      className={cn(
        "group flex items-center gap-2.5 px-6 py-4 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shadow-lg touch-manipulation cursor-pointer",
        saved
          ? "bg-primary hover:bg-primary/85 text-primary-foreground border border-primary/40 shadow-lg shadow-black/30"
          : "bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md",
        className
      )}
    >
      {saved ? (
        <Check className="w-4 h-4 shrink-0" strokeWidth={3} />
      ) : (
        <BookmarkPlus className="w-4 h-4 shrink-0 text-white/80 group-hover:text-white" />
      )}
      <span>{saved ? "In Watchlist" : "Save To Watchlist"}</span>
    </button>
  );
}