"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { 
  Download, 
  X, 
  Smartphone, 
  Laptop, 
  Share, 
  PlusSquare, 
  MoreVertical, 
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstallDesktop?: () => void;
  canPromptDesktop?: boolean;
}

export function InstallAppModal({
  isOpen,
  onClose,
  onInstallDesktop,
  canPromptDesktop = false,
}: InstallAppModalProps) {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setPlatform("ios");
    } else if (/android/i.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }
  }, []);

  // Lock scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Container — Centered across entire screen */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg bg-[#0b0f24] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/90 z-10 overflow-hidden my-auto"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between pb-5 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30">
                  <Download className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Install CineStream App</h3>
                  <p className="text-xs text-white/60 font-medium">Fast, standalone, and full-screen experience</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer touch-manipulation active:scale-95"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="relative flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.05] border border-white/[0.08] my-6">
              <button
                onClick={() => setPlatform("desktop")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation ${
                  platform === "desktop"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Desktop (PC/Mac)</span>
              </button>
              <button
                onClick={() => setPlatform("ios")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation ${
                  platform === "ios"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                onClick={() => setPlatform("android")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation ${
                  platform === "android"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
            </div>

            {/* Platform Instructions */}
            <div className="relative space-y-4 text-xs font-medium text-white/80">
              {platform === "desktop" && (
                <div className="space-y-4">
                  {canPromptDesktop ? (
                    <div className="p-5 rounded-2xl bg-primary/10 border border-primary/30 flex flex-col items-center gap-3 text-center">
                      <Sparkles className="w-6 h-6 text-primary" />
                      <div>
                        <p className="text-sm font-black text-white">Direct Installation Ready</p>
                        <p className="text-xs text-white/70 mt-1">Click below to install CineStream directly onto your computer as a standalone desktop app.</p>
                      </div>
                      <button
                        onClick={() => {
                          onInstallDesktop?.();
                          onClose();
                        }}
                        className="w-full py-3.5 px-4 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black text-xs transition-all shadow-xl shadow-primary/40 flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        <span>Install Desktop App Now</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                        <span className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center font-black text-xs shrink-0">1</span>
                        <div>
                          <p className="font-bold text-white text-sm">Chrome, Edge, or Brave Browser:</p>
                          <p className="text-white/60 mt-1">Click the <strong className="text-primary">Install App icon (⊕ or computer icon)</strong> in your browser address bar (top right corner of URL bar).</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                        <span className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center font-black text-xs shrink-0">2</span>
                        <div>
                          <p className="font-bold text-white text-sm">Browser Menu (3 Dots):</p>
                          <p className="text-white/60 mt-1">Click the top-right menu ⋮ &rarr; <strong>&quot;Cast, save, and share&quot;</strong> (or &quot;Apps&quot;) &rarr; <strong>&quot;Install CineStream&quot;</strong>.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {platform === "ios" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                    <span className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center font-black text-xs shrink-0">1</span>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>Tap the <strong>Share</strong> button</span>
                        <Share className="w-3.5 h-3.5 text-blue-400" />
                      </p>
                      <p className="text-white/60 mt-1">Located at the bottom bar in Safari.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                    <span className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center font-black text-xs shrink-0">2</span>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>Tap <strong>&quot;Add to Home Screen&quot;</strong></span>
                        <PlusSquare className="w-3.5 h-3.5 text-primary" />
                      </p>
                      <p className="text-white/60 mt-1">Scroll down the iOS share sheet list.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                    <span className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center font-black text-xs shrink-0">3</span>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">Tap &quot;Add&quot; in top right</p>
                      <p className="text-white/60 mt-1">CineStream will appear as a dedicated app icon on your iPhone home screen!</p>
                    </div>
                  </div>
                </div>
              )}

              {platform === "android" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                    <span className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center font-black text-xs shrink-0">1</span>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>Tap the <strong>Menu</strong> button (three dots)</span>
                        <MoreVertical className="w-3.5 h-3.5 text-white/60" />
                      </p>
                      <p className="text-white/60 mt-1">Located at the top right of Chrome.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                    <span className="w-6 h-6 rounded-full bg-primary/30 text-primary flex items-center justify-center font-black text-xs shrink-0">2</span>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong></p>
                      <p className="text-white/60 mt-1">Tap Install to add the CineStream app to your Android home screen and app drawer.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Features preview */}
            <div className="mt-5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-around text-[11px] text-white/60">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Zero browser bars</span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Faster loading</span>
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>1-Tap Launch</span>
              </span>
            </div>

            {/* Close / Got it footer */}
            <div className="pt-5">
              <button
                onClick={onClose}
                className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xs transition-colors cursor-pointer touch-manipulation active:scale-98"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
