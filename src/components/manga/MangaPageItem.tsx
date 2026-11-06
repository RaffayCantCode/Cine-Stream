"use client";

import React, { useCallback, useState } from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

interface MangaPageItemProps {
  pageNum: number;
  totalPages: number;
  url: string;
  dataSaverUrl?: string;
  brightness: number;
  onPageRef?: (el: HTMLDivElement | null) => void;
  onTap?: () => void;
}

function readCachedRatio(url: string): number | null {
  if (typeof window === "undefined" || !url) return null;
  try {
    const raw = sessionStorage.getItem(`cs_page_ratio_${url}`);
    if (!raw) return null;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0.1 && parsed < 8 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * A single vertical (webtoon) page. Keeps its aspect ratio from the previous
 * visit so scrolling feels stable, and exposes a tap handler for the reader UI.
 */
export function MangaPageItem({
  pageNum,
  totalPages,
  url,
  dataSaverUrl,
  brightness,
  onPageRef,
  onTap,
}: MangaPageItemProps) {
  const [ratio, setRatio] = useState<number | null>(() => readCachedRatio(url));
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const nextRatio = img.naturalWidth / img.naturalHeight;
        setRatio(nextRatio);
        try {
          sessionStorage.setItem(`cs_page_ratio_${url}`, String(nextRatio));
        } catch {}
      }
      setLoaded(true);
      setFailed(false);
    },
    [url]
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const retries = parseInt(img.dataset.retryCount || "0", 10);
      if (retries < 3) {
        img.dataset.retryCount = String(retries + 1);
        const delay = retries < 2 ? 800 : 2000;
        window.setTimeout(() => {
          if (retries === 2 && dataSaverUrl) {
            img.src = dataSaverUrl;
          } else {
            img.src = `${url}${url.includes("?") ? "&" : "?"}_r=${retries + 1}_${Date.now()}`;
          }
        }, delay);
      } else {
        setFailed(true);
      }
    },
    [dataSaverUrl, url]
  );

  return (
    <div
      data-page={pageNum}
      ref={(el) => onPageRef?.(el)}
      onClick={onTap}
      className="relative w-full select-none bg-[#070708]"
    >
      <div
        style={{ aspectRatio: ratio ? String(ratio) : "2 / 3" }}
        className="relative w-full overflow-hidden"
      >
        {/* Loading shimmer */}
        {!loaded && !failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#0b0b0d] via-[#101013] to-[#0b0b0d]">
            <Loader2 className="h-7 w-7 animate-spin text-white/30" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Page {pageNum}
            </span>
          </div>
        )}

        <img
          key={attempt}
          src={url}
          alt={`Page ${pageNum}`}
          referrerPolicy="no-referrer"
          loading={pageNum <= 3 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            filter: brightness !== 100 ? `brightness(${brightness}%)` : undefined,
          }}
          className={`absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0b0d] text-center">
            <AlertCircle className="h-7 w-7 text-rose-400/80" />
            <p className="px-6 text-xs font-bold text-white/60">
              Page {pageNum} failed to load.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-white/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry page
            </button>
          </div>
        )}
      </div>

      {/* quiet page marker */}
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-0.5 text-[9px] font-bold text-white/45 backdrop-blur-md">
        {pageNum} / {totalPages}
      </span>
    </div>
  );
}
