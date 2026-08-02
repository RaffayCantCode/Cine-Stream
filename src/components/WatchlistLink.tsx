"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/context/WatchlistContext";

interface WatchlistLinkProps {
  className?: string;
  compact?: boolean;
}

export function WatchlistLink({ className, compact = false }: WatchlistLinkProps) {
  const pathname = usePathname();
  const { items } = useWatchlist();
  const isActive = pathname === "/watchlist";
  const count = items.length;

  return (
    <Link
      href="/watchlist"
      aria-label="Watchlist"
      title="Watchlist"
      className={cn(
        "group relative flex items-center justify-center rounded-xl border transition-all touch-manipulation",
        "border-border bg-card/60 text-foreground hover:bg-card hover:border-primary/50",
        isActive && "border-primary/60 text-primary bg-card",
        compact ? "p-2.5" : "h-10 w-10",
        className
      )}
    >
      <BookMarked className="w-[18px] h-[18px]" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow-md">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}