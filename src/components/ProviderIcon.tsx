"use client";

import type { IconType } from "react-icons";
import { SiNetflix, SiAppletv, SiMax, SiParamountplus } from "react-icons/si";

const LOCAL_ICONS: Record<string, IconType> = {
  "netflix": SiNetflix,
  "apple-tv-plus": SiAppletv,
  "hbo-max": SiMax,
  "paramount-plus": SiParamountplus,
};

interface ProviderIconProps {
  slug: string;
  className?: string;
}

// Use cdn.simpleicons.org which always returns valid icons in the requested hex color
const SIMPLEICONS: Record<string, string> = {
  "netflix": "netflix",
  "disney-plus": "disneyplus",
  "prime-video": "amazonprime",
  "apple-tv-plus": "appletv",
  "hulu": "hulu",
  "hbo-max": "hbo",
  "paramount-plus": "paramountplus",
};

// Peacock feather SVG (no simple-icons equivalent)
function PeacockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {/* Simplified peacock feather fan */}
      <circle cx="32" cy="44" r="6" fill="white" />
      {[
        { rot: -60, color: "#00B2FF" },
        { rot: -30, color: "#00CC66" },
        { rot: 0,   color: "#FF6B35" },
        { rot: 30,  color: "#A855F7" },
        { rot: 60,  color: "#EAB308" },
      ].map(({ rot, color }) => (
        <g key={rot} transform={`rotate(${rot} 32 44)`}>
          <ellipse cx="32" cy="22" rx="4" ry="12" fill={color} opacity="0.9" />
          <ellipse cx="32" cy="12" rx="5" ry="6" fill="white" opacity="0.7" />
          <circle cx="32" cy="12" r="3" fill={color} />
        </g>
      ))}
    </svg>
  );
}

export function ProviderIcon({ slug, className }: ProviderIconProps) {
  // Peacock: custom SVG (no simple-icons entry exists)
  if (slug === "peacock") {
    return <PeacockIcon className={className} />;
  }

  // Disney+: no simple-icons entry — render a local text mark (no external hotlink)
  if (slug === "disney-plus") {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-label="Disney+">
        <text x="30" y="44" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="34" fill="white">D</text>
        <text x="50" y="36" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="300" fontSize="24" fill="white">+</text>
      </svg>
    );
  }

  // Prefer locally bundled icons (react-icons) so nothing depends on a CDN
  const LocalIcon = LOCAL_ICONS[slug];
  if (LocalIcon) {
    return <LocalIcon className={`text-white ${className || ""}`} aria-label={slug} />;
  }

  if (slug === "prime-video") {
    return <img src="/prime-logo.svg" alt="Prime Video" className={className} style={{ filter: "brightness(0) invert(1)" }} />;
  }
  if (slug === "hulu") {
    return <img src="/hulu-logo.svg" alt="Hulu" className={className} />;
  }

  const iconSlug = SIMPLEICONS[slug];
  if (!iconSlug) return null;

  // Load from jsDelivr CDN and apply brightness/invert filter to make the SVG white
  return (
    <img
      src={`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${iconSlug}.svg`}
      alt={slug}
      className={className}
      style={{ filter: "brightness(0) invert(1)" }}
      loading="eager"
    />
  );
}
