"use client";

import { useEffect, useState } from "react";
import { 
  Download, 
  X, 
  Smartphone, 
  Laptop, 
  Share, 
  PlusSquare, 
  MoreVertical, 
  CheckCircle2, 
  Sparkles 
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setPlatform("ios");
    } else if (/android/i.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            className="relative w-full max-w-lg bg-[#0e122b] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/90 z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Install CineStream App</h3>
                  <p className="text-xs text-white/50 font-medium">Enjoy full-screen, standalone streaming</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] my-6">
              <button
                onClick={() => setPlatform("desktop")}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  platform === "desktop"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Desktop (PC/Mac)</span>
              </button>
              <button
                onClick={() => setPlatform("ios")}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  platform === "ios"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                onClick={() => setPlatform("android")}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  platform === "android"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
            </div>

            {/* Platform Instructions */}
            <div className="space-y-4 text-xs font-medium text-white/80">
              {platform === "desktop" && (
                <div className="space-y-4">
                  {canPromptDesktop ? (
                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-col items-center gap-3 text-center">
                      <Sparkles className="w-6 h-6 text-purple-400" />
                      <div>
                        <p className="text-sm font-black text-white">Direct Installation Ready</p>
                        <p className="text-xs text-white/60 mt-0.5">Click below to install CineStream directly onto your desktop as a standalone app.</p>
                      </div>
                      <button
                        onClick={() => {
                          onInstallDesktop?.();
                          onClose();
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Install Desktop App Now</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                        <div>
                          <p className="font-bold text-white">Using Chrome, Edge, or Brave:</p>
                          <p className="text-white/60 mt-0.5">Click the <strong className="text-purple-300">Install icon</strong> in your browser address bar (top right).</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                        <div>
                          <p className="font-bold text-white">Using Other Browsers:</p>
                          <p className="text-white/60 mt-0.5">Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">Ctrl+D</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">Cmd+D</kbd> to save CineStream to your bookmarks bar.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {platform === "ios" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                    <div className="flex-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Tap the <strong>Share</strong> button</span>
                        <Share className="w-3.5 h-3.5 text-blue-400" />
                      </p>
                      <p className="text-white/60 mt-0.5">Located at the bottom of Safari.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                    <div className="flex-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Tap <strong>&quot;Add to Home Screen&quot;</strong></span>
                        <PlusSquare className="w-3.5 h-3.5 text-purple-400" />
                      </p>
                      <p className="text-white/60 mt-0.5">Scroll down the share menu list.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                    <div className="flex-1">
                      <p className="font-bold text-white">Tap &quot;Add&quot; in top right</p>
                      <p className="text-white/60 mt-0.5">CineStream will appear as a full-screen app on your iPhone home screen!</p>
                    </div>
                  </div>
                </div>
              )}

              {platform === "android" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                    <div className="flex-1">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>Tap the <strong>Menu</strong> button (three dots)</span>
                        <MoreVertical className="w-3.5 h-3.5 text-white/60" />
                      </p>
                      <p className="text-white/60 mt-0.5">Located at the top right of Chrome.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                    <div className="flex-1">
                      <p className="font-bold text-white">Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong></p>
                      <p className="text-white/60 mt-0.5">Follow the prompt to install the standalone CineStream app.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Close / Got it footer */}
            <div className="pt-6">
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
