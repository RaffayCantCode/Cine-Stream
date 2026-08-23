"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { InstallAppModal } from "./InstallAppModal";
import { cn } from "@/lib/utils";

interface InstallAppButtonProps {
  compact?: boolean;
  className?: string;
}

export function InstallAppButton({ compact = false, className }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if app is already running in standalone PWA / installed app mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: window-controls-overlay)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");

      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    const mql = window.matchMedia("(display-mode: standalone)");
    if (mql?.addEventListener) {
      mql.addEventListener("change", checkStandalone);
    }

    // Listen for beforeinstallprompt event on Chrome/Edge/Brave/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mql?.removeEventListener) {
        mql.removeEventListener("change", checkStandalone);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("Install prompt failed, falling back to modal:", err);
        setModalOpen(true);
      }
    } else {
      setModalOpen(true);
    }
  };

  // If already installed and opened as a desktop/mobile app, completely hide the button
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={cn(
            "p-1.5 sm:p-2 text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 rounded-xl transition-all touch-manipulation cursor-pointer flex items-center gap-1 text-xs font-bold",
            className
          )}
          title="Download App"
          aria-label="Download App"
        >
          <Download className="w-4 h-4 text-purple-400" />
        </button>
      ) : (
        <div className={cn("px-3 py-1", className)}>
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-purple-500/30 text-white/80 hover:text-white font-bold text-xs transition-all group cursor-pointer"
          >
            <Download className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="truncate">Download App</span>
          </button>
        </div>
      )}

      <InstallAppModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onInstallDesktop={handleInstallClick}
        canPromptDesktop={Boolean(deferredPrompt)}
      />
    </>
  );
}
