"use client";

import { useEffect, useState, memo } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";

export const BackToTopButton = memo(function BackToTopButton() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const isImmersiveRoute =
    pathname?.startsWith("/watch") ||
    pathname?.startsWith("/shorts") ||
    pathname?.includes("/read/");

  useEffect(() => {
    if (isImmersiveRoute) {
      setVisible(false);
      return;
    }

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setVisible(window.scrollY > 480);
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isImmersiveRoute, pathname]);

  if (isImmersiveRoute || !visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll back to top"
      title="Back to top"
      className="fixed bottom-20 md:bottom-8 right-4 md:right-7 z-50 w-11 h-11 rounded-full bg-[#121620]/90 hover:bg-white text-white hover:text-black border border-white/15 hover:border-white backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.85)] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer animate-in fade-in zoom-in-90"
    >
      <ArrowUp className="w-5 h-5 stroke-[2.5]" />
    </button>
  );
});
