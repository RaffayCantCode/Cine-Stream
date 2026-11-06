"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export type PagedReaderMode = "single" | "double";
export type ReadingDirection = "ltr" | "rtl";

interface PagedReaderProps {
  pageUrls: string[];
  currentPage: number;
  totalPages: number;
  mode: PagedReaderMode;
  direction: ReadingDirection;
  brightness: number;
  showControls: boolean;
  /** Reserve space for the fixed header + bottom bar on phones. */
  isMobile?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleControls: () => void;
}

interface PointerInfo {
  x: number;
  y: number;
}

interface PageImageProps {
  src: string;
  pageNumber: number;
  brightness: number;
  priority?: boolean;
  /** "contain" fits the whole page in the viewport; "width" fills its column and scrolls. */
  fit?: "contain" | "width";
  onRatio?: (ratio: number) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.4;

/** Taller-than-this pages stop being letterboxed and switch to a scrollable column. */
const MIN_VISIBLE_FRACTION = 0.35;

function PageImage({
  src,
  pageNumber,
  brightness,
  priority,
  fit = "contain",
  onRatio,
}: PageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const reportRatio = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    onRatio?.(img.naturalHeight / img.naturalWidth);
  }, [onRatio]);

  // Cached images can complete before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
      reportRatio();
    }
  }, [reportRatio, retry]);

  const isWidthMode = fit === "width";

  return (
    <div
      className={
        isWidthMode
          ? "relative flex w-full items-start justify-center"
          : "relative flex h-full w-full items-center justify-center overflow-hidden"
      }
    >
      {!loaded && (
        <div
          className={`flex items-center justify-center bg-[#08080a] ${
            isWidthMode
              ? "h-[70vh] w-full"
              : "absolute inset-0"
          }`}
        >
          <div className="flex flex-col items-center gap-2 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Page {pageNumber}
            </span>
          </div>
        </div>
      )}
      <img
        key={retry}
        ref={imgRef}
        src={
          retry > 0
            ? `${src}${src.includes("?") ? "&" : "?"}_r=${retry}_${Date.now()}`
            : src
        }
        alt={`Page ${pageNumber}`}
        referrerPolicy="no-referrer"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => {
          setLoaded(true);
          setFailed(false);
          reportRatio();
        }}
        onError={() => {
          if (retry < 2) {
            window.setTimeout(() => setRetry((r) => r + 1), 700 + retry * 900);
          } else {
            setFailed(true);
          }
        }}
        style={{
          filter: brightness !== 100 ? `brightness(${brightness}%)` : undefined,
        }}
        className={
          isWidthMode
            ? `block h-auto w-full max-w-none select-none object-contain transition-opacity duration-200 ${
                loaded ? "opacity-100" : "opacity-0"
              }`
            : `max-h-full max-w-full select-none object-contain transition-opacity duration-200 ${
                loaded ? "opacity-100" : "opacity-0"
              }`
        }
      />
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#08080a] text-white/60">
          <span className="text-xs font-bold">Page {pageNumber} could not load</span>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setRetry((r) => r + 1);
            }}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black text-white hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export function PagedReader({
  pageUrls,
  currentPage,
  totalPages,
  mode,
  direction,
  brightness,
  showControls,
  isMobile = false,
  onPrev,
  onNext,
  onToggleControls,
}: PagedReaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [pageRatios, setPageRatios] = useState<Record<number, number>>({});
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [hasScrolled, setHasScrolled] = useState(false);

  const pointersRef = useRef<Map<number, PointerInfo>>(new Map());
  const gestureRef = useRef({
    pinching: false,
    startDist: 0,
    startScale: 1,
    originX: 0,
    originY: 0,
    startPanX: 0,
    startPanY: 0,
    lastX: 0,
    lastY: 0,
  });
  const tapRef = useRef({ startX: 0, startY: 0, startTime: 0, moved: false });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelLockRef = useRef(0);

  /** Pages that make up the current spread, already ordered for the reading direction. */
  const visiblePages = useMemo(() => {
    if (mode === "single") return [currentPage];
    if (currentPage <= 1) return [1];
    const start = currentPage % 2 === 0 ? currentPage : currentPage - 1;
    const pages = [start, start + 1].filter((n) => n >= 1 && n <= totalPages);
    return direction === "rtl" ? [...pages].reverse() : pages;
  }, [currentPage, mode, direction, totalPages]);

  const handleRatio = useCallback((pageNumber: number, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0.05) return;
    setPageRatios((prev) =>
      Math.abs((prev[pageNumber] || 0) - ratio) < 0.01
        ? prev
        : { ...prev, [pageNumber]: ratio }
    );
  }, []);

  // Stage dimensions decide whether a page can be fully letterboxed or needs a
  // scrollable, full-width column (webtoon strips are far too tall to shrink).
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const measure = () =>
      setStage({ width: stageEl.clientWidth, height: stageEl.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stageEl);
    return () => observer.disconnect();
  }, []);

  // A different chapter means different page dimensions.
  useEffect(() => {
    setPageRatios({});
    setHasScrolled(false);
  }, [pageUrls]);

  const layout = useMemo(() => {
    const width = stage.width;
    const height = stage.height;
    const isSpread = mode === "double" && visiblePages.length > 1;
    const ratios = visiblePages.map((page) => pageRatios[page] || 0);

    if (!width || !height) {
      return { scroll: false, widths: null as number[] | null };
    }

    const columnWidth = Math.max(1, (width - 2) / 2);
    const maxFitRatio = isSpread
      ? height / (MIN_VISIBLE_FRACTION * columnWidth)
      : height / (MIN_VISIBLE_FRACTION * width);

    // Dual spreads always letterbox both pages; tall strips are scroll‑rendered
    // only in single mode. This keeps page turns purely state-driven.
    const scroll = !isSpread && ratios.some((ratio) => ratio > 0 && ratio > maxFitRatio);

    // Classic book spread: scale both pages by the same height, then clamp the
    // pair to the viewport width so the two pages sit tightly side by side.
    let widths: number[] | null = null;
    if (isSpread && !scroll && ratios.every((ratio) => ratio > 0)) {
      const raw = ratios.map((ratio) => ratio * height);
      const sum = raw.reduce((total, value) => total + value, 0);
      const fit = sum > width ? width / sum : 1;
      widths = raw.map((value) => Math.floor(value * fit));
    }

    return { scroll, widths };
  }, [mode, visiblePages, pageRatios, stage]);

  // Every new spread starts at the top of its content.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    setHasScrolled(false);
  }, [currentPage, mode, direction, layout.scroll]);

  const applyTransform = useCallback(
    (scale: number, pan: { x: number; y: number }, animate = false) => {
      const el = contentRef.current;
      if (!el) return;
      el.style.transition = animate
        ? "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1)"
        : "none";
      el.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`;
    },
    []
  );

  const clampPan = useCallback((pan: { x: number; y: number }, scale: number) => {
    const stage = stageRef.current;
    if (!stage) return pan;
    const rect = stage.getBoundingClientRect();
    const minX = rect.width * (1 - scale);
    const minY = rect.height * (1 - scale);
    return {
      x: Math.min(0, Math.max(minX, pan.x)),
      y: Math.min(0, Math.max(minY, pan.y)),
    };
  }, []);

  const resetZoom = useCallback(
    (animate = true) => {
      scaleRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      setDisplayScale(1);
      setIsZoomed(false);
      applyTransform(1, { x: 0, y: 0 }, animate);
    },
    [applyTransform]
  );

  /** Reset whenever the page or mode changes. */
  useEffect(() => {
    resetZoom(false);
  }, [currentPage, mode, direction, resetZoom]);

  const zoomAtPoint = useCallback(
    (nextScale: number, clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));

      const originX = (localX - panRef.current.x) / scaleRef.current;
      const originY = (localY - panRef.current.y) / scaleRef.current;

      let panX = localX - scale * originX;
      let panY = localY - scale * originY;
      const clamped = clampPan({ x: panX, y: panY }, scale);

      scaleRef.current = scale;
      panRef.current = clamped;
      setDisplayScale(scale);
      setIsZoomed(scale > 1.05);
      applyTransform(scale, clamped, true);
    },
    [applyTransform, clampPan]
  );

  const handleZoomIn = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const next = Math.min(MAX_SCALE, scaleRef.current * 1.3);
    zoomAtPoint(next, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [zoomAtPoint]);

  const handleZoomOut = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();

    // Snapping straight back to fit avoids the awkward "almost 100%" state
    // and always recentres the spread.
    if (scaleRef.current <= 1.05 || scaleRef.current / 1.3 <= 1.02) {
      resetZoom(true);
      return;
    }

    zoomAtPoint(
      scaleRef.current / 1.3,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }, [resetZoom, zoomAtPoint]);

  const runTapAction = useCallback(
    (clientX: number) => {
      if (scaleRef.current > 1.05) {
        onToggleControls();
        return;
      }
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;

      if (relX > 0.3 && relX < 0.7) {
        onToggleControls();
        return;
      }

      const tappedForward =
        direction === "rtl" ? relX <= 0.3 : relX >= 0.7;

      if (tappedForward) onNext();
      else onPrev();
    },
    [direction, onNext, onPrev, onToggleControls]
  );

  const toggleDoubleTapZoom = useCallback(
    (clientX: number, clientY: number) => {
      if (scaleRef.current > 1.05) {
        resetZoom(true);
      } else {
        zoomAtPoint(DOUBLE_TAP_SCALE, clientX, clientY);
      }
    },
    [resetZoom, zoomAtPoint]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pointers = pointersRef.current;
      if (pointers.size === 2) {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const focalX = (a.x + b.x) / 2;
        const focalY = (a.y + b.y) / 2;
        const stage = stageRef.current;
        const rect = stage?.getBoundingClientRect();
        const localX = rect ? focalX - rect.left : focalX;
        const localY = rect ? focalY - rect.top : focalY;

        gestureRef.current = {
          ...gestureRef.current,
          pinching: true,
          startDist: dist || 1,
          startScale: scaleRef.current,
          originX: (localX - panRef.current.x) / scaleRef.current,
          originY: (localY - panRef.current.y) / scaleRef.current,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
          lastX: focalX,
          lastY: focalY,
        };
        tapRef.current.moved = true;
      } else if (pointers.size === 1) {
        tapRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startTime: Date.now(),
          moved: false,
        };
        gestureRef.current.lastX = e.clientX;
        gestureRef.current.lastY = e.clientY;
        if (scaleRef.current > 1.05) {
          gestureRef.current.pinching = false;
          gestureRef.current.startPanX = panRef.current.x;
          gestureRef.current.startPanY = panRef.current.y;
        }
      }
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const dx = e.clientX - tapRef.current.startX;
      const dy = e.clientY - tapRef.current.startY;
      if (Math.hypot(dx, dy) > 10) tapRef.current.moved = true;

      const pointers = pointersRef.current;

      if (pointers.size >= 2 && gestureRef.current.pinching) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const focalX = (a.x + b.x) / 2;
        const focalY = (a.y + b.y) / 2;
        const stage = stageRef.current;
        const rect = stage?.getBoundingClientRect();
        const localX = rect ? focalX - rect.left : focalX;
        const localY = rect ? focalY - rect.top : focalY;

        const rawScale =
          gestureRef.current.startScale * (dist / gestureRef.current.startDist);
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
        let panX = localX - scale * gestureRef.current.originX;
        let panY = localY - scale * gestureRef.current.originY;
        const clamped = clampPan({ x: panX, y: panY }, scale);

        scaleRef.current = scale;
        panRef.current = clamped;
        applyTransform(scale, clamped, false);
        if (scale > 1.05 && !isZoomed) setIsZoomed(true);
        return;
      }

      if (pointers.size === 1 && scaleRef.current > 1.05) {
        const deltaX = e.clientX - gestureRef.current.lastX;
        const deltaY = e.clientY - gestureRef.current.lastY;
        gestureRef.current.lastX = e.clientX;
        gestureRef.current.lastY = e.clientY;

        const next = clampPan(
          { x: panRef.current.x + deltaX, y: panRef.current.y + deltaY },
          scaleRef.current
        );
        panRef.current = next;
        applyTransform(scaleRef.current, next, false);
      }
    },
    [applyTransform, clampPan, isZoomed]
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
      pointersRef.current.delete(e.pointerId);

      if (pointersRef.current.size > 0) {
        // Continue panning with the finger that is still down.
        const [remaining] = [...pointersRef.current.values()];
        if (remaining) {
          gestureRef.current.lastX = remaining.x;
          gestureRef.current.lastY = remaining.y;
        }
        return;
      }

      const wasPinching = gestureRef.current.pinching;
      gestureRef.current.pinching = false;

      if (wasPinching) {
        const clamped = clampPan(panRef.current, scaleRef.current);
        panRef.current = clamped;
        setDisplayScale(scaleRef.current);
        setIsZoomed(scaleRef.current > 1.05);
        applyTransform(scaleRef.current, clamped, true);
        if (scaleRef.current <= 1.02) resetZoom(true);
        return;
      }

      if (cancelled) return;

      const dx = e.clientX - tapRef.current.startX;
      const dy = e.clientY - tapRef.current.startY;
      const elapsed = Date.now() - tapRef.current.startTime;
      const distance = Math.hypot(dx, dy);

      if (scaleRef.current > 1.05) {
        const clamped = clampPan(panRef.current, scaleRef.current);
        panRef.current = clamped;
        applyTransform(scaleRef.current, clamped, true);

        if (distance < 12 && elapsed < 400) {
          const now = Date.now();
          const last = lastTapRef.current;
          if (now - last.time < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 45) {
            lastTapRef.current = { time: 0, x: 0, y: 0 };
            resetZoom(true);
          } else {
            lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
            if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = setTimeout(() => {
              runTapAction(e.clientX);
              singleTapTimerRef.current = null;
            }, 260);
          }
        }
        return;
      }

      // Swipe navigation (only when not zoomed).
      if (distance > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        const swipedLeft = dx < 0;
        const next = direction === "rtl" ? !swipedLeft : swipedLeft;
        if (next) onNext();
        else onPrev();
        return;
      }

      if (distance < 12 && elapsed < 400) {
        const now = Date.now();
        const last = lastTapRef.current;
        if (now - last.time < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 45) {
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
          lastTapRef.current = { time: 0, x: 0, y: 0 };
          toggleDoubleTapZoom(e.clientX, e.clientY);
        } else {
          lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
          if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = setTimeout(() => {
            runTapAction(e.clientX);
            singleTapTimerRef.current = null;
          }, 260);
        }
      }
    },
    [
      applyTransform,
      clampPan,
      direction,
      onNext,
      onPrev,
      resetZoom,
      runTapAction,
      toggleDoubleTapZoom,
    ]
  );

  // Ctrl + wheel zoom & wheel page navigation.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.18 : 0.85;
        zoomAtPoint(scaleRef.current * factor, e.clientX, e.clientY);
        return;
      }
      if (scaleRef.current > 1.05) return;

      // In scrollable spreads let the wheel read the page first; only advance
      // once the reader has reached the top / bottom edge.
      const scroller = scrollRef.current;
      if (layout.scroll && scroller) {
        const canScroll = scroller.scrollHeight > scroller.clientHeight + 2;
        if (canScroll) {
          const atTop = scroller.scrollTop <= 1;
          const atBottom =
            scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
          if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) return;
        }
      }

      e.preventDefault();
      const now = Date.now();
      if (now - wheelLockRef.current < 380) return;
      wheelLockRef.current = now;
      if (e.deltaY > 0) onNext();
      else if (e.deltaY < 0) onPrev();
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [layout.scroll, onNext, onPrev, zoomAtPoint]);

  // Spacebar / arrows are owned by the parent; keep a small guard here for double tap timer cleanup.
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const isSpread = mode === "double" && visiblePages.length > 1;
  const scrollMode = layout.scroll;
  const spreadWidths = layout.widths;

  return (
    <div
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishPointer(e)}
      onPointerCancel={(e) => finishPointer(e, true)}
      className="relative h-[100dvh] w-full touch-none select-none overflow-hidden bg-black"
      style={{
        WebkitTapHighlightColor: "transparent",
        touchAction: scrollMode && !isZoomed ? "pan-y" : "none",
        paddingTop: isMobile
          ? "calc(env(safe-area-inset-top, 0px) + 3.75rem)"
          : undefined,
        paddingBottom: isMobile
          ? "calc(env(safe-area-inset-bottom, 0px) + 4rem)"
          : undefined,
      }}
    >
      {/* subtle frame glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, transparent 62%)",
        }}
      />

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const next = e.currentTarget.scrollTop > 8;
          if (next !== hasScrolled) setHasScrolled(next);
        }}
        className={`relative z-10 h-full ${
          scrollMode
            ? "overflow-y-auto overflow-x-hidden overscroll-contain"
            : "overflow-hidden"
        }`}
      >
        <div
          ref={contentRef}
          style={{ transformOrigin: "0 0" }}
          className={
            scrollMode
              ? "relative flex w-full items-start justify-center gap-px py-2 sm:py-3"
              : "relative flex h-full w-full items-center justify-center"
          }
        >
          {visiblePages.map((pageNumber, index) => {
            const width = spreadWidths?.[index];
            return (
              <div
                key={pageNumber}
                className={
                  scrollMode
                    ? "flex min-w-0 flex-1 items-start justify-center px-px"
                    : `flex h-full items-center justify-center overflow-hidden ${
                        isSpread && !width ? "w-1/2" : "w-full"
                      }`
                }
                style={!scrollMode && width ? { width: `${width}px` } : undefined}
              >
                <PageImage
                  src={pageUrls[pageNumber - 1] || ""}
                  pageNumber={pageNumber}
                  brightness={brightness}
                  priority
                  fit={scrollMode ? "width" : "contain"}
                  onRatio={(ratio) => handleRatio(pageNumber, ratio)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll affordances for tall webtoon spreads */}
      {scrollMode && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-black via-black/55 to-transparent transition-opacity duration-300 ${
            hasScrolled ? "opacity-50" : "opacity-100"
          }`}
        />
      )}
      {scrollMode && !hasScrolled && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 backdrop-blur-md">
            Scroll to read
            <span aria-hidden className="text-xs leading-none">↓</span>
          </span>
        </div>
      )}

      {/* page corner labels */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center transition-all duration-300 ${
          showControls ? "bottom-20" : "bottom-3"
        }`}
      >
        <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-black text-white/60 backdrop-blur-md">
          {isSpread
            ? `${Math.min(...visiblePages)}–${Math.max(...visiblePages)} / ${totalPages}`
            : `${currentPage} / ${totalPages}`}
        </span>
      </div>

      {/* Zoom cluster */}
      <div
        className={`absolute right-2.5 top-1/2 z-30 -translate-y-1/2 flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-md transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white active:scale-90 sm:h-8 sm:w-8"
          title="Zoom in (Ctrl + wheel)"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white active:scale-90 sm:h-8 sm:w-8"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            resetZoom(true);
          }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors active:scale-90 ${
            isZoomed
              ? "bg-white/15 text-white"
              : "text-white/30 pointer-events-none"
          }`}
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          {isZoomed ? (
            <span className="text-[9px] font-black">{Math.round(displayScale * 100)}</span>
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Edge affordances for desktop */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (direction === "rtl") onNext();
          else onPrev();
        }}
        aria-label={direction === "rtl" ? "Next page" : "Previous page"}
        className="group absolute left-0 top-0 z-20 hidden h-full w-[8%] items-center justify-start pl-2 sm:flex"
      >
        <span className="flex h-11 w-9 items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-black/40 text-white/40 opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 group-hover:text-white">
          <ChevronLeft className="h-5 w-5" />
        </span>
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (direction === "rtl") onPrev();
          else onNext();
        }}
        aria-label={direction === "rtl" ? "Previous page" : "Next page"}
        className="group absolute right-0 top-0 z-20 hidden h-full w-[8%] items-center justify-end pr-2 sm:flex"
      >
        <span className="flex h-11 w-9 items-center justify-center rounded-l-xl border border-r-0 border-white/10 bg-black/40 text-white/40 opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 group-hover:text-white">
          <ChevronRight className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}
