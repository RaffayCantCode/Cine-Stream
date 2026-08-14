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
      className="absolute top-4 sm:top-5 md:top-6 left-4 sm:left-6 md:left-8 lg:left-10 z-40 max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl pointer-events-auto transition-all duration-300 animate-fade-in-up"
      role="region"
      aria-label="Site Announcement"
    >
      <div className="relative overflow-hidden rounded-2xl bg-black/85 border border-white/20 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.9)] px-3.5 sm:px-4 py-2.5 sm:py-3 transition-all duration-300 hover:border-white/35 hover:bg-black/95 group">
        {/* Glowing backdrop halo */}
        <div className="absolute -left-6 -top-6 w-24 h-24 bg-sky-500/25 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-3">
          {/* Animated pulse badge icon */}
          <div className="shrink-0 mt-0.5 relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/10 border border-white/20 text-white shadow-inner">
            <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-sky-400">
                Announcement
              </span>
            </div>
            <p className="text-xs sm:text-sm text-white font-bold leading-snug break-words drop-shadow-md">
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
            className="absolute top-0 right-0 p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
