"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";

interface MangaPageItemProps {
  pageNum: number;
  totalPages: number;
  url: string;
  dataSaverUrl?: string;
  brightness: number;
  onPageRef?: (el: HTMLDivElement | null) => void;
  onTap?: () => void;
}

export function MangaPageItem({
  pageNum,
  totalPages,
  url,
  dataSaverUrl,
  brightness,
  onPageRef,
  onTap,
}: MangaPageItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Dynamic zoom state
  const [isZoomed, setIsZoomed] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);

  // Gesture tracking refs (avoids React re-renders during 60/120fps touchmove)
  const scaleRef = useRef<number>(1);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isGesturingRef = useRef<boolean>(false);
  const startDistRef = useRef<number>(0);
  const startScaleRef = useRef<number>(1);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rectStartRef = useRef<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const lastTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tap vs Double Tap detection
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Programmatic reset helper
  const handleResetZoom = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    if (contentRef.current) {
      contentRef.current.style.transition = "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1)";
      contentRef.current.style.transform = "translate3d(0px, 0px, 0px) scale(1)";
    }
    setDisplayScale(1);
    setTimeout(() => {
      setIsZoomed(false);
      if (containerRef.current) {
        containerRef.current.style.overflow = "hidden";
        containerRef.current.style.zIndex = "";
        containerRef.current.style.touchAction = "pan-y";
      }
    }, 240);
  }, []);

  // Double-tap zoom logic: zooms centered exactly at the tapped point
  const handleDoubleTap = useCallback((tapX: number, tapY: number) => {
    if (!containerRef.current || !contentRef.current) return;

    if (scaleRef.current > 1.05) {
      // If already zoomed in, double tap resets to 1x
      handleResetZoom();
    } else {
      // Zoom in to 2.4x centered on tap location
      const rect = containerRef.current.getBoundingClientRect();
      const targetScale = 2.4;

      const localX = tapX - rect.left;
      const localY = tapY - rect.top;

      let panX = localX * (1 - targetScale);
      let panY = localY * (1 - targetScale);

      // Clamp within boundaries
      const minX = rect.width * (1 - targetScale);
      const minY = rect.height * (1 - targetScale);
      panX = Math.min(0, Math.max(minX, panX));
      panY = Math.min(0, Math.max(minY, panY));

      scaleRef.current = targetScale;
      panRef.current = { x: panX, y: panY };

      containerRef.current.style.overflow = "visible";
      containerRef.current.style.zIndex = "35";
      containerRef.current.style.touchAction = "none";

      contentRef.current.style.transition = "transform 250ms cubic-bezier(0.2, 0.9, 0.3, 1)";
      contentRef.current.style.transform = `translate3d(${panX}px, ${panY}px, 0px) scale(${targetScale})`;

      setIsZoomed(true);
      setDisplayScale(targetScale);
    }
  }, [handleResetZoom]);

  // Non-passive Touch & Gesture Event Listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      if (e.touches.length === 2) {
        // Multi-touch pinch start
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }

        isGesturingRef.current = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];

        startDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        startScaleRef.current = scaleRef.current;

        const focalX = (t1.clientX + t2.clientX) / 2;
        const focalY = (t1.clientY + t2.clientY) / 2;

        const rect = container.getBoundingClientRect();
        rectStartRef.current = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };

        // Focal point relative to container & current scale/pan
        const localX = focalX - rect.left;
        const localY = focalY - rect.top;
        originRef.current = {
          x: (localX - panRef.current.x) / scaleRef.current,
          y: (localY - panRef.current.y) / scaleRef.current,
        };

        container.style.overflow = "visible";
        container.style.zIndex = "35";
        container.style.touchAction = "none";
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartTimeRef.current = Date.now();
        touchStartPosRef.current = { x: t.clientX, y: t.clientY };
        lastTouchRef.current = { x: t.clientX, y: t.clientY };

        if (scaleRef.current > 1.05) {
          // If already zoomed in, capture drag for panning
          isGesturingRef.current = true;
          if (contentRef.current) {
            contentRef.current.style.transition = "none";
          }
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      if (e.touches.length === 2 && isGesturingRef.current) {
        // Active 2-finger pinch
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];

        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (startDistRef.current <= 0) return;

        const rawScale = startScaleRef.current * (dist / startDistRef.current);
        const newScale = Math.min(4.5, Math.max(0.85, rawScale));

        const focalX = (t1.clientX + t2.clientX) / 2;
        const focalY = (t1.clientY + t2.clientY) / 2;

        // Focal point formula: preserve touched content point under moving fingers
        const newPanX = focalX - rectStartRef.current.left - newScale * originRef.current.x;
        const newPanY = focalY - rectStartRef.current.top - newScale * originRef.current.y;

        scaleRef.current = newScale;
        panRef.current = { x: newPanX, y: newPanY };

        if (contentRef.current) {
          contentRef.current.style.transition = "none";
          contentRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0px) scale(${newScale})`;
        }

        if (newScale > 1.05 && !isZoomed) {
          setIsZoomed(true);
        }
        setDisplayScale(newScale);
      } else if (e.touches.length === 1 && scaleRef.current > 1.05 && isGesturingRef.current) {
        // Active 1-finger panning when zoomed in
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - lastTouchRef.current.x;
        const dy = t.clientY - lastTouchRef.current.y;

        const newPanX = panRef.current.x + dx;
        const newPanY = panRef.current.y + dy;

        panRef.current = { x: newPanX, y: newPanY };
        lastTouchRef.current = { x: t.clientX, y: t.clientY };

        if (contentRef.current) {
          contentRef.current.style.transition = "none";
          contentRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0px) scale(${scaleRef.current})`;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      if (e.touches.length === 0) {
        isGesturingRef.current = false;

        // Check for Tap / Double Tap when movement is negligible (< 12px) and duration < 300ms
        if (e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
          const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
          const duration = Date.now() - touchStartTimeRef.current;

          if (dx < 12 && dy < 12 && duration < 300) {
            const now = Date.now();
            const timeSinceLastTap = now - lastTapTimeRef.current;
            const distFromLastTap = Math.hypot(
              t.clientX - lastTapPosRef.current.x,
              t.clientY - lastTapPosRef.current.y
            );

            if (timeSinceLastTap < 300 && distFromLastTap < 35) {
              // Double Tap Detected
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
              }
              lastTapTimeRef.current = 0;
              handleDoubleTap(t.clientX, t.clientY);
              return;
            } else {
              // Potential Single Tap (schedule with slight delay to allow double-tap discrimination)
              lastTapTimeRef.current = now;
              lastTapPosRef.current = { x: t.clientX, y: t.clientY };

              if (scaleRef.current <= 1.05) {
                if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = setTimeout(() => {
                  onTap?.();
                  singleTapTimerRef.current = null;
                }, 280);
              }
            }
          }
        }

        // Gesture End Boundaries and Snapping
        if (scaleRef.current <= 1.05) {
          // Snap back to 100% normal size
          handleResetZoom();
        } else {
          // Keep zoomed in, but clamp over-panning so image stays within view
          const rect = container.getBoundingClientRect();
          const s = scaleRef.current;
          const sW = s * rect.width;
          const sH = s * rect.height;

          const minX = rect.width - sW;
          const minY = rect.height - sH;

          let clampedX = Math.min(0, Math.max(minX, panRef.current.x));
          let clampedY = Math.min(0, Math.max(minY, panRef.current.y));

          panRef.current = { x: clampedX, y: clampedY };
          setDisplayScale(s);

          if (contentRef.current) {
            contentRef.current.style.transition = "transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1)";
            contentRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0px) scale(${s})`;
          }
        }
      } else if (e.touches.length === 1 && scaleRef.current > 1.05) {
        // One finger remains down after 2-finger pinch -> transition seamlessly to 1-finger pan
        const t = e.touches[0];
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
      }
    };

    // Trackpad Pinch Support (Wheel with Ctrl key)
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.01;
        const currentScale = scaleRef.current;
        const newScale = Math.min(4.5, Math.max(1, currentScale + delta));

        if (newScale <= 1.02) {
          handleResetZoom();
          return;
        }

        const rect = container.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;

        const originX = (localX - panRef.current.x) / currentScale;
        const originY = (localY - panRef.current.y) / currentScale;

        const newPanX = localX - newScale * originX;
        const newPanY = localY - newScale * originY;

        scaleRef.current = newScale;
        panRef.current = { x: newPanX, y: newPanY };

        container.style.overflow = "visible";
        container.style.zIndex = "35";
        container.style.touchAction = "none";

        if (contentRef.current) {
          contentRef.current.style.transition = "none";
          contentRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0px) scale(${newScale})`;
        }

        setIsZoomed(true);
        setDisplayScale(newScale);
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      container.removeEventListener("wheel", onWheel);
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, [handleDoubleTap, handleResetZoom, isZoomed, onTap]);

  return (
    <div
      data-page={pageNum}
      ref={(el) => {
        (containerRef as any).current = el;
        onPageRef?.(el);
      }}
      style={{
        touchAction: isZoomed ? "none" : "pan-y",
      }}
      className={`relative w-full flex justify-center bg-black min-h-[400px] sm:min-h-[600px] select-none ${
        isZoomed ? "overflow-visible z-30" : "overflow-hidden"
      }`}
    >
      {/* Zoomable / Transformable Content Wrapper */}
      <div
        ref={contentRef}
        style={{
          transformOrigin: "0 0",
          willChange: isZoomed ? "transform" : "auto",
        }}
        className="w-full h-full relative"
      >
        <img
          src={url}
          alt={`Page ${pageNum}`}
          referrerPolicy="no-referrer"
          loading={pageNum <= 4 ? "eager" : "lazy"}
          decoding="async"
          style={{
            filter: brightness !== 100 ? `brightness(${brightness}%)` : undefined,
            WebkitFilter: brightness !== 100 ? `brightness(${brightness}%)` : undefined,
          }}
          onError={(e) => {
            const target = e.currentTarget;
            const retryCount = parseInt(target.dataset.retryCount || "0", 10);
            if (retryCount < 3) {
              target.dataset.retryCount = String(retryCount + 1);
              const delay = retryCount < 2 ? 800 : 2000;
              setTimeout(() => {
                if (retryCount === 2 && dataSaverUrl) {
                  target.src = dataSaverUrl;
                } else {
                  target.src = `${url}${url.includes("?") ? "&" : "?"}_r=${retryCount + 1}_${Date.now()}`;
                }
              }, delay);
            }
          }}
          className="w-full h-auto object-contain block select-none pointer-events-none transition-[filter] duration-150"
        />

        {/* Hardware-accelerated dimmer overlay for mobile when brightness < 100 */}
        {brightness < 100 && (
          <div
            className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-150 z-10"
            style={{ opacity: Math.max(0, ((100 - brightness) / 100) * 0.75) }}
          />
        )}
      </div>

      {/* Floating Zoom Indicator & One-Touch Reset Badge when Zoomed */}
      {isZoomed && (
        <div className="absolute top-4 right-4 z-40 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <button
            type="button"
            onClick={handleResetZoom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/85 border border-primary/60 text-primary font-black text-xs shadow-2xl backdrop-blur-md active:scale-90 transition-transform cursor-pointer"
            title="Reset Zoom to 100%"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="font-mono">{Math.round(displayScale * 100)}%</span>
            <span className="text-[10px] text-white/70 uppercase tracking-wider font-bold ml-0.5">Reset</span>
          </button>
        </div>
      )}

      {/* Subtle Page Watermark (hidden when zoomed to keep inspection clean) */}
      {!isZoomed && (
        <span className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md bg-black/70 text-[9px] text-white/60 backdrop-blur-md pointer-events-none font-bold z-20">
          {pageNum} / {totalPages}
        </span>
      )}
    </div>
  );
}
