"use client";

import { SiNetflix, SiAppletv, SiMax, SiParamountplus } from "react-icons/si";
import { ProviderIcon } from "@/components/ProviderIcon";

/**
 * Fully self-contained streaming platform wordmarks.
 * Rendered inline (react-icons / text / local SVGs) so they never depend on
 * third-party hotlinks (e.g. Wikimedia) that can be slow, blocked or rate-limited.
 */
export function ProviderLogo({ slug, name }: { slug: string; name: string }) {
  switch (slug) {
    case "netflix":
      return (
        <div className="flex items-center gap-2" aria-label="Netflix">
          <SiNetflix className="w-7 h-7 text-[#E50914]" aria-hidden />
          <span
            className="text-[#E50914] font-black text-2xl tracking-tight leading-none"
            style={{ fontFamily: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif", transform: "scaleY(1.15)" }}
          >
            NETFLIX
          </span>
        </div>
      );
    case "disney-plus":
      return (
        <span
          className="text-white text-3xl leading-none whitespace-nowrap"
          style={{ fontFamily: "'Brush Script MT', 'Segoe Script', Georgia, serif", fontStyle: "italic", fontWeight: 700 }}
          aria-label="Disney+"
        >
          Disney<span className="font-sans not-italic font-light text-[#5ad7ff] ml-0.5">+</span>
        </span>
      );
    case "prime-video":
      return (
        <div className="flex flex-col items-center leading-none" aria-label="Prime Video">
          <span className="text-white font-bold text-2xl tracking-tight" style={{ fontFamily: "Arial, sans-serif" }}>
            prime video
          </span>
          <svg viewBox="0 0 100 14" className="w-20 h-3 -mt-0.5" aria-hidden>
            <path d="M4 3 Q50 16 92 4" stroke="#00A8E1" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M85 1.5 L94 3.5 L89 10" stroke="#00A8E1" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    case "apple-tv-plus":
      return (
        <div className="flex items-center text-white" aria-label="Apple TV+">
          <SiAppletv className="w-14 h-14" aria-hidden />
          <span className="text-3xl font-light -ml-0.5 leading-none">+</span>
        </div>
      );
    case "hulu":
      return <img src="/hulu-logo.svg" alt="Hulu" className="h-20 w-auto object-contain scale-110" />;
    case "hbo-max":
      return <SiMax className="w-20 h-20 text-white" aria-label="Max" />;
    case "paramount-plus":
      return (
        <div className="flex flex-col items-center text-white" aria-label="Paramount+">
          <SiParamountplus className="w-10 h-10" aria-hidden />
          <span className="text-sm font-bold tracking-wide mt-1 leading-none">Paramount+</span>
        </div>
      );
    case "peacock":
      return (
        <div className="flex items-center gap-2" aria-label="Peacock">
          <ProviderIcon slug="peacock" className="w-9 h-9" />
          <span className="text-white font-black text-3xl tracking-tighter" style={{ fontFamily: "Arial, sans-serif" }}>
            peacock
          </span>
        </div>
      );
    default:
      return <span className="text-white font-black text-xl tracking-tight">{name}</span>;
  }
}
