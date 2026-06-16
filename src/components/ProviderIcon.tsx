"use client";

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

  // Disney+: custom SVG (no simple-icons entry exists)
  if (slug === "disney-plus") {
    return (
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg"
        alt="Disney+"
        className={className}
        style={{ filter: "brightness(0) invert(1)" }}
        loading="eager"
      />
    );
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
