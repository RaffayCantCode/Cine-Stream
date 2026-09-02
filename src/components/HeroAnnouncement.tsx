"use client";

import { memo, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useAnnouncement } from "@/hooks/useAnnouncement";

export const HeroAnnouncement = memo(function HeroAnnouncement() {
  const { message, isLoading } = useAnnouncement();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !message || message.trim().length === 0 || dismissed) {
    return null;
  }

  return (
    <div
      className="absolute top-[calc(4.25rem+env(safe-area-inset-top,0px))] sm:top-[calc(4.5rem+env(safe-area-inset-top,0px))] md:top-6 left-3 sm:left-6 md:left-8 lg:left-10 z-30 max-w-[calc(100%-1.5rem)] sm:max-w-md md:max-w-lg lg:max-w-xl pointer-events-auto transition-all duration-300 animate-fade-in-up"
      role="region"
      aria-label="Site Announcement"
    >
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950/80 border border-white/15 backdrop-blur-xl shadow-2xl p-3 sm:p-3.5 transition-colors hover:border-white/25 group">
        <div className="flex items-start gap-3">
          {/* Subtle Icon Badge */}
          <div className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/10 border border-white/10 text-sky-300 shadow-inner">
            <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
                Notice
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              <span className="text-[10px] font-medium text-zinc-400">Official</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-100 font-medium leading-relaxed break-words">
              {message}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            aria-label="Dismiss announcement"
            className="absolute top-2.5 right-2.5 p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
