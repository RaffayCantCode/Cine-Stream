"use client";

import { useEffect, useState, memo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EndsAtBadgeProps {
  runtimeMinutes?: number | null;
  className?: string;
}

export const EndsAtBadge = memo(function EndsAtBadge({
  runtimeMinutes,
  className,
}: EndsAtBadgeProps) {
  const [endsAtText, setEndsAtText] = useState<string | null>(null);

  useEffect(() => {
    const mins = Number(runtimeMinutes || 0);
    if (!Number.isFinite(mins) || mins <= 0 || mins > 1440) {
      setEndsAtText(null);
      return;
    }

    const compute = () => {
      const end = new Date(Date.now() + mins * 60_000);
      setEndsAtText(
        end.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    };

    compute();
    const timer = setInterval(compute, 30_000);
    return () => clearInterval(timer);
  }, [runtimeMinutes]);

  if (!endsAtText) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-white/85 font-extrabold text-xs sm:text-sm shadow-sm backdrop-blur-md",
        className
      )}
      title="Estimated finish time if you start watching right now"
    >
      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span className="text-white/60 font-semibold">Ends at</span>
      <span className="text-white font-black tracking-tight">{endsAtText}</span>
    </div>
  );
});
